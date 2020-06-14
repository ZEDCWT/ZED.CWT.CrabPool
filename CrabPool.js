'use strict'
var
WW = require('@zed.cwt/wish'),
{R : WR,X : WX,C : WC,N : WN} = WW,
HTTP = require('http'),
Net = require('net'),

BuffFrom = Buffer.from,
BuffCat = Buffer.concat,

SocketOption = {allowHalfOpen : true},

ActionHello = 'Hell',
ActionPing = 'Ping',
ActionPong = 'Pong',
ActionWish = 'Wish',
ActionTake = 'Take',
ActionWishAux = 'WishX',
ActionTakeAux = 'TakeX',
ActionAuxKill = 'AuxK',
ActionPool = 'Pool',
ActionPoolEdit = 'PoolEdit',
ActionPoolDel = 'PoolDel',
ActionTick = 'Tick',
ActionExt = 'Ext',
ActionExtClip = 'ExtClip',
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
ActionWebExt = 'Ext',
ActionWebExtClip = 'ExtClip',
ActionWebError = 'Err';

module.exports = Option =>
{
	var
	Cipher = Option.Cipher,
	Decipher = Option.Decipher,
	PortMaster = Option.PortMaster,
	PortWeb = Option.PortWeb,
	PipeMaster = Option.Pipe,
	Aux = WR.Default(true,Option.Aux),
	Retry = Option.Retry || 1E4,
	Timeout = WR.Default(3E5,Option.Timeout),
	TickInterval = Option.Tick || 2E4,
	PathData = Option.Data || WN.JoinP(WN.Data,'ZED/CrabPool'),
	PathLog = WN.JoinP(PathData,'Log'),
	Log = Option.Log,
	MakeLog = H => WW.IsFunc(Log) ? (...Q) => Log(`[${H}]`,...Q) : WW.O,

	Feature =
	{
		Aux,
	},

	PathWeb = WN.JoinP(__dirname,'Web'),
	FileID = WN.JoinP(PathData,'ID'),
	FileToken = WN.JoinP(PathData,'Key'),

	DataPool = WN.JSON(WN.JoinP(PathData,'Pool')),
	DataLink = WN.JSON(WN.JoinP(PathData,'Link')),
	DataLinkS = WN.JSON(WN.JoinP(PathData,'LinkS')),
	DataExtClip = WN.JSON(WN.JoinP(PathData,ActionWebExtClip),[]),

	MachineIDRaw,MachineID,
	IDSolve = Q => WC.HEXS(WC.SHA512(Q)),
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

	ToD = Q => Q.D || (S => Q.data(S)),
	MakeSec = (Pipe,OnData,OnRaw) =>
	{
		var
		C = ToD(Cipher()),D = ToD(Decipher()),

		Cache = [],CacheLen = 0,
		Take = function*(Q,R)
		{
			for (;CacheLen < Q;)
			{
				Cache.push(yield)
				CacheLen += Cache[~-Cache.length].length
			}
			if (1 < Cache.length) Cache[0] = BuffCat(Cache),Cache.length = 1
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
				T = 256 * T[1] + T[0],
				// Apparently, 7 bytes are not enough for a JSON message `[_,[],_]`
				T = 7 < T ?
					OnData(WC.JTOO((yield* Take(T)).toString('UTF8'))[1] || []) :
				(
					T = yield* Take(2),
					OnData(yield* Take(256 * T[1] + T[0]))
				),
				null == T
			;);
			Tick.F()
			Done = [T]
			CacheLen && OnRaw(T ? Cache[0] : BuffFrom(D(Cache[0])))
			Cache = CacheLen = Take = Now = null
		}(),

		W = Q => Pipe && Pipe.writable && Pipe.write(Q),
		Pad = () => WW.Rnd(2) ?
			WW.Rnd(3E16,9E16) :
			WW.Key(WW.Rnd(20,40)),
		O = Q =>
		{
			Q = BuffFrom(WC.OTJ([Pad(),Q,Pad()]),'UTF8')
			W(BuffFrom(C([255 & Q.length,255 & Q.length >>> 8]).concat(C(Q))))
		},
		OnEnd = new Set,
		Tick = WW.To(TickInterval,() => Pipe.writable && O([ActionTick]),true);

		Now.next()
		Pipe.on('error',WW.O)
			.on('data',Q => Done ?
				OnRaw(Done[0] ? Q : BuffFrom(D(Q))) :
				Now.next(BuffFrom(D(Q))))
			.on('close',() =>
			{
				WR.Each(V =>
				{
					V()
				},OnEnd,OnEnd = new Set)
			})
		return {
			O,
			D : Q => W(BuffFrom(C(Q))),
			F : () => Pipe && Pipe.end(),
			E : T =>
			{
				if (T = Pipe)
				{
					Pipe = null
					Tick.F()
					T.destroy()
				}
			},
			U : Q => W(BuffFrom(C([0,0,255 & Q.length,255 & Q.length >>> 8]).concat(C(Q)))),
			W : (Q,S) =>
			{
				S ?
					OnEnd.add(Q) :
					OnEnd.delete(Q)
			},
			C : Tick.F
		}
	},

	AuxIDBuff = (Q,R = []) =>
	{
		for (;
			R.push(Q % 128 + 128 * (127 < Q)),
			Q = Math.floor(Q / 128)
		;);
		return BuffFrom(R)
	},
	MakeAux = () =>
	{
		var
		AuxID = 0,
		Pool = {};
		return {
			Raw : S =>
			{
				var
				ID,
				To = WW.To(Timeout,() =>
				{
					To = null
					ID && WR.Del(ID,Pool)
					S.destroy()
					S = null
				}),
				R =
				{
					ID : () =>
					{
						Pool[ID = WW.Key(32)] = R
						return ID
					},
					I : O => S.on('end',O.F)
						.on('data',Q => To.D(O.D(Q)))
						.on('close',O.E),
					D : Q => S && To.D(S.write(Q)),
					F : () => S && S.end(),
					E : () => To && To.F().C(),
				};
				S.on('error',WW.O)
				return R
			},
			Sec : (M,H) =>
			{
				var
				ID,P,
				S,
				To = WW.To(Timeout,() =>
				{
					M = P = To = null
					ID && WR.Del(ID,Pool)
					S.E()
					S = null
				}),
				R =
				{
					P : Q => Pool[ID = Q] = R,
					I : O =>
					{
						M.on('end',O.F)
							.on('close',O.E)
						P = O
					},
					D : Q => S && To.D(S.D(Q)),
					F : () => S && S.F(),
					E : () => To && To.F().C(),
					O : Q => S && To.D(S.O(Q)),
				};
				R.H = S = MakeSec(M,Q => H(Q,To.D()),Q => P && To.D(P.D(Q)))
				return R
			},
			Aux : S =>
			{
				var
				P,
				ID = AuxID++,
				IDU,IDB,
				Size = 65535,
				To = WW.To(Timeout,() =>
				{
					IDB && S.O([ActionAuxKill,IDU])
					S.W(OnEnd,false)
					S = To = null
					WR.Del(ID,Pool)
					P && P.E()
					P = null
				}),
				OnEnd = () => To && To.F().C(),
				R =
				{
					ID : ID,
					I : O => P = O,
					D : (Q,F) =>
					{
						if (S && IDB) for (To.D(F = 0);F < Q.length;)
							S.U(BuffCat([IDB,Q.slice(F,F += Size)]))
					},
					F : () => S && IDB && S.U(IDB),
					E : OnEnd,
					U : Q => (Size -= (IDB = AuxIDBuff(R.IDU = IDU = Q)).length,R),
					X : Q => P && (Q.length ? To.D(P.D(Q)) : P.F()),
					O : Q => S && S.O(Q),
				};
				S.W(OnEnd,true)
				return Pool[ID] = R
			},
			Link : (Q,S) =>
			{
				Q.I(S)
				S.I(Q)
			},
			X : Q => Pool[Q],
			U : Q =>
			{
				var
				ID = 0,
				F = 0;
				for (;
					ID += Q[F] % 128 * 128 ** F,
					127 < Q[F++]
				;);
				ID = Pool[ID]
				ID && ID.X(Q.slice(F))
			}
		}
	},
	AuxPool = MakeAux(),
	MakeAuxRaw = (H,P) => AuxPool.Raw(Net.createConnection({host : H,port : P,...SocketOption})),

	//	Master
	Pool = {},
	PoolO = Q => WR.Each(V => V.Sec.O(Q),Pool),
	PoolNotify = T =>
	{
		DataPool.S()
		T = DataPool.O()
		PoolO([ActionPool,T])
		OnPool(T)
	},
	MEZErrMIDUnk = 'Who are you',
	MEZErrMIDDup = 'You are not unique',
	MEZErrSIDUnk = 'Who is that',
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
			Err = Q => Sec.O([ActionError,Q]) || Sec.E(),
			Record,
			Ping = MakePing(Q => Sec.O([ActionPing,Q]),Q =>
			{
				DataPing[MID] = Q
				PoolO([ActionPing,MID,Q])
				WebSocketSend([ActionWebPing,MID,Q])
			}),
			Sec = AuxPool.Sec(S,Q =>
			{
				if (WW.IsBuff(Q)) return AuxPool.U(Q)
				var K = Q[1],E = Q[2];
				switch (Q[0])
				{
					case ActionHello :
						if (!K) return Err(MEZErrMIDUnk)
						MID = IDSolve(K)
						if (MID === MachineID) return Err(MEZErrMIDDup)

						WR.Has(MID,Pool) &&
						(
							Pool[MID].Sec.O([ActionError,MEZErrMIDDup]),
							Pool[MID].Sec.E()
						)
						E && (O.Feat = E)
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

						Sec.O([ActionHello,MachineID,Feature])
						PoolNotify()
						Log('Node')
						Sec.O([ActionPing,DataPing])
						Sec.O([ActionExt,ActionExtClip,DataExtClip.D(0)])
						WebSocketSend([ActionWebPing,DataPing])
						Ping.R()
						break
					case ActionPing :
						Sec.O([ActionPong,K])
						break
					case ActionPong :
						Ping.O(K)
						break

					case ActionWish :
						if (!WR.Has(MID = IDSolve(K),Pool)) return Err(MEZErrMIDUnk)
						if (E === MachineID)
						{
							E = MakeAuxRaw(Q[3],Q[4])
							AuxPool.Link(E,Sec)
							Sec.O([ActionWish])
						}
						else
						{
							if (!WR.Has(E,Pool)) return Err(MEZErrSIDUnk)
							Sec.P(SessionID)
							MEZToWish(SessionID,E,MID,Q[3],Q[4])
						}
						Sec.H.C()
						Log('Wish')
						return false
					case ActionTake :
						if (!WR.Has(MID = IDSolve(K),Pool)) return Err(MEZErrMIDUnk)
						E = AuxPool.X(E)
						if (!E) return Err(MEZErrSIDUnk)
						Sec.O([ActionWish])
						MEZToTake(E)
						AuxPool.Link(E,Sec)
						Sec.H.C()
						Log('Take')
						return false
					case ActionWishAux :
						if (K === MachineID)
						{
							K = MakeAuxRaw(Q[3],Q[4])
							E = AuxPool.Aux(Sec.H).U(E)
							AuxPool.Link(K,E)
							MEZToTake(E)
						}
						else
						{
							if (!WR.Has(K,Pool)) return Sec.O([ActionAuxKill,E])
							E = AuxPool.Aux(Sec.H).U(E)
							MEZToWish(E.ID,K,MID,Q[3],Q[4])
						}
						break
					case ActionTakeAux :
						K = AuxPool.X(K)
						E = AuxPool.X(E)
						if (!K || !E) return Sec.O([ActionAuxKill,Q[3]])
						E.U(Q[3])
						MEZToTake(K)
						AuxPool.Link(K,E)
						break
					case ActionAuxKill :
						if (K = AuxPool.X(K))
						{
							K.E()
							WW.IsObj(K.S) && K.S.E()
						}
						break

					case ActionPoolEdit :
						MEZPoolEdit(Q)
						break
					case ActionPoolDel :
						MEZPoolDel(Q)
						break

					case ActionTick : break

					case ActionExt :
						switch (K)
						{
							case ActionExtClip :
								MEZExtClip(E)
								break
						}
						break

					case ActionError :
					default : Sec.E()
				}
			}),
			O =
			{
				ID : SessionID,
				Sec,
				Feat : {},
			};
			S.on('close',E =>
			{
				Log('Closed',Timer(),E)
				Ping.F()
				Sec.E()
				if (MID && Pool[MID] && SessionID === Pool[MID].ID)
				{
					Record.S = 0
					Record.To = WW.Now()
					WR.Del(MID,Pool)
					PoolNotify()
				}
			})
			Log('Connected')
		}).listen(PortMaster || 0)
			.on('listening',() => MakeLog('MEZ')('Listening',Master.address().port));
	},
	MEZToWish = (ID,Target,MID,Host,Port) =>
	{
		Target = Pool[Target]
		Aux && Target.Feat.Aux ?
			Target.Sec.O([ActionWishAux,ID,MID,Host,Port,AuxPool.Aux(Target.Sec.H).ID]) :
			Target.Sec.O([ActionWish,String(ID),MID,Host,Port])
	},
	MEZToTake = S =>
	{
		WW.IsNum(S.IDU) ?
			S.O([ActionTakeAux,S.IDU,S.ID]) :
			S.O && S.O([ActionWish])
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
	MEZExtClip = Q =>
	{
		OnExtClip(DataExtClip.D(0,Q))
		PoolO([ActionExt,ActionExtClip,Q])
	},

	//	Node
	MEZSec,
	MEZFeature,
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
				if (WW.IsBuff(Q)) return AuxPool.U(Q)
				var K = Q[1],E = Q[2];
				switch (Q[0])
				{
					case ActionHello :
						Log('ONE')
						MEZID = K
						MEZFeature = E || {}
						MEZSec = Sec
						WebSocketSend([ActionWebMEZ,RemoteIP(M)])
						Ping.R()
						break
					case ActionPing :
						if (WW.IsObj(K)) WebSocketSend([ActionWebPing,DataPing = K],true)
						else if (WW.IsNum(E))
						{
							DataPing[K] = E
							WebSocketSend([ActionWebPing,K,E],true)
						}
						else Sec.O([ActionPong,K])
						break
					case ActionPong :
						Ping.O(K)
						break
					case ActionPool :
						OnPool(DataPool.O(K))
						break

					case ActionWish :
						MakePipe(false,(M,O) =>
						{
							var
							Log = MakeLog(`Take ${IDName(Q[2])} ${Q[3]}:${Q[4]}`),
							S = MakeAuxRaw(Q[3],Q[4]),
							Sec = AuxPool.Sec(M,Q =>
							{
								if (ActionWish === Q[0]) return false
								ActionError === Q[0] && Log(...Q)
								ActionTick === Q[0] || O.F()
							});
							Sec.O([ActionTake,MachineIDRaw,Q[1]])
							Sec.H.C()
							AuxPool.Link(S,Sec)
							return S.E
						}).Now(null,WW.O)
						break
					case ActionWishAux :
						E = MakeAuxRaw(Q[3],Q[4])
						Q = AuxPool.Aux(Sec).U(Q[5])
						Sec.O([ActionTakeAux,K,Q.IDU,Q.ID])
						AuxPool.Link(Q,E)
						break
					case ActionTakeAux :
						K = AuxPool.X(K)
						if (!K) return Sec.O([ActionAuxKill,E])
						K.U(E)
						AuxPool.Link(K,K.S)
						WR.Del('S',K)
						break
					case ActionAuxKill :
						if (K = AuxPool.X(K))
						{
							K.E()
							WW.IsObj(K.S) && K.S.E()
						}
						break

					case ActionTick : break

					case ActionExt :
						switch (K)
						{
							case ActionExtClip :
								OnExtClip(E)
								break
						}
						break

					case ActionError : Log(...Q)
					default : Sec.E()
				}
			});
			Log('BIN')
			M.on('close',E =>
			{
				Log('COD',Timer(),E)
				MEZSec = false
				WebSocketSend([ActionWebMEZ,false])
				Ping.F()
				Sec.E()
				O.E()
			})
			Sec.O([ActionHello,MachineIDRaw,Feature])
		}).RetryWhen(Q => Q.Delay(Retry)).Now()
	},

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
			Log = MakeLog(`Wish ${IDShort(ID)} ${Count()} ${IDName(Target)} ${Host}:${Port}`),
			Sec;
			++State.Visit
			++State.Using
			State.Last = WW.Now()
			LinkSNotify()
			S = AuxPool.Raw(S.on('close',() => LinkSNotify(--State.Using)))
			PipeMaster ?
				MEZSec ?
					Aux && MEZFeature.Aux ?
					(
						Sec = AuxPool.Aux(MEZSec),
						MEZSec.O([ActionWishAux,Target,Sec.ID,Host,Port]),
						Sec.S = S
					) :
						MakePipe(false,(M,O) =>
						{
							Sec = AuxPool.Sec(M,Q =>
							{
								if (ActionWish === Q[0]) return AuxPool.Link(S,Sec),false
								ActionError === Q[0] && Log(...Q)
								ActionTick === Q[0] || O.F()
							})
							Sec.O([ActionWish,MachineIDRaw,Target,Host,Port])
							Sec.H.C()
							M.on('close',O.F)
							return S.E
						}).Now(null,S.E,S.E) :
					S.E() :
				Target === MachineID ?
					AuxPool.Link(S,MakeAuxRaw(Host,Port)) :
					WR.Has(Target,Pool) ?
						Pool[Target].Sec.O([ActionWish,S.ID(),MachineID,Host,Port]) :
						S.E()
		}).listen(Local)
			.on('listening',() =>
			{
				Log('DEP',State.Port = Server.address().port)
				LinkSNotify()
				WebSocketSend([ActionWebLinkError,ID])
			})
			.on('close',() => Log('COD',Timer()))
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
		if (!WW.IsObj(State))
		{
			DataLinkS.D(ID,State =
			{
				Visit : 0,
				Using : 0,
				Port : -9
			})
		}
		State.Port = -1
		State.Using = 0
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
	WebServerMap =
	{
		'/' : WN.JoinP(PathWeb,'Entry.htm'),
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
	}).on('listening',() => MakeLog('Web')('Deployed at',WebServer.address().port)),
	WebSocketCount = Counter(),
	WebSocketPool = new Set,
	WebSocketPoolSuicide = new Set,
	WebSocketLast = {[ActionWebPool] : [ActionWebPool,DataPool.O()]},
	WebSocketSend = (Q,S) =>
	{
		if (!S) WebSocketLast[Q[0]] = Q
		WebSocketPool.forEach(V => V(Q))
	},
	OnPool = Q => WebSocketSend([ActionWebPool,Q]),
	OnExtClip = Q => WebSocketSend([ActionWebExt,ActionWebExtClip,DataExtClip.D(0,Q)]),
	OnSocket = (S,H) =>
	{
		var
		Log = MakeLog(`WebSocket ${WebSocketCount()} ${RemoteIP(H.connection)}`),
		Timer = MakeTime(),
		Cipher = WC.AESES(WebToken,WebToken,WC.CFB),
		Decipher = WC.AESDS(WebToken,WebToken,WC.CFB),
		Send = D =>
		{
			D = Cipher.D(WC.OTJ([WW.Key(WW.Rnd(20,40)),D,WW.Key(WW.Rnd(20,40))]))
			try{S.send(BuffFrom(D))}catch(_){}
		},
		Suicide = () => S.terminate(),
		Wait = WW.To(Timeout,Suicide);

		Log('Accepted')
		S.on('message',(Q,T) =>
		{
			var
			Err = S => Send([ActionWebError,Q[0],S]),
			K,O,
			CheckOnline = () => MEZSec || Err('Master is not connected'),
			CheckLink = S =>
				!S[1] ? Err('Host is required') :
				!DataPool.D(S[1]) ? Err('Invalid host') :
				!S[2] ? Err('Address is required') :
				!WW.IsSafe(S[3] = +S[3]) || S[3] < 0 || 65535 < S[3] ? Err('Port should be a number in range [0,65535]') :
				true;

			if (!WW.IsBuff(Q)) return
			Wait.D()
			Q = Decipher.D(Q)
			Q = WC.JTOO(WC.U16S(Q))
			if (!WW.IsArr(Q) || !WW.IsArr(Q = Q[1])) return Suicide()
			K = Q[1]
			O = Q[2]
			switch (Q[0])
			{
				case ActionWebHello :
					if (WC.HEXS(TokenStepB(WC.B91P(K))) !== WC.HEXS(WebToken)) return Suicide()
					Send([ActionWebHello,MachineID,!PipeMaster])
					WR.Each(Send,WebSocketLast)
					Send([ActionWebPing,DataPing])
					WebSocketPool.add(Send)
					WebSocketPoolSuicide.add(Suicide)
					break

				case ActionWebToken :
					if (WC.HEXS(TokenStepB(WC.B91P(K))) === WC.HEXS(WebToken))
						WN.FileW(FileToken,WC.B91S(TokenStepB(WC.B91P(O))))
							.FMap(() => WN.FileR(FileToken))
							.Now(Q =>
							{
								WebToken = WC.B91P(Q)
								Send([ActionWebToken,'New token saved! Connect again'])
								WebSocketPoolSuicide.forEach(V => V())
							},() => Err('Failed to save the new token'))
					else Err('Original token is incorrect')
					break

				case ActionWebPoolEdit :
					PipeMaster ?
						CheckOnline() && MEZSec.O([ActionPoolEdit,K,O,Q[3]]) :
						MEZPoolEdit(Q)
					break
				case ActionWebPoolDel :
					PipeMaster ?
						CheckOnline() && MEZSec.O([ActionPoolDel,K]) :
						MEZPoolDel(Q)
					break

				case ActionWebLinkAdd :
					if (CheckLink(Q))
					{
						DataLink.D(T = WW.Key(32),
						{
							S : 9,
							Boom : WW.Now(),
							Host : K,
							Addr : O,
							Port : Q[3]
						})
						DataLinkS.D(T,
						{
							Visit : 0,
							Using : 0,
							Port : -9
						})
						MakeWish(T,Q[3])[PoolWishKeyUpdate](K,O)
						LinkNotify()
						LinkSNotify()
					}
					break
				case ActionWebLinkEdit :
					if (CheckLink(Q))
					{
						if (T = DataLink.D(Q[4]))
						{
							if (T.S && T.Port !== Q[3])
							{
								PoolWish[Q[4]][PoolWishKeyKill]()
								MakeWish(Q[4],Q[3])
							}
							T.Host = K
							T.Addr = O
							T.Port = Q[3]
							T.S && PoolWish[Q[4]][PoolWishKeyUpdate](T.Host,T.Addr)
							LinkNotify()
						}
						else Err('Unable to edit nonexistent links')
					}
					break
				case ActionWebLinkSwitch :
					if ((T = DataLink.D(K)) && !O !== !T.S)
					{
						if (T.S = O ? 9 : 0)
							MakeWish(K,T.Port)[PoolWishKeyUpdate](T.Host,T.Addr)
						else
						{
							PoolWish[K][PoolWishKeyKill]()
							WR.Del(K,PoolWish)
							DataLinkS.D(K).Port = -1
							LinkSNotify()
						}
						LinkNotify()
					}
					else Err('Invalid host')
					break
				case ActionWebLinkDel :
					if (T = DataLink.D(K))
					{
						if (T.S)
						{
							PoolWish[K][PoolWishKeyKill]()
							WR.Del(K,PoolWish)
						}
						DataLink.D(K,null)
						DataLinkS.D(K,null)
						LinkNotify()
					}
					break

				case ActionWebExt :
					switch (K)
					{
						case ActionWebExtClip :
							PipeMaster ?
								CheckOnline() && MEZSec.O([ActionExt,ActionExtClip,O]) :
								MEZExtClip(O)
							break
					}
					break

				default : Suicide()
			}
		}).on('close',E =>
		{
			Log('Closed',Timer(),E)
			WebSocketPool.delete(Send)
			WebSocketPoolSuicide.delete(Suicide)
			Wait.F()
		})
		try{S.send(MachineID)}catch(_){}
	};

	if (null == Log) Log = (H => (...Q) => H(WW.StrDate(),WW.Tick(),'|',...Q))
		(WN.RollLog({Pre : WN.JoinP(PathLog,'Event')}))
	WR.Each(V => V.S = 0,DataPool.O())

	return {
		Log,
		ID : () => MachineID,
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
				WebSocketSend([ActionWebExt,ActionWebExtClip,DataExtClip.D(0) || DataExtClip.D(0,'')])
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