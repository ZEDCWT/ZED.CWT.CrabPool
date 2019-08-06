var
Wish = require('@zed.cwt/wish'),
Net = require('net'),

SocketOption = {allowHalfOpen : true},

ActionError = 'Err',
ActionHello = 'Hell',
ActionWish = 'Wish',
ActionTake = 'Take',
ActionPool = 'Pool';

module.exports = Option =>
{
	var
	Cipher = Option.Cipher,
	Decipher = Option.Decipher,
	PortMaster = Option.PortMaster,
	PortWeb = Option.PortWeb,
	PipeMaster = Option.Pipe,
	OnPool = Option.OnPool,
	IDPath = Option.ID || Wish.N.JoinP(Wish.N.Data,'ZED/CrabPool/ID'),
	Log = Wish.R.Default((...Q) => console.log(Wish.StrDate(),Wish.Tick(),'|',...Q),Option.Log),
	MakeLog = Wish.IsFunc(Log) ? H => (...Q) => Log(`[${H}]`,...Q) : () => Wish.O,

	MachineIDRaw,MachineID,
	IDSolve = Q => Wish.C.HEXS(Wish.C.SHA512(Q[1])),
	IDShort = Q => Q.slice(0,8),
	Counter = (Q = 0) => () => Wish.R.PadS0(4,Wish.R.HEX(Q++).toUpperCase()),

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
			Done = [T]
		}();
		Now.next()
		Pipe.on('data',Q => Done ? OnRaw(Done[0] ? Q : Buffer.from(D.D(Q))) : Now.next(Buffer.from(D.D(Q))))
		return {
			W : Q => Pipe.write(Q),
			D : Q => Pipe.write(Buffer.from(C.D(Q))),
			O : Q =>
			{
				Q = Wish.IsBuff(Q) ? Q : Buffer.from(Wish.IsObj(Q) ? Wish.C.OTJ(Q) : Q,'UTF8')
				Pipe.write(Buffer.concat(
				[
					Buffer.from(C.D([255 & Q.length,255 & Q.length >>> 8])),
					Buffer.from(C.D(Q))
				]))
			},
			F : () => Pipe.end()
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
						if (!Q[1]) return Err('Bad machine ID')
						MID = IDSolve(Q[1])
						Wish.R.Has(MID,Pool) && Pool[MID][PoolKeyPipe].destroy()
						Pool[MID] = O
						Sec.O([ActionHello])
						PoolNotify()
						Log('Node')
						break

					case ActionWish :
						if (!Wish.R.Has(MID = IDSolve(Q[1]),Pool)) return Err('Who are you')
						if (!Wish.R.Has(Q[2],Pool)) return Err('Who is that')
						PoolPartner[SessionID] = O
						Pool[Q[2]][PoolKeySec].O([ActionWish,MID,SessionID,Q[3],Q[4]])
						Log('Wish')
						return false
					case ActionTake :
						if (!Wish.R.Has(Q[1],PoolPartner)) return Err('Who is that')
						Partner = PoolPartner[Q[1]]
						Partner[PoolKeyOnPartner](O)
						Sec.O([ActionWish])
						Partner[PoolKeySec].O([ActionWish])
						Log('Take')
						return false

					case ActionError : Partner && Partner[PoolKeyPipe].destroy()
					default : S.destroy()
				}
			},Q => Partner && Partner[PoolKeySec].D(Q)),
			O =
			{
				[PoolKeySID] : SessionID,
				[PoolKeyIP] : `${S.remoteAddress}:${S.remotePort}`,
				[PoolKeyPipe] : S,
				[PoolKeySec] : Sec,
				[PoolKeyOnPartner](Q){Partner = Q}
			};
			S.on('error',Wish.O).on('close',E =>
			{
				Log('Closed',E)
				if (MID && Pool[MID] && SessionID === Pool[MID][PoolKeySID])
				{
					Wish.R.Del(MID,Pool)
					PoolNotify()
				}
				Partner && Partner[PoolKeyPipe].destroy()
			}).on('end',() => Partner && Partner[PoolKeyPipe].end())
			Log('Connected')
		}).listen(PortMaster || 0)
			.on('listening',() => MakeLog('MEZ','Listening',Master.address()));
	},

	//	Node
	PoolWish = {},
	Online,
	MakeQBH = () =>
	{
		var Count = Counter();
		Wish.X.Provider(O =>
		{
			var
			Log = MakeLog(`QBH ${Count()}`),
			S = PipeMaster(),
			Sec = MakeSec(S,Q =>
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
						MakeTake(Q)
						break

					case ActionError : Log(...Q)
					default : S.destroy()
				}
			});
			S.on('connect',() => Log('Connected') || Sec.O([ActionHello,MachineIDRaw]))
				.on('error',Wish.O)
				.on('close',E =>
				{
					Log('Closed',E)
					O.E()
				})
			Online = false
		}).Retry(1000).Now()
	},
	MakeWish = (Local,Target,Host,Port) =>
	{
		var Count = Counter();
		PoolWish[Local] = Net.createServer(SocketOption,S =>
		{
			if (Online)
			{
				var
				Log = MakeLog(`Wish ${Count()} ${IDShort(Target)} ${Host}:${Port}`),
				M = PipeMaster(),
				Sec = MakeSec(M,Q =>
				{
					switch (Q[0])
					{
						case ActionWish :
							Log('Granted')
							S.on('data',Sec.D)
							return false
						case ActionError : Log(...Q)
						default : S.destroy(),M.destroy()
					}
				},Q => S.write(Q));
				M.on('connect',() => Log('Connected'))
					.on('error',Wish.O)
					.on('close',E =>
					{
						Log('Closed',E)
						S.destroy()
					})
					.on('end',() => S.end())
				S.on('error',Wish.O)
					.on('close',E =>
					{
						Log('Fin',E)
						M.destroy()
					})
					.on('end',() => M.end())
				Sec.O([ActionWish,MachineIDRaw,Target,Host,Port])
			}
			else S.destroy()
		}).listen(Local)
	},
	MakeTake = Q =>
	{
		var
		Log = MakeLog(`Take ${IDShort(Q[1])} ${Q[3]}:${Q[4]} ${IDShort(Q[2])}`),
		S = new Net.Socket(SocketOption).connect(Q[4],Q[3]),
		M = PipeMaster(),
		Sec = MakeSec(M,Q =>
		{
			switch (Q[0])
			{
				case ActionWish :
					Log('ACK')
					S.on('data',Sec.D)
					return false
				case ActionError : Log(...Q)
				default : S.destroy(),M.destroy()
			}
		},Q => S.write(Q));
		M.on('connect',() => Log('Connected'))
			.on('error',Wish.O)
			.on('close',E =>
			{
				Log('Closed',E)
				S.destroy()
			})
			.on('end',() => S.end())
		S.on('error',Wish.O)
			.on('close',E =>
			{
				Log('Fin',E)
				M.destroy()
			})
			.on('end',() => M.end())
		Sec.O([ActionTake,Q[2]])
	};

	return Wish.N.FileR(IDPath)
		.ErrAs(() => Wish.N.MakeDir(Wish.N.DirN(IDPath))
			.FMapL(() => Wish.N.FileW(IDPath,Wish.Key(320)))
			.FMapL(() => Wish.N.FileR(IDPath)))
		.Map(Q =>
		{
			MachineID = IDSolve(MachineIDRaw = Wish.C.HEXS(Wish.C.SHA512(Q)))
			Log(MachineID)
			if (PipeMaster) MakeQBH()
			else MakeMEZ()
		})
}