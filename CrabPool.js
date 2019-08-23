'use strict'
var
WW = require('@zed.cwt/wish'),
{R : WR,X : WX,C : WC,N : WN} = WW,
HTTP = require('http'),
Net = require('net'),

SocketOption = {allowHalfOpen : true},

ActionError = 'Err',
ActionHello = 'Hell',
ActionWish = 'Wish',
ActionTake = 'Take',
ActionPool = 'Pool',
ActionTick = 'Tick',

ActionWebHello = 'Hell',
ActionWebMEZ = 'MEZ',
ActionWebPool = 'Pool',
ActionWebToken = 'Toke';

module.exports = Option =>
{
	var
	Cipher = Option.Cipher,
	Decipher = Option.Decipher,
	PortMaster = Option.PortMaster,
	PortWeb = Option.PortWeb,
	PipeMaster = Option.Pipe,
	Retry = Option.Retry || 1E4,
	Timeout = WR.Default(3E5,Option.Timeout),
	TickInterval = Option.Tick || 2E4,
	PathData = Option.Data || WN.JoinP(WN.Data,'ZED/CrabPool'),
	PathLog = WN.JoinP(PathData,'Log'),
	Log = Option.Log,
	MakeLog = H => WW.IsFunc(Log) ? (...Q) => Log(`[${H}]`,...Q) : WW.O,

	PathWeb = WN.JoinP(__dirname,'Web'),
	FileID = WN.JoinP(PathData,'ID'),
	FileToken = WN.JoinP(PathData,'Key'),

	DataPool = WN.JSON(WN.JoinP(PathData,'Pool')),
	DataLink = WN.JSON(WN.JoinP(PathData,'Link')),

	MachineIDRaw,MachineID,
	IDSolve = Q => WC.HEXS(WC.SHA512(Q[1])),
	IDShort = Q => Q.slice(0,8),
	Token = WC.Rad(WW.D + WW.AZ + WW.az).S,
	Counter = (Q = 0) => () => WR.PadS0(4,Token(Q++).toUpperCase()),
	MakeTime = (Q = WW.Now()) => () => WW.StrMS(WW.Now() - Q),
	WebToken,
	TokenStepA = Q => WC.HSHA512(Q,MachineID),
	TokenStepB = Q => WC.HSHA512(MachineID,Q),

	MakeSec = (Pipe,OnJSON,OnRaw) =>
	{
		var
		C = Cipher(),D = Decipher(),

		Cache = [],CacheLen = 0,
		Take = function*(Q,R)
		{
			for (;CacheLen < Q;)
			{
				Cache.push(yield)
				CacheLen += Cache[~-Cache.length].length
			}
			if (1 in Cache) Cache[0] = Buffer.concat(Cache),Cache.length = 1
			R = Cache[0].slice(0,Q)
			CacheLen -= Q
			CacheLen ? Cache[0] = Cache[0].slice(Q) : Cache.pop()
			return R
		},
		Done,
		Now = function*(T)
		{
			for (;
				T = yield* Take(2),
				T = OnJSON(WC.JTOO((yield* Take(256 * T[1] + T[0])).toString('UTF8'))[1] || []),
				undefined === T
			;);
			clearInterval(Tick)
			Done = [T]
		}(),

		W = Q => Pipe.destroyed || Pipe.write(Q),
		O = Q =>
		{
			Q = Buffer.from(WC.OTJ([WW.Key(WW.Rnd(20,40)),Q,WW.Key(WW.Rnd(20,40))]),'UTF8')
			W(Buffer.from(C.D([255 & Q.length,255 & Q.length >>> 8]).concat(C.D(Q))))
		},
		Tick = setInterval(() => Pipe.destroyed || O([ActionTick]),TickInterval);

		Now.next()
		Pipe.on('data',Q => Done ? OnRaw(Done[0] ? Q : Buffer.from(D.D(Q))) : Now.next(Buffer.from(D.D(Q))))
			.on('error',WW.O)
		return {
			D : Q => W(Buffer.from(C.D(Q))),
			O : O,
			E : () => clearInterval(Tick)
		}
	},

	//	Master
	PoolKeySID = WW.Key(),
	PoolKeyPipe = WW.Key(),
	PoolKeySec = WW.Key(),
	PoolKeyOnPartner = WW.Key(),
	Pool = {},
	PoolNotify = T =>
	{
		T = DataPool.O()
		WR.Each(V => V[PoolKeySec].O([ActionPool,T]),Pool)
		OnPool(T)
	},
	PoolPartner = {},
	MakeMEZ = () =>
	{
		var
		Count = Counter(),
		Master = Net.createServer(SocketOption,S =>
		{
			var
			Timer = MakeTime(),
			IP = `${S.remoteAddress}:${S.remotePort}`,
			Log = MakeLog(`MEZ ${Count()} ${IP}`),
			MID,SessionID = WW.Key(32),
			Err = Q => Sec.O([ActionError,Q]) || S.destroy(),
			Partner,
			Record,
			Sec = MakeSec(S,Q =>
			{
				switch (Q[0])
				{
					case ActionHello :
						if (!Q[1]) return Err('Who are you')
						MID = IDSolve(Q[1])
						if (MID === MachineID) return Err('You are not only')
						WR.Has(MID,Pool) &&
						(
							Pool[MID][PoolKeySec].O([ActionError,'You are not only']),
							Pool[MID][PoolKeyPipe].destroy()
						)
						Pool[MID] = O
						Record = DataPool.D(MID)
						if (!Record)
						{
							Record = DataPool.D(MID,{})
							Record.Boom = WW.Now()
						}
						Record.S = 9
						Record.IP = IP
						Record.From = WW.Now()
						DataPool.S()
						Sec.O([ActionHello,MachineID])
						PoolNotify()
						Log('Node')
						break

					case ActionWish :
						if (!WR.Has(MID = IDSolve(Q[1]),Pool)) return Err('Who are you')
						if (Q[2] === MachineID) MakeMEZTake(O,MID,Q[3],Q[4])
						else
						{
							if (!WR.Has(Q[2],Pool)) return Err('Who is that')
							PoolPartner[SessionID] = O
							Pool[Q[2]][PoolKeySec].O([ActionWish,SessionID,MID,Q[3],Q[4]])
						}
						Log('Wish')
						return false
					case ActionTake :
						if (!WR.Has(MID = IDSolve(Q[1]),Pool)) return Err('Who are you')
						if (!WR.Has(Q[2],PoolPartner)) return Err('Who is that')
						Partner = PoolPartner[Q[2]]
						Partner[PoolKeyOnPartner](O)
						Sec.O([ActionWish])
						Partner[PoolKeySec].O([ActionWish])
						Log('Take')
						return false

					case ActionTick : break

					case ActionError :
					default : S.destroy()
				}
			},Q => Partner && Partner[PoolKeySec].D(Q)),
			O =
			{
				[PoolKeySID] : SessionID,
				[PoolKeyPipe] : S,
				[PoolKeySec] : Sec,
				[PoolKeyOnPartner] : Q => Partner = Q
			};
			S.on('close',E =>
			{
				Log('Closed',Timer(),E)
				Sec.E()
				if (MID && Pool[MID] && SessionID === Pool[MID][PoolKeySID])
				{
					Record.S = 0
					Record.To = WW.Now()
					WR.Del(MID,Pool)
					DataPool.S()
					PoolNotify()
				}
				Partner && Partner[PoolKeyPipe].destroy()
				WR.Del(SessionID,PoolPartner)
			}).on('end',() => Partner && Partner[PoolKeyPipe].end())
			Log('Connected')
		}).listen(PortMaster || 0)
			.on('listening',() => MakeLog('MEZ','Listening',Master.address()));
	},
	MakeMEZTake = (O,MID,Host,Port) =>
	{
		var
		Timer = MakeTime(),
		Log = MakeLog(`Take ${IDShort(MID)} ${Host}:${Port} ${IDShort(O[PoolKeySID])}`),
		S = Net.createConnection({host : Host,port : Port,timeout : Timeout,...SocketOption});

		O[PoolKeyOnPartner](
		{
			[PoolKeyPipe] : S,
			[PoolKeySec] : {D : Q => S.write(Q)}
		})
		S.on('error',WW.O)
			.on('timeout',() => S.destroy())
			.on('close',E =>
			{
				Log('Fin',Timer(),E)
				O[PoolKeyPipe].destroy()
			})
			.on('end',() => O[PoolKeyPipe].end())
			.on('data',O[PoolKeySec].D)
		O[PoolKeySec].O([ActionWish])
		Log('ACK')
	},

	//	Node
	Online,
	MakePipeCount = Counter(),
	MakePipe = (Q,S) => WX.Just()
		.FMap(R => WX.IsProvider(R = PipeMaster(Q,MakeLog(`Pipe ${MakePipeCount()}`))) ? R : WX.Just(R))
		.FMap(M => WX.Provider(O => S(M.on('error',WW.O),O))),
	MakeQBH = () =>
	{
		var Count = Counter();
		MakePipe(true,(M,O) =>
		{
			var
			Timer = MakeTime(),
			Log = MakeLog(`QBH ${Count()}`),
			Sec = MakeSec(M,Q =>
			{
				switch (Q[0])
				{
					case ActionHello :
						Log('Online')
						WebSocketSend([ActionWebMEZ,Q[1]])
						Online = true
						break
					case ActionPool :
						OnPool(DataPool.O(Q[1]))
						break

					case ActionWish :
						MakeQBHTake(Q)
						break

					case ActionTick : break

					case ActionError : Log(...Q)
					default : M.destroy()
				}
			});
			Log('Begin')
			M.on('connect',() => Log('Connected'))
				.on('close',E =>
				{
					Log('Closed',Timer(),E)
					Online = false
					WebSocketSend([ActionWebMEZ,null])
					Sec.E()
					O.E()
				})
			Sec.O([ActionHello,MachineIDRaw])
		}).RetryWhen(Q => Q.Delay(Retry)).Now()
	},
	MakeQBHTake = Q => MakePipe(false,(M,O) =>
	{
		var
		Timer = MakeTime(),
		Log = MakeLog(`Take ${IDShort(Q[2])} ${Q[3]}:${Q[4]} ${IDShort(Q[1])}`),
		S = Net.createConnection({host : Q[3],port : Q[4],timeout : Timeout,...SocketOption}),
		Sec = MakeSec(M,Q =>
		{
			switch (Q[0])
			{
				case ActionWish :
					Log('ACK')
					S.on('data',Sec.D)
					return false
				case ActionTick : break
				case ActionError : Log(...Q)
				default : O.F()
			}
		},Q => S.write(Q));
		M.on('connect',() => Log('Connected'))
			.on('close',E =>
			{
				Log('Closed',Timer(),E)
				Sec.E()
				O.F()
			})
			.on('end',() => S.end())
		S.on('error',WW.O)
			.on('timeout',O.F)
			.on('close',E =>
			{
				Log('Fin',Timer(),E)
				O.F()
			})
			.on('end',() => M.end())
		Sec.O([ActionTake,MachineIDRaw,Q[1]])
		Sec.E()
		return () => M.destroy() | S.destroy()
	}).Now(null,WW.O),

	//	Wish
	PoolWishKeyServer = WW.Key(),
	PoolWishKeyPort = WW.Key(),
	PoolWish = {},
	MakeWish = (Local,Target,Host,Port) =>
	{
		var
		Count = Counter(),
		Server = Net.createServer(SocketOption,S =>
		{
			var
			Timer = MakeTime(),
			Log = MakeLog(`Wish ${Count()} ${IDShort(Target)} ${Host}:${Port}`),
			Sec,
			Partner,SessionID;
			S.on('error',WW.O)
			if (PipeMaster) Online ?
				MakePipe(false,(M,O) =>
				{
					Sec = MakeSec(M,Q =>
					{
						switch (Q[0])
						{
							case ActionWish :
								Log('Granted')
								S.on('data',Sec.D)
								return false
							case ActionTick : break
							case ActionError : Log(...Q)
							default : O.F()
						}
					},Q => S.write(Q))
					M.on('connect',() => Log('Connected'))
						.on('close',E =>
						{
							Log('Closed',Timer(),E)
							Sec.E()
							O.F()
						})
						.on('end',() => S.end())
					S.setTimeout(Timeout)
						.on('timeout',O.F)
						.on('close',E =>
						{
							Log('Fin',Timer(),E)
							O.F()
						})
						.on('end',() => M.end())
					Sec.O([ActionWish,MachineIDRaw,Target,Host,Port])
					Sec.E()
					return () => M.destroy() | S.destroy()
				}).Now(null,WW.O,() => S.destroy()) :
				S.destroy()
			else if (WR.Has(Target,Pool))
			{
				PoolPartner[SessionID = WW.Key(32)] =
				{
					[PoolKeyPipe] : S,
					[PoolKeySec] :
					{
						O : () =>
						{
							Log('Granted')
							S.setTimeout(Timeout)
								.on('timeout',() => S.destroy())
								.on('close',E =>
								{
									Log('Fin',Timer(),E)
									Partner[PoolKeyPipe].destroy()
								})
								.on('end',() => Partner[PoolKeyPipe].end())
								.on('data',Partner[PoolKeySec].D)
						},
						D : Q => S.write(Q)
					},
					[PoolKeyOnPartner] : Q => Partner = Q
				}
				Pool[Target][PoolKeySec].O([ActionWish,SessionID,MachineID,Host,Port])
			}
			else S.destroy()
		}).listen(Local)
			.on('listening',() =>
			{
				O[PoolWishKeyPort] = Server.address().port
				MakeLog(`Wish ${IDShort(Target)} ${Host}:${Port}`)('Deployed at',O[PoolWishKeyPort])
			}),
		O =
		{
			[PoolWishKeyServer] : Server,
			[PoolWishKeyPort] : Port
		};
		PoolWish[Local] = O
	},



	//	Web
	LogWeb,
	WebServerMap =
	{
		'/' : WN.JoinP(PathWeb,'Entry'),
		'/W' : require.resolve('@zed.cwt/wish'),
		'/M' : WN.JoinP(PathWeb,'Entry.js')
	},
	WebServer = HTTP.createServer((Q,S,R) =>
	{
		((R = WebServerMap[Q.url.toUpperCase().replace(/\?.*/,'')]) ? WN.FileR(R,'UTF8') : WX.Throw())
			.Now(V =>
			{
				/\.js$/.test(R) && S.setHeader('Content-Type','application/javascript; charset=UTF-8')
				S.end(V)
			},() =>
			{
				S.writeHead(404)
				S.end(`Unable to resolve //${Q.headers.host || ''}${Q.url}`)
			})
	}).on('listening',() => LogWeb('Deployed at',WebServer.address().port)),
	LogWebSocket,
	WebSocketPool = new Set,
	WebSocketLast = {[ActionWebPool] : [ActionWebPool,DataPool.O()]},
	WebSocketSend = Q =>
	{
		WebSocketLast[Q[0]] = Q
		WebSocketPool.forEach(V => V(Q))
	},
	OnPool = Q => WebSocketSend([ActionWebPool,Q]),
	OnSocket = (S,H) =>
	{
		var
		Timer = MakeTime(),
		Addr = H.connection.remoteAddress + ':' + H.connection.remotePort,
		Cipher = WC.AESES(WebToken,WebToken,WC.CFB),
		Decipher = WC.AESDS(WebToken,WebToken,WC.CFB),
		Send = D =>
		{
			D = Cipher.D(WC.OTJ([WW.Key(WW.Rnd(20,40)),D,WW.Key(WW.Rnd(20,40))]))
			try{S.send(WC.B91S(D))}catch(_){}
		},
		Suicide = () => S.terminate(),
		Wait = WW.To(Timeout,Suicide);

		LogWebSocket('Accepted',Addr)
		S.on('message',Q =>
		{
			Wait.D()
			Q = Decipher.D(WC.B91P(Q))
			Q = WC.JTOO(WC.U16S(Q))
			if (!WW.IsArr(Q)) return Suicide()
			Q = Q[1]
			if (!WW.IsArr(Q)) return Suicide()
			switch (Q[0])
			{
				case ActionWebHello :
					if (WC.HEXS(TokenStepB(WC.B91P(Q[1]))) !== WC.HEXS(WebToken)) return Suicide()
					Send([ActionWebHello,MachineID,!PipeMaster])
					WR.Each(Send,WebSocketLast)
					WebSocketPool.add(Send)
					break

				case ActionWebToken :
					if (WC.HEXS(TokenStepB(WC.B91P(Q[1]))) === WC.HEXS(WebToken))
						WN.FileW(FileToken,WC.B91S(TokenStepB(WC.B91P(Q[2]))))
							.FMap(() => WN.FileR(FileToken))
							.Now(Q =>
							{
								WebToken = WC.B91P(Q)
								Send([ActionWebToken,true,'New token saved! Connect again'])
								Suicide()
							},() => Send([ActionWebToken,false,'Failed to save the new token']))
					else Send([ActionWebToken,false,'Original token is incorrect'])
					break

				default : Suicide()
			}
		}).on('close',E =>
		{
			LogWebSocket('Closed',Timer(),E,Addr)
			WebSocketPool.delete(Send)
			Wait.F()
		})
		try{S.send(MachineID)}catch(_){}
	};

	if (null == Log) Log = (H => (...Q) => H(WW.StrDate(),WW.Tick(),'|',...Q))
		(WN.RollLog({Pre : WN.JoinP(PathLog,'Event')}))
	LogWeb = MakeLog('Web')
	LogWebSocket = MakeLog('WebSocket')

	return {
		Log,
		Pool : WN.MakeDir(PathLog)
			.FMap(() => WN.FileR(FileID)
				.ErrAs(() => WN.FileW(FileID,WW.Key(320))
					.FMap(() => WN.FileR(FileID))))
			.Map(Q => MachineID = IDSolve(MachineIDRaw = WC.HEXS(WC.SHA512(Q))))
			.FMap(() => WN.FileR(FileToken)
				.ErrAs(K =>
				(
					K = WW.Key(20),
					Log('Key',K),
					WN.FileW(FileToken,WC.B91S(TokenStepB(TokenStepA(K))))
						.FMap(() => WN.FileR(FileToken))
				)))
			.Map(Q => WebToken = WC.B91P(Q))
			.Now(() =>
			{
				PipeMaster ? MakeQBH() : MakeMEZ()
				Log('========')
				WW.IsNum(PortWeb) && new (require('ws')).Server({server : WebServer.listen(PortWeb)}).on('connection',OnSocket)
			}),
		Exp : X => (X || require('express').Router())
			.use((Q,S,N) => '/' === Q.path && !/\/(\?.*)?$/.test(Q.originalUrl) ? S.redirect(302,Q.baseUrl + Q.url) : N())
			.use((Q,S,N) => (Q = WebServerMap[Q.path.toUpperCase()]) ? S.sendFile(Q) : N()),
		Soc : OnSocket
	}
}