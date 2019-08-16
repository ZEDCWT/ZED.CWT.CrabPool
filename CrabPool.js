'use strict'
var
Wish = require('@zed.cwt/wish'),
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
ActionWebPool = 'Pool';

module.exports = Option =>
{
	var
	Cipher = Option.Cipher,
	Decipher = Option.Decipher,
	PortMaster = Option.PortMaster,
	PortWeb = Option.PortWeb,
	PipeMaster = Option.Pipe,
	Retry = Option.Retry || 1E4,
	Timeout = Wish.R.Default(3E5,Option.Timeout),
	TickInterval = Option.Tick || 2E4,
	PathData = Option.Data || Wish.N.JoinP(Wish.N.Data,'ZED/CrabPool'),
	PathLog = Wish.N.JoinP(PathData,'Log'),
	Log = Option.Log,
	MakeLog = H => Wish.IsFunc(Log) ? (...Q) => Log(`[${H}]`,...Q) : Wish.O,

	PathWeb = Wish.N.JoinP(__dirname,'Web'),
	FileID = Wish.N.JoinP(PathData,'ID'),
	FileKey = Wish.N.JoinP(PathData,'Key'),

	MachineIDRaw,MachineID,
	IDSolve = Q => Wish.C.HEXS(Wish.C.SHA512(Q[1])),
	IDShort = Q => Q.slice(0,8),
	Token = Wish.C.Rad(Wish.D + Wish.AZ + Wish.az).S,
	Counter = (Q = 0) => () => Wish.R.PadS0(4,Token(Q++).toUpperCase()),
	MakeTime = (Q = Wish.Now()) => () => Wish.StrMS(Wish.Now() - Q),

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
				T = OnJSON(Wish.C.JTOO((yield* Take(256 * T[1] + T[0])).toString('UTF8'))),
				undefined === T
			;);
			clearInterval(Tick)
			Done = [T]
		}(),

		W = Q => Pipe.destroyed || Pipe.write(Q),
		O = Q =>
		{
			Q = Wish.IsBuff(Q) ? Q : Buffer.from(Wish.IsObj(Q) ? Wish.C.OTJ(Q) : Q,'UTF8')
			W(Buffer.from(C.D([255 & Q.length,255 & Q.length >>> 8]).concat(C.D(Q))))
		},
		Tick = setInterval(() => Pipe.destroyed || O([ActionTick]),TickInterval);

		Now.next()
		Pipe.on('data',Q => Done ? OnRaw(Done[0] ? Q : Buffer.from(D.D(Q))) : Now.next(Buffer.from(D.D(Q))))
			.on('error',Wish.O)
		return {
			D : Q => W(Buffer.from(C.D(Q))),
			O : O,
			E : () => clearInterval(Tick)
		}
	},

	//	Master
	PoolKeySID = Wish.Key(),
	PoolKeyIP = Wish.Key(),
	PoolKeyPipe = Wish.Key(),
	PoolKeySec = Wish.Key(),
	PoolKeyOnPartner = Wish.Key(),
	Pool = {},
	PoolNotify = T =>
	{
		T = Wish.R.ReduceU((D,V,F) => {D.push({ID : F,IP : V[PoolKeyIP]})},[],Pool)
		Wish.R.Each(V => V[PoolKeySec].O([ActionPool,T]),Pool)
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
			Log = MakeLog(`MEZ ${Count()} ${S.remoteAddress}:${S.remotePort}`),
			MID,SessionID = Wish.Key(32),
			Err = Q => Sec.O([ActionError,Q]) || S.destroy(),
			Partner,
			Sec = MakeSec(S,Q =>
			{
				switch (Q[0])
				{
					case ActionHello :
						if (!Q[1]) return Err('Who are you')
						MID = IDSolve(Q[1])
						if (MID === MachineID) return Err('You are not only')
						Wish.R.Has(MID,Pool) &&
						(
							Pool[MID][PoolKeySec].O([ActionError,'You are not only']),
							Pool[MID][PoolKeyPipe].destroy()
						)
						Pool[MID] = O
						Sec.O([ActionHello])
						PoolNotify()
						Log('Node')
						break

					case ActionWish :
						if (!Wish.R.Has(MID = IDSolve(Q[1]),Pool)) return Err('Who are you')
						if (Q[2] === MachineID) MakeMEZTake(O,MID,Q[3],Q[4])
						else
						{
							if (!Wish.R.Has(Q[2],Pool)) return Err('Who is that')
							PoolPartner[SessionID] = O
							Pool[Q[2]][PoolKeySec].O([ActionWish,SessionID,MID,Q[3],Q[4]])
						}
						Log('Wish')
						return false
					case ActionTake :
						if (!Wish.R.Has(MID = IDSolve(Q[1]),Pool)) return Err('Who are you')
						if (!Wish.R.Has(Q[2],PoolPartner)) return Err('Who is that')
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
				[PoolKeyIP] : `${S.remoteAddress}:${S.remotePort}`,
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
					Wish.R.Del(MID,Pool)
					PoolNotify()
				}
				Partner && Partner[PoolKeyPipe].destroy()
				Wish.R.Del(SessionID,PoolPartner)
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
		S.on('error',Wish.O)
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
	LogMakePipe,
	MakePipe = (Q,S) => Wish.X.Just()
		.FMap(R => Wish.X.IsProvider(R = PipeMaster(Q,LogMakePipe)) ? R : Wish.X.Just(R))
		.FMap(M => Wish.X.Provider(O => S(M.on('error',Wish.O),O))),
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
						Online = true
						break
					case ActionPool :
						OnPool(Q[1])
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
		S.on('error',Wish.O)
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
	}).Now(null,Wish.O),

	//	Wish
	PoolWishKeyServer = Wish.Key(),
	PoolWishKeyPort = Wish.Key(),
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
			S.on('error',Wish.O)
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
				}).Now(null,Wish.O,() => S.destroy()) :
				S.destroy()
			else if (Wish.R.Has(Target,Pool))
			{
				PoolPartner[SessionID = Wish.Key(32)] =
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
		'/' : Wish.N.JoinP(PathWeb,'Entry'),
		'/W' : require.resolve('@zed.cwt/wish'),
		'/M' : Wish.N.JoinP(PathWeb,'Entry.js')
	},
	WebServer = HTTP.createServer((Q,S,R) =>
	{
		((R = WebServerMap[Q.url.toUpperCase().replace(/\?.*/,'')]) ? Wish.N.FileR(R,'UTF8') : Wish.X.Throw())
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
	WebSocketLast = {Pool : '["Pool",{}]'},
	WebSocketSend = Q =>
	{
		WebSocketLast[Q[0]] = Q = Wish.C.OTJ(Q)
		WebSocketPool.forEach(V => V(Q))
	},
	OnPool = Q => WebSocketSend(['Pool',Q]),
	OnSocket = (S,H) =>
	{
		var
		Timer = MakeTime(),
		Addr = H.connection.remoteAddress + ':' + H.connection.remotePort,
		Send = D =>
		{

			try{S.send(Wish.C.B91S(D))}catch(_){}
		},
		Suicide = () => S.terminate();
		LogWebSocket('Accepted',Addr)
		S.on('message',Q =>
		{
			Q = Wish.C.B91P(Q.data)

			Q = Wish.C.JTOO(Wish.C.U16S(Q))
			if (!Wish.IsArr(Q)) return Suicide()
			switch (Q[0])
			{
				case ActionWebHello :
				case ActionWebPool :
				default : Suicide()
			}
		}).on('close',E =>
		{
			LogWebSocket('Closed',Timer(),E,Addr)
			WebSocketPool.delete(Send)
		})

		Wish.R.Each(Send,WebSocketLast)
	};

	if (null == Log) Log = (H => (...Q) => H(Wish.StrDate(),Wish.Tick(),'|',...Q))
		(Wish.N.RollLog({Pre : Wish.N.JoinP(PathLog,'Event')}))
	LogMakePipe = MakeLog('Pipe')
	LogWeb = MakeLog('Web')
	LogWebSocket = MakeLog('WebSocket')

	Wish.IsNum(PortWeb) && new (require('ws')).Server({server : WebServer.listen(PortWeb)}).on('connection',OnSocket)

	return {
		Log,
		Pool : Wish.N.MakeDir(PathLog)
			.FMap(() => Wish.N.FileR(FileID))
			.ErrAs(() => Wish.N.FileW(FileID,Wish.Key(320))
				.FMap(() => Wish.N.FileR(FileID)))
			.Map(Q =>
			{
				MachineID = IDSolve(MachineIDRaw = Wish.C.HEXS(Wish.C.SHA512(Q)))
				Log(MachineID)
				PipeMaster ? MakeQBH() : MakeMEZ()
			})
			.FMap(() => Wish.N.FileR(FileKey))
			.Now(),
		Exp : X => (X || require('express').Router())
			.use((Q,S,N) => '/' === Q.path && !/\/(\?.*)?$/.test(Q.originalUrl) ? S.redirect(302,Q.baseUrl + Q.url) : N())
			.use((Q,S,N) => (Q = WebServerMap[Q.path.toUpperCase()]) ? S.sendFile(Q) : N()),
		Soc : OnSocket
	}
}