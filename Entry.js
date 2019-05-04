var
Wish = require('@zed.cwt/wish'),
Util = require('./Util'),
Crypto = require('crypto'),

Net = require('net');

module.exports = Option =>
{
	var
	MasterAddr = Option.MasterAddr,
	MasterPort,
	CipherAlgo = Option.CipherAlgo,
	CipherKey = Option.CipherKey,
	CipherIV = Option.CipherIV,
	PortMaster = Option.PortMaster,
	PortControl = Option.PortServer,
	Log = Wish.R.Default((...Q) => console.log(Wish.StrDate(),Wish.Tick(),'|',...Q),Option.Log),
	MakeLog = Wish.IsFunc(Log) ? H => (...Q) => Log(H,...Q) : Wish.Noop,

	MakeCipher = () => Crypto.createCipheriv(CipherAlgo,CipherKey,CipherIV),
	MakeDecipher = () => Crypto.createDecipheriv(CipherAlgo,CipherKey,CipherIV),


	Master,
	PoolByMachine = {},
	PoolBySession = {},

	SessionID,
	TouchMaster = () =>
	{
		var
		Log = MakeLog('[Control]'),
		S = new Net.Socket,
		R = Util.MakeReader(Q =>
		{
			switch (Q[0])
			{
				case 'Hell' :
					SessionID = Q[1]
					Log('Session',SessionID)
					break
				case 'Make' :
					MakePlug(...Q[1])
					break
				default :
					'Err' === Q[0] && Log(...Q)
					S.destroy()
			}
		}),
		W = Util.WrapCipher(S,MakeCipher(),MakeDecipher(),Q => R.next(Q),Wish.Noop),
		D = Util.WrapFeeder(W.W);
		S.connect(...Util.SolveAddr(MasterAddr))
			.on('connect',() => Log('Connected'))
			.on('error',Wish.Noop)
			.on('close',E =>
			{
				Log('Closed',E)
				SessionID = null
				setTimeout(TouchMaster,5E3)
			})
		D(['Hell','0x80'])
	},

	MakeTunnel = (Deploy,Target,Host,Port) =>
	{
		var
		Log = MakeLog(`[Tunnel ${Target} ${Host}:${Port}]`),
		Tunnel = Net.createServer(S =>
		{
			if (SessionID)
			{
				var
				M = new Net.Socket({allowHalfOpen : true}),
				R = Util.MakeReader(Q =>
				{
					switch (Q[0])
					{
						case 'Make' :
							S.on('data',W.W).on('end',W.E)
							return false
						default :
							'Err' === Q[0] && Log(...Q)
							S.destroy()
							M.destroy()
					}
				},Q => S.write(Q)),
				W = Util.WrapCipher(M,MakeCipher(),MakeDecipher(),Q => R.next(Q),() => S.end()),
				D = Util.WrapFeeder(W.W);
				M.connect(...Util.SolveAddr(MasterAddr))
					.on('connect',() => Log('Master Connected'))
					.on('error',Wish.Noop)
					.on('close',E =>
					{
						Log('Master Closed',E)
						S.destroy()
					})
				S.on('error',Wish.Noop)
					.on('close',E =>
					{
						Log('Socket Closed',E)
						M.destroy()
					})
				D(['Make',SessionID,Target,Host,Port])
			}
			else S.destroy()
		}).on('listening',() => Log('Listening'))
			.listen(Deploy)
	},
	MakePlug = (SessionID,Host,Port) =>
	{
		var
		Log = MakeLog(`[Plug ${Host}:${Port} ${SessionID}]`),
		Plug = new Net.Socket({allowHalfOpen : true}),
		Target = new Net.Socket({allowHalfOpen : true}),
		W = Util.WrapCipher(Plug,MakeCipher(),MakeDecipher(),Q => Target.write(Q),() => Target.end()),
		D = Util.WrapFeeder(W.W);
		Plug.connect(...Util.SolveAddr(MasterAddr))
			.on('connect',() => Log('Master Connected'))
			.on('error',Wish.Noop)
			.on('close',E =>
			{
				Log('Master Closed',E)
				Target.destroy()
			})
		Target.connect(Port,Host)
			.on('connect',() => Log('Target Connected'))
			.on('data',W.W)
			.on('end',W.E)
			.on('error',Wish.Noop)
			.on('close',E =>
			{
				Log('Plug Closed',E)
				Plug.destroy()
			})
		D(['Plug',SessionID])
	};

	if (MasterAddr) TouchMaster()
	else
	{
		Master = Net.createServer({allowHalfOpen : true},S =>
		{
			var
			Log = MakeLog(`[Master ${S.remoteAddress}:${S.remotePort}]`),
			MachineID,
			SessionID = Util.MakeID(),
			Err = Q =>
			{
				D(['Err',Q])
				S.destroy()
			},
			Partner,PartnerWrite,
			R = Util.MakeReader(Q =>
			{
				switch (Q[0])
				{
					case 'Hell' :
						Wish.R.Has(MachineID = Q[1],PoolByMachine) && PoolBySession[PoolByMachine[MachineID]].Socket.destroy()
						if (!MachineID) return Err('Bad machine ID')
						PoolByMachine[MachineID] = SessionID
						D(['Hell',SessionID])
						break
					case 'Make' :
						if (!Wish.R.Has(Q[1],PoolBySession)) return Err('Who are you')
						if (!Wish.R.Has(Q[2],PoolByMachine)) return Err('Who is that')
						PoolBySession[PoolByMachine[Q[2]]].Data(['Make',[SessionID,Q[3],Q[4]]])
						return false
					case 'Plug' :
						if (!Wish.R.Has(Q[1],PoolBySession)) return Err('Who is that')
						Q[1] = PoolBySession[Q[1]]
						Q[1].Data(['Make'])
						Partner = Q[1].Socket
						PartnerWrite = Q[1].Write
						Q[1].Partner(S,W.W)
						return false
					default :
						S.destroy()
				}
			},Q => Partner && PartnerWrite(Q)),
			W = Util.WrapCipher(S,MakeCipher(),MakeDecipher(),
				Q => Partner ? PartnerWrite(Q) : R.next(Q),
				() => Partner && Partner.end()),
			D = Util.WrapFeeder(W.W);
			PoolBySession[SessionID] =
			{
				Socket : S,
				Write : W.W,
				Data : D,
				Partner : (Q,S) =>
				{
					Partner = Q
					PartnerWrite = S
				},
				MachineID : () => MachineID
			}
			S.on('error',Wish.Noop)
				.on('close',E =>
				{
					Log('Closed',E)
					PoolByMachine[MachineID] === SessionID && delete PoolByMachine[MachineID]
					delete PoolBySession[SessionID]
					Partner && Partner.destroy()
				})
			Log('Connected',SessionID)
		}).on('listening',() => Log('[Master]','Listening',Master.address()))
			.listen(PortMaster || 0)
	}
}