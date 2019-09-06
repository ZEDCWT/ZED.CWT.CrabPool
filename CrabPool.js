'use strict'
var
WW = require('@zed.cwt/wish'),
{R : WR,X : WX,C : WC,N : WN} = WW,
HTTP = require('http'),
Net = require('net'),

SocketOption = {allowHalfOpen : true},

ActionHello = 'Hell',
ActionPing = 'Ping',
ActionPong = 'Pong',
ActionWish = 'Wish',
ActionTake = 'Take',
ActionPool = 'Pool',
ActionPoolEdit = 'PoolEdit',
ActionPoolDel = 'PoolDel',
ActionTick = 'Tick',
ActionError = 'Err',

ActionWebHello = 'Hell',
ActionWebMEZ = 'MEZ',
ActionWebToken = 'Toke',
ActionWebPool = 'Pool',
ActionWebPoolEdit = 'PoolEdit',
ActionWebPoolDel = 'PoolDel',
ActionWebPing = 'Ping',
ActionWebLink = 'Link',
ActionWebLinkS = 'LinkS',
ActionWebLinkAdd = 'LinkAdd',
ActionWebLinkSwitch = 'LinkSwitch',
ActionWebLinkEdit = 'LinkEdit',
ActionWebLinkDel = 'LinkDel',
ActionWebLinkError = 'LinkError',
ActionWebError = 'Err';

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
	DataLinkS = WN.JSON(WN.JoinP(PathData,'LinkS')),

	MachineIDRaw,MachineID,
	IDSolve = Q => WC.HEXS(WC.SHA512(Q[1])),
	IDShort = Q => Q.slice(0,8),
	IDName = Q => Q.slice(0,8) + (Q = DataPool.D(Q),Q && Q.Name ? ':' + Q.Name : ''),
	Token = WC.Rad(WW.D + WW.AZ + WW.az).S,
	Counter = (Q = 0) => () => WR.PadS0(4,Token(Q++).toUpperCase()),
	MakeTime = (Q = WW.Now()) => () => WW.StrMS(WW.Now() - Q),
	WebToken,
	TokenStepA = Q => WC.HSHA512(Q,MachineID),
	TokenStepB = Q => WC.HSHA512(MachineID,Q),
	RemoteIP = Q => Q.remoteAddress + ':' + Q.remotePort,

	DataPing = {},
	MakePing = (H,W) =>
	{
		var
		K,M,N,
		Fin = () => null == M || clearTimeout(M),
		Roll = () => Fin(H(K = WW.Key(16)),N = WW.Now());
		return {
			R : Roll,
			O : S =>
			{
				if (K && S === K)
				{
					W(WW.Now() - N)
					K = null
					M = setTimeout(Roll,Timeout)
				}
			},
			F : Fin
		}
	},

	EnsureD = Q => Q.D ? Q : {D : S => Q.data(S)},
	MakeSec = (Pipe,OnJSON,OnRaw) =>
	{
		var
		C = EnsureD(Cipher()),D = EnsureD(Decipher()),

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
	PoolO = Q => WR.Each(V => V[PoolKeySec].O(Q),Pool),
	PoolNotify = T =>
	{
		DataPool.S()
		T = DataPool.O()
		PoolO([ActionPool,T])
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
			IP = RemoteIP(S),
			Log = MakeLog(`MEZ ${Count()} ${IP}`),
			MID,SessionID = WW.Key(32),
			Err = Q => Sec.O([ActionError,Q]) || S.destroy(),
			Partner,
			Record,
			Ping = MakePing(Q => Sec.O([ActionPing,Q]),Q =>
			{
				DataPing[MID] = Q
				PoolO([ActionPing,MID,Q])
			}),
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
						if (!Record) Record = DataPool.D(MID,
						{
							Num : 0,
							Boom : WW.Now()
						})
						Record.S = 9
						++Record.Num
						Record.IP = IP
						Record.From = WW.Now()
						Sec.O([ActionHello,MachineID])
						PoolNotify()
						Log('Node')
						Sec.O([ActionPing,DataPing])
						Ping.R()
						break
					case ActionPing :
						Sec.O([ActionPong,Q[1]])
						break
					case ActionPong :
						Ping.O(Q[1])
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

					case ActionPoolEdit :
						MEZPoolEdit(Q)
						break
					case ActionPoolDel :
						MEZPoolDel(Q)
						break

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
				Ping.F()
				Sec.E()
				if (MID && Pool[MID] && SessionID === Pool[MID][PoolKeySID])
				{
					Record.S = 0
					Record.To = WW.Now()
					WR.Del(MID,Pool)
					PoolNotify()
				}
				Partner && Partner[PoolKeyPipe].destroy()
				WR.Del(SessionID,PoolPartner)
			}).on('end',() => Partner && Partner[PoolKeyPipe].end())
			Log('Connected')
		}).listen(PortMaster || 0)
			.on('listening',() => MakeLog('MEZ')('Listening',Master.address().port));
	},
	MakeMEZTake = (O,MID,Host,Port) =>
	{
		var
		Timer = MakeTime(),
		Log = MakeLog(`Take ${IDName(MID)} ${Host}:${Port} ${IDShort(O[PoolKeySID])}`),
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
	MEZPoolEditValid = new Set(['Name','Desc']),
	MEZPoolEdit = (Q,S) =>
	{
		if ((S = DataPool.D(Q[1])) && MEZPoolEditValid.has(Q[2]))
		{
			S[Q[2]] = Q[3]
			PoolNotify()
		}
	},
	MEZPoolDel = Q =>
	{
		DataPool.D(Q[1],null)
		PoolNotify()
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
			MEZID,
			Ping = MakePing(Q => Sec.O([ActionPing,Q]),Q =>
			{
				DataPing[MEZID] = Q
				WebSocketSend([ActionWebPing,MEZID,Q],true)
			}),
			Sec = MakeSec(M,Q =>
			{
				switch (Q[0])
				{
					case ActionHello :
						Log('Online')
						MEZID = Q[1]
						WebSocketSend([ActionWebMEZ,RemoteIP(M)])
						Online = Sec
						Ping.R()
						break
					case ActionPing :
						if (WW.IsObj(Q[1])) WebSocketSend([ActionWebPing,DataPing = Q[1]],true)
						else if (WW.IsNum(Q[2]))
						{
							DataPing[Q[1]] = Q[2]
							WebSocketSend([ActionWebPing,Q[1],Q[2]],true)
						}
						else Sec.O([ActionPong,Q[1]])
						break
					case ActionPong :
						Ping.O(Q[1])
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
					WebSocketSend([ActionWebMEZ,false])
					Ping.F()
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
		Log = MakeLog(`Take ${IDName(Q[2])} ${Q[3]}:${Q[4]} ${IDShort(Q[1])}`),
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
	PoolWishKeyUpdate = WW.Key(),
	PoolWishKeyKill = WW.Key(),
	PoolWish = {},
	MakeWish = (ID,Local) =>
	{
		var
		Timer = MakeTime(),
		Count = Counter(),
		Log = MakeLog(`Wish ${IDShort(ID)}`),
		Target,Host,Port,
		State = DataLinkS.D(ID),
		Renew,
		Server = Net.createServer(SocketOption,S =>
		{
			var
			Timer = MakeTime(),
			Log = MakeLog(`Wish ${IDShort(ID)} ${Count()} ${IDName(Target)} ${Host}:${Port}`),
			Sec,
			Partner,SessionID;
			++State.Visit
			++State.Using
			State.Last = WW.Now()
			LinkSNotify()
			S.on('error',WW.O)
				.on('close',() => LinkSNotify(--State.Using))
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
			else if (Target === MachineID)
			{
				Sec = Net.createConnection({host : Host,port : Port,timeout : Timeout,...SocketOption})
					.on('error',WW.O)
					.on('timeout',() => Sec.destroy())
					.on('close',E =>
					{
						Log('Closed',Timer(),E)
						S.destroy()
					})
					.on('data',Q => S.write(Q))
					.on('end',() => S.end())
				S.setTimeout(Timeout)
					.on('error',WW.O)
					.on('timeout',() => S.destroy())
					.on('close',E =>
					{
						Log('Closed',Timer(),E)
						Sec.destroy()
					})
					.on('data',Q => Sec.write(Q))
					.on('end',() => Sec.end())
			}
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
				Log('Deployed at',State.Port = Server.address().port)
				DataLinkS.s
				LinkSNotify()
				WebSocketSend([ActionWebLinkError,ID])
			})
			.on('close',() => Log('Closed',Timer()))
			.on('error',E =>
			{
				WebSocketSend([ActionWebLinkError,ID,String(E)])
				Renew = setTimeout(() => MakeWish(ID,Local)[PoolWishKeyUpdate](Target,Host + ':' + Port,true),5E3)
			}),
		O =
		{
			[PoolWishKeyServer] : Server,
			[PoolWishKeyUpdate] : (H,P,L) =>
			{
				Target = H
				P = P.split(':')
				Port = WR.Fit(0,0 | P.pop(),65535)
				Host = P.join(':')
				L || Log(`Target ${IDName(Target)} ${Host}:${Port}`)
			},
			[PoolWishKeyKill] : () =>
			{
				undefined === Renew || clearTimeout(Renew)
				Server.close()
			}
		};
		State.Port = -1
		LinkSNotify()
		return PoolWish[ID] = O
	},



	//	Web
	LinkNotify = () =>
	{
		DataLink.S()
		WebSocketSend([ActionWebLink,DataLink.O()])
	},
	LinkSNotify = () =>
	{
		DataLinkS.S()
		WebSocketSend([ActionWebLinkS,DataLinkS.O()])
	},
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
	WebSocketSend = (Q,S) =>
	{
		if (!S) WebSocketLast[Q[0]] = Q
		WebSocketPool.forEach(V => V(Q))
	},
	OnPool = Q => WebSocketSend([ActionWebPool,Q]),
	OnSocket = (S,H) =>
	{
		var
		Timer = MakeTime(),
		Addr = RemoteIP(H.connection),
		Cipher = WC.AESES(WebToken,WebToken,WC.CFB),
		Decipher = WC.AESDS(WebToken,WebToken,WC.CFB),
		Send = D =>
		{
			D = Cipher.D(WC.OTJ([WW.Key(WW.Rnd(20,40)),D,WW.Key(WW.Rnd(20,40))]))
			try{S.send(WC.B91S(D))}catch(_){}
		},
		Err = (Q,S) => Send([ActionWebError,Q,S]),
		Suicide = () => S.terminate(),
		Wait = WW.To(Timeout,Suicide),

		CheckLink = (H,Q) =>
			!Q[1] ? Err(H,'Host is required') :
			!DataPool.D(Q[1]) ? Err(H,'Invalid host') :
			!Q[2] ? Err(H,'Address is required') :
			!WW.IsSafe(Q[3] = +Q[3]) || Q[3] < 0 || 65535 < Q[3] ? Err(H,'Port should be a number in range [0,65535]') :
			true;

		LogWebSocket('Accepted',Addr)
		S.on('message',(Q,T) =>
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
					Send([ActionWebPing,DataPing])
					WebSocketPool.add(Send)
					break

				case ActionWebToken :
					if (WC.HEXS(TokenStepB(WC.B91P(Q[1]))) === WC.HEXS(WebToken))
						WN.FileW(FileToken,WC.B91S(TokenStepB(WC.B91P(Q[2]))))
							.FMap(() => WN.FileR(FileToken))
							.Now(Q =>
							{
								WebToken = WC.B91P(Q)
								Send([ActionWebToken,'New token saved! Connect again'])
								Suicide()
							},() => Err(ActionWebToken,'Failed to save the new token'))
					else Err(ActionWebToken,'Original token is incorrect')
					break

				case ActionWebPoolEdit :
					PipeMaster ?
						Online ?
							Online.O([ActionPoolEdit,Q[1],Q[2],Q[3]]) :
							Err(ActionWebPoolEdit,'Master is not connected') :
						MEZPoolEdit(Q)
					break
				case ActionWebPoolDel :
					PipeMaster ?
						Online ?
							Online.O([ActionPoolDel,Q[1]]) :
							Err(ActionWebPoolDel,'Master is not connected') :
						MEZPoolDel(Q)
					break

				case ActionWebLinkAdd :
					if (CheckLink(ActionWebLinkAdd,Q))
					{
						DataLink.D(T = WW.Key(32),
						{
							S : 9,
							Boom : WW.Now(),
							Host : Q[1],
							Addr : Q[2],
							Port : Q[3]
						})
						DataLinkS.D(T,
						{
							Visit : 0,
							Using : 0,
							Port : -9
						})
						MakeWish(T,Q[3])[PoolWishKeyUpdate](Q[1],Q[2])
						LinkNotify()
						LinkSNotify()
					}
					break
				case ActionWebLinkEdit :
					if (CheckLink(ActionWebLinkEdit,Q))
					{
						if (T = DataLink.D(Q[4]))
						{
							if (T.S && T.Port !== Q[3])
							{
								PoolWish[Q[4]][PoolWishKeyKill]()
								MakeWish(Q[4],Q[3])
							}
							T.Host = Q[1]
							T.Addr = Q[2]
							T.Port = Q[3]
							T.S && PoolWish[Q[4]][PoolWishKeyUpdate](T.Host,T.Addr)
							LinkNotify()
						}
						else Err(ActionWebLinkEdit,'Unable to edit nonexistent links')
					}
					break
				case ActionWebLinkSwitch :
					if ((T = DataLink.D(Q[1])) && !Q[2] !== !T.S)
					{
						if (T.S = Q[2] ? 9 : 0)
							MakeWish(Q[1],T.Port)[PoolWishKeyUpdate](T.Host,T.Addr)
						else
						{
							PoolWish[Q[1]][PoolWishKeyKill]()
							WR.Del(Q[1],PoolWish)
							DataLinkS.D(Q[1]).Port = -1
							LinkSNotify()
						}
						LinkNotify()
					}
					else Err(ActionWebLinkSwitch,'Invalid host')
					break
				case ActionWebLinkDel :
					if (T = DataLink.D(Q[1]))
					{
						if (T.S)
						{
							PoolWish[Q[1]][PoolWishKeyKill]()
							WR.Del(Q[1],PoolWish)
						}
						DataLink.D(Q[1],null)
						DataLinkS.D(Q[1],null)
						LinkNotify()
					}
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
	WR.Each(V => V.S = 0,DataPool.O())

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
			.Now(T =>
			{
				PipeMaster ? MakeQBH() : MakeMEZ()
				if (!PipeMaster)
				{
					T = DataPool.D(MachineID)
					if (!T) T = DataPool.D(MachineID,
					{
						MEZ : 9,
						Num : 0,
						IP : '::',
						Boom : WW.Now()
					})
					T.S = 9
					++T.Num
					T.From = WW.Now()
				}
				PoolNotify()
				LinkNotify()
				Log('========')
				WW.IsNum(PortWeb) && new (require('ws')).Server({server : WebServer.listen(PortWeb)}).on('connection',OnSocket)
				WR.EachU((V,F) =>
				{
					V.S && MakeWish(F,V.Port)[PoolWishKeyUpdate](V.Host,V.Addr)
				},DataLink.O())
			}),
		Exp : X => (X || require('express').Router())
			.use((Q,S,N) => '/' === Q.path && !/\/(\?.*)?$/.test(Q.originalUrl) ? S.redirect(302,Q.baseUrl + Q.url) : N())
			.use((Q,S,N) => (Q = WebServerMap[Q.path.toUpperCase()]) ? S.sendFile(Q) : N()),
		Soc : OnSocket
	}
}