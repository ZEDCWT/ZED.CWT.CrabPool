var
Wish = require('@zed.cwt/wish'),
Log4JS = require('log4js'),
Net = require('net'),

SocketOption = {allowHalfOpen : true},

ActionError = 'Err',
ActionHello = 'Hell',
ActionWish = 'Wish',
ActionTake = 'Take',
ActionPool = 'Pool',
ActionTick = 'Tick';

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
	OnPool = Option.OnPool,
	PathData = Option.Data || Wish.N.JoinP(Wish.N.Data,'ZED/CrabPool'),
	PathLog = Wish.N.JoinP(PathData,'Log'),
	Log = Option.Log,
	MakeLog = H => Wish.IsFunc(Log) ? (...Q) => Log(`[${H}]`,...Q) : Wish.O,

	FileID = Wish.N.JoinP(PathData,'ID'),

	MachineIDRaw,MachineID,
	IDSolve = Q => Wish.C.HEXS(Wish.C.SHA512(Q[1])),
	IDShort = Q => Q.slice(0,8),
	Counter = (Q = 0) => () => Wish.R.PadS0(4,Wish.R.Radix(36,Q++).toUpperCase()),

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
		OnPool && OnPool(T)
	},
	PoolPartner = {},
	MakeMEZ = () =>
	{
		var
		Count = Counter(),
		Master = Net.createServer(SocketOption,S =>
		{
			var
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
				Log('Closed',E)
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
		Log = MakeLog(`Take ${IDShort(MID)} ${Host}:${Port} ${O[PoolKeySID]}`),
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
				Log('Fin',E)
				O[PoolKeyPipe].destroy()
			})
			.on('end',() => O[PoolKeyPipe].end())
			.on('data',O[PoolKeySec].D)
		O[PoolKeySec].O([ActionWish])
		Log('ACK')
	},

	//	Node
	Online,
	MakePipeLog,
	MakePipe = (Q,S) => Wish.X.Just()
		.FMap(() => Wish.X.IsProvider(Q = PipeMaster(Q,MakePipeLog)) ? Q : Wish.X.Just(Q))
		.FMap(M => Wish.X.Provider(O => S(M,O))),
	MakeQBH = () =>
	{
		var Count = Counter();
		MakePipe(true,(M,O) =>
		{
			var
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
						OnPool && OnPool(Q[1])
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
					Log('Closed',E)
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
				Log('Closed',E)
				Sec.E()
				O.F()
			})
			.on('end',() => S.end())
		S.on('error',Wish.O)
			.on('timeout',O.F)
			.on('close',E =>
			{
				Log('Fin',E)
				O.F()
			})
			.on('end',() => M.end())
		Sec.O([ActionTake,MachineIDRaw,Q[1]])
		Sec.E()
		return () => M.destroy() | S.destroy()
	}).Now(null,Wish.O),

	//	Wish
	PoolWish = {},
	MakeWish = (Local,Target,Host,Port) =>
	{
		var Count = Counter();
		PoolWish[Local] = Net.createServer(SocketOption,S =>
		{
			var
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
							Log('Closed',E)
							Sec.E()
							O.F()
						})
						.on('end',() => S.end())
					S.setTimeout(Timeout)
						.on('timeout',O.F)
						.on('close',E =>
						{
							Log('Fin',E)
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
									Log('Fin',E)
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
			.on('listening',() => MakeLog(`Wish ${IDShort(Target)} ${Host}:${Port}`)('Deployed'))
	};

	if (null == Log)
	{
		Log = Log4JS.configure(
		{
			appenders : {O :
			{
				type : 'dateFile',
				filename : Wish.N.JoinP(PathLog,'Event.log'),
				pattern : '.yyyy.MM.dd',
				keepFileExt : true,
				layout :
				{
					type : 'pattern',
					pattern : '%x{O} | %m',
					tokens : {O : () => Wish.StrDate() + ' | ' + Wish.Tick()}
				}
			}},
			categories :
			{
				default : {appenders : ['O'],level : 'all'}
			}
		}).getLogger('O')
		Log = Log.debug.bind(Log)
	}
	MakePipeLog = MakeLog('Pipe')

	return Wish.N.MakeDir(PathLog)
		.FMap(() => Wish.N.FileR(FileID))
		.ErrAs(() => Wish.N.FileW(FileID,Wish.Key(320))
			.FMap(() => Wish.N.FileR(FileID)))
		.Map(Q =>
		{
			MachineID = IDSolve(MachineIDRaw = Wish.C.HEXS(Wish.C.SHA512(Q)))
			Log(MachineID)
			PipeMaster ? MakeQBH() : MakeMEZ()
		})
}