'use strict'
var
WW = require('@zed.cwt/wish'),
{R : WR,X : WX,C : WC,N : WN} = WW,
Crypto = require('crypto'),
FS = require('fs'),
HTTP = require('http'),
Net = require('net'),

PlatArch = process.platform + ' ' + process.arch,
PoolVersion = require('./package.json').version,
IDFrom = 7999,
StatSpan = 36E5,
StatInterval = 5E3,
WebTimeout = 18E5,
DayMS = 864E5,
ErrorS = E => WW.IsObj(E) && WW.IsStr(E.stack) ?
	E.stack :
	E,
OTJApos = (...Q) => WC.OTJ(...Q,{Apos : true}),

Proto =
{
	Fatal : 0x4000,
	Err : 0x4002,
	Warn : 0x4004,

	Hello : 0x8000,
	Ping : 0x8002,
	Noise : 0x8004,

	PoolNm : 0x8200,
	PoolDes : 0x8202,
	PoolDel : 0x8204,

	Wish : 0x8400,
	Take : 0x8402,
	AuxFin : 0x8420,
	AuxEnd : 0x8422,
	AuxPR : 0x8424,
	WishR : 0x8440,
	TakeR : 0x8442,
	Ind : 0x8444,

	LinkNew : 0x8600,
	LinkOn : 0x8602,
	LinkOff : 0x8604,
	LinkMod : 0x8606,
	LinkDel : 0x8608,
	LinkInd : 0x860A,

	ExtSet : 0x8800,



	NodeStatus : 0xA000,
	TokenNew : 0xA002,
	RecReq : 0xA004,
	RecRes : 0xA006,
	RecCut : 0xA008,
	StatReq : 0xA00A,
	StatRes : 0xA00C,



	OnPoolLst : 0xCC00,
	OnPoolNew : 0xCC02,
	OnPoolNm : 0xCC04,
	OnPoolDes : 0xCC06,
	OnPoolOn : 0xCC08,
	OnPoolOff : 0xCC0A,
	OnPoolPing : 0xCC0C,
	OnPoolDel : 0xCC0E,
	OnPoolRec : 0xCC20,

	OnLinkLst : 0xCC40,
	OnLinkNew : 0xCC42,
	OnLinkOn : 0xCC44,
	OnLinkOff : 0xCC46,
	OnLinkCon : 0xCC48,
	OnLinkDis : 0xCC4A,
	OnLinkMod : 0xCC4C,
	OnLinkDel : 0xCC4E,
	OnLinkRec : 0xCC60,
	OnLinkDep : 0xCC62,
	OnLinkInd : 0xCC64,

	OnExtLst : 0xCC80,
	OnExtSet : 0xCC82,
},
ProtoInv = WR.Inv(Proto),
ProtoPB = FS.readFileSync(WN.JoinP(__dirname,'Proto.pb')),
ProtoJar = WC.PBJ().S(ProtoPB),
ProtoJSON = OTJApos(Proto,'	'),

ProtoEnc = (ProtoID,Data) => Data ? Buffer.from(ProtoJar.E(ProtoInv[ProtoID],Data)) : WC.Buff(0),
ProtoDec = (ProtoID,Data) => ProtoJar.D(ProtoInv[ProtoID],Data),
MakeProtoAct = (P,H) => (Sec,ProtoID,Data) =>
{
	var Act = H[ProtoID];
	if (Act)
		try
		{
			Sec.D()
			Act(P(ProtoID,Data))
		}
		catch(E)
		{
			Sec.F(`[${ProtoID}] ${ErrorS(E)}`)
		}
};

ProtoPB = OTJApos(WC.B91S(ProtoPB))



module.exports = Option =>
{
	var
	Cipher = Option.Cipher,
	Decipher = Option.Decipher,
	PortMaster = Option.PortMaster,
	PortWeb = Option.PortWeb,
	PipeMaster = Option.Pipe,
	PipeRetry = Option.PipeRetry || 1E4,
	TickInterval = Option.Tick || 6E4,
	PipeTimeout = Option.PipeTimeout || 2 * TickInterval,
	PathData = Option.Data || WN.JoinP(WN.Data,'ZED/CrabPool'),
	PathLog = WN.JoinP(PathData,'Log'),
	LogRoll,
	LogTop = Option.Log,
	MakeLog,
	RecordByte = Option.RecordByte,

	FileID = WN.JoinP(PathData,'ID'),
	FileToken = WN.JoinP(PathData,'Key'),

	DataSession = WN.JSON(WN.JoinP(PathData,'Session')),
	DataSessionKeyNodeStatus = 'Node',

	FeatureInd = 'Ind',
	Feature =
	[
		FeatureInd,
	],
	MachineIDSec,
	MachineIDSecHEX,
	MachineIDHEX,
	MachineRow,
	NodeStatus = {},
	WebToken,
	MakeSeed = () => WW.Rnd(0x4000000000000),
	MakeSeedBuf = () => Crypto.randomBytes(WW.Rnd(1,256)),
	MakeCount = (Q = 0) => () => WR.PadS0(4,Q++),
	MakeTime = (Q = WW.Now()) => () => WW.StrMS(WW.Now() - Q),
	MakeCD = H => H ?
		((S = H()) => Q => S.update(Q)) :
		(() => Q => Q),
	MakeCipher = MakeCD(Cipher),
	MakeDecipher = MakeCD(Decipher),
	MakePipeMasterCount = MakeCount(),
	MakePipeMaster = /**@type {(H : (S : import('net').Socket,O : WishNS.DEF<any>) => any,U? : boolean) => WishNS.Provider<any>}*/
		(H,U) => WX.Just()
			.FMap(() => WX.Any(PipeMaster(MakeLog(`Pipe ${MakePipeMasterCount()}`),U)))
			.FMap(S => WX.P(O => H(S,O))),

	ListRowFind = (List,Q) => WW.BSL(List,Q.Row,(Q,S) => Q.Row < S),
	ListRowNew = (List,Q) =>
	{
		!List.length || List[~-List.length].Row < Q.Row ?
			List.push(Q) :
			List.splice(ListRowFind(List,Q),0,Q)
	},
	ListRowDel = (List,Q) =>
	{
		Q = ListRowFind(List,Q)
		Q < List.length && List.splice(Q,1)
	},
	RemoteIP = Q => Q.remoteAddress + ':' + Q.remotePort,
	SolveReq = (Host,Port) => Host ? Host + ':' + Port : '' + Port,
	EndSocket = S =>
	{
		if (!S.destroyed)
		{
			S.end()
			S.destroy()
		}
	},
	StepA = Q => WC.HSHA512(Q,'NE##*(&J'),
	StepB = Q => WC.HSHA512('A5:;-)%M',Q),

	DB = require('./DB.SQLite')(
	{
		PathData,
	}),
	PoolID = IDFrom,
	PoolList = [],
	PoolMapID = {},
	PoolMapRow = {},
	PoolLocal =
	{
		F2T : 0,
		T2F : 0,
	},
	PoolSet = P =>
	{
		PoolList = P
		PoolMapID = {}
		PoolMapRow = {}
		WR.Each(V =>
		{
			PoolMapRow[V.Row] = V
			if (null != V.ID) PoolMapID[V.ID] = V
			WR.Del('ID',V)
		},P)
	},
	LinkPortMap = [{},{}],
	LinkShouldPause = P => !!LinkPortMap[1][P],
	LinkChecking,LinkCheckAll = new Set,
	LinkCheck = P =>
	{
		LinkCheckAll.add(P)
		LinkChecking = LinkChecking || setTimeout(() =>
		{
			LinkChecking = false
			LinkCheckAll.forEach(V =>
				WR.Each(B => B.PR(LinkShouldPause(V)),LinkPortMap[0][V]))
			LinkCheckAll.clear()
		},0)
	},
	LinkLocal =
	{
		Online : 9,
		Visit : 0,
		Last : null,
		F2T : 0,
		T2F : 0,
		Using : 0,
		Deploy : null,
		Err : null,
	},
	MakeLink = IsGlobal =>
	{
		var
		DBLink = IsGlobal ? DB.LinkGlobal : DB.Link,
		PortMap = LinkPortMap[IsGlobal ? 0 : 1],
		ID = IDFrom,
		List = [],
		Row = {},
		Server = {},
		PortAdd = (P,S) =>
		{
			if (P)
			{
				(PortMap[P] || (PortMap[P] = new Set)).add(S)
				IsGlobal || LinkCheck(P)
			}
		},
		PortDel = (P,S) =>
		{
			var L = P && PortMap[P];
			if (L)
			{
				L.delete(S)
				L.size || WR.Del(P,PortMap)
				IsGlobal || LinkCheck(P)
			}
		},
		New = Q =>
		{
			var S = Server[Q.Row];
			Row[Q.Row] = Q
			if (!S)
			{
				Server[Q.Row] =
				S = MakeLinkServer(IsGlobal,Q.Row)
			}
			PortAdd(Q.Local,S)
			S.D(Q,true)
			S.PR(IsGlobal && LinkShouldPause(Q.Local))
		},
		Del = Q =>
		{
			var S = Server[Q];
			if (S)
			{
				S.F()
				PortDel(S.L(),S)
				WR.Del(Q,Server)
				WR.Del(Q,Row)
			}
		},
		SetLst = L =>
		{
			var PrevRow = new Set(List.map(V => V.Row));
			LinkPortMap[IsGlobal ? 0 : 1] = PortMap = {}
			List = L
			Row = {}
			WR.Each(V =>
			{
				V.Using = V.Using || 0
				PrevRow.delete(V.Row)
				New(V)
			},L)
			PrevRow.forEach(Del)
		},
		WithL = H => Q =>
		{
			var L = Row[Q.Row];
			L && H(L,Q)
		},
		WithLS = H => Q =>
		{
			var L = Row[Q.Row],S = Server[Q.Row];
			L && S && H(L,S,Q)
		};
		return {
			All : () => List,
			Get : Q => Row[Q],
			Row : () => ++ID,
			Init : () => DBLink.All()
				.Tap(SetLst)
				.FMap(DBLink.Max)
				.Tap(B => ID = B || ID),
			Lst : Q => SetLst(Q.Link),
			New : Q =>
			{
				if (!Row[Q.Row])
				{
					WW.Merge(Q,LinkLocal)
					ListRowNew(List,Q)
					New(Q)
				}
			},
			On : WithLS((L,S) => S.O(L.Online = true)),
			Off : WithLS((L,S) => S.O(L.Online = false)),
			Ind : WithLS((L,S,Q) => S.I(L.Ind = Q.Ind)),
			Con : WithL((L,Q) =>
			{
				++L.Visit
				++L.Using
				L.Last = Q.At
			}),
			Dis : WithL(L =>
			{
				--L.Using
			}),
			Mod : WithLS((L,S,Q) =>
			{
				if (L.Local !== Q.Local)
				{
					PortDel(L.Local,S)
					PortAdd(Q.Local,S)
				}
				L.Local = Q.Local
				L.Target = Q.Target
				L.Host = Q.Host
				L.Port = Q.Port
				S.D(L,IsGlobal)
				IsGlobal && S.PR(LinkShouldPause(Q.Local))
			}),
			Del : Q =>
			{
				ListRowDel(List,Q)
				Del(Q.Row)
			},
			Rec : WithL((L,Q) =>
			{
				L.F2T += Q.F2T
				L.T2F += Q.T2F
			}),
		}
	},
	LinkGlobal = MakeLink(9),
	Link = MakeLink(0),
	RecID = IDFrom,
	RecCount = 0,
	StatAt,
	StatIn,
	StatOut,
	StatConn,
	StatFresh = () =>
	{
		StatAt = WW.Now()
		StatAt -= StatAt % StatSpan
		StatIn = StatOut = StatConn = 0
	},
	StatSave = () => OnStatRec({At : StatAt,In : StatIn,Out : StatOut,Conn : StatConn}),
	StatOnBefore = () =>
	{
		if (StatAt + StatSpan <= WW.Now())
		{
			StatSave()
			StatFresh()
		}
	},
	StatOnAfter = WR.ThrottleDelay(StatInterval,StatSave),
	StatOnIn = Q =>
	{
		StatOnBefore()
		StatIn += Q
		StatOnAfter()
	},
	StatOnOut = Q =>
	{
		StatOnBefore()
		StatOut += Q
		StatOnAfter()
	},
	StatOnConn = () =>
	{
		StatOnBefore()
		++StatConn
		StatOnAfter()
	},
	ExtMap = {},
	ExtGetLst = () => WR.ReduceU((D,V,F) => {D.push({Key : F,Val : V})},[],ExtMap),



	MakeSocHeaderBuf = Buffer.alloc(1024),
	MakeSec = (Soc,OnProto,OnAux) =>
	{
		var
		Corked = false,
		Online = true,
		Feat,Raw,
		C = MakeCipher(),D = MakeDecipher(),

		PoolData,PoolIn = 0,PoolOut = 0,
		PoolRecSave = () =>
		{
			if (PoolData)
			{
				SavePoolRec(PoolData,PoolOut,PoolIn)
				PoolIn = PoolOut = 0
			}
		},

		OnPR = new Map,
		OnFin = new Map,
		Paused = false,
		TOD = WW.TOD(PipeTimeout,() => R.F('Timeout')),
		Write = (ID,Data,Enc) =>
		{
			if (Soc.writable)
			{
				var T,F = 0;
				if (Raw)
				{
					T = Enc ? C(Data) : Data
				}
				else
				{
					for (T = Data.length;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
						MakeSocHeaderBuf[F - 1] |= 128
					for (T = ID;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
						MakeSocHeaderBuf[F - 1] |= 128
					for (T = ID + Data.length;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
						MakeSocHeaderBuf[F - 1] |= 128
					T = Buffer.concat(
					[
						C(MakeSocHeaderBuf.slice(0,F)),
						Enc ? C(Data) : Data
					])
				}
				if (!Soc.write(T) && !Paused)
				{
					Paused = true
					OnPR.forEach(V => V(true))
				}
				StatOnOut(F += Data.length)
				PoolOut += F
				PoolRecSave()
			}
		},
		Wait = WC.BW(),
		State = 0,
		StateID,StateLen,
		UV = 0,UVM = 1,
		ReadUV = () =>
		{
			var More = true,T;
			for (;
				(T = Wait.W(1)) &&
				(
					T = D(T),
					UV += UVM * (127 & T[0]),
					More = 127 < T[0]
				)
			;) UVM *= 128
			return More
		},

		Ind = {},

		R =
		{
			C : Q =>
			{
				if (Corked !== (Corked = !!Q))
					Corked ? Soc.cork() : Soc.uncork()
			},
			D : TOD.D,
			O : (ProtoID,Data) => Write(ProtoID,ProtoEnc(ProtoID,Data),true),
			B : (ProtoID,Data) => Write(ProtoID,Data,true),
			P : (AuxID,Data) => Write(1 + 2 * AuxID,Data,false),
			E : E => R.O(Proto.Err,{Msg : E}),
			F : E =>
			{
				R.Fat = ErrorS(E)
				R.O(Proto.Fatal,{Msg : E})
				Corked && Soc.uncork()
				EndSocket(Soc)
			},
			Fat : '',
			Pool : P => null == P ?
				PoolData :
				PoolData = P,
			Feat : Q => Feat ?
				Feat.has(Q) :
				Feat = new Set(Q || []),
			Paused : () => Paused,
			OnPR : (ID,PR) => PR ? OnPR.set(ID,PR) : OnPR.delete(ID),
			OnFin : (ID,Fin) => Fin ? OnFin.set(ID,Fin) : OnFin.delete(ID),
			S : Soc,
			Raw : AuxID =>
			{
				Raw = AuxID
				TOD.F()
				Soc.on('end',() => AuxOnEnd(R,AuxID))
			},
			Ind : (K,V) =>
			{
				var
				RecErr,
				Key,
				Fin;
				if (WW.IsFunc(V))
				{
					RecErr = AuxMakeRecErr(K)
					Key = Crypto.randomBytes(16).toString('HEX');
					Ind[Key] = V
					Fin = (S,E) =>
					{
						if ((!S || S === R) && RecErr)
						{
							OnRecOff(K)
							AuxPool.delete(K)
							WR.Del(Key,V)
							RecErr[AuxMakeRecErrKeyRec](E)
							RecErr = null
						}
					}
					R.OnFin(K,Fin)
					AuxPool.set(K,
					[
						false,
						Fin
					])
				}
				else if (Key = Ind[K])
				{
					WR.Del(K,Ind)
					Key(V)
				}
				return Key
			},
			IndHas : K => WR.Has(K,Ind),
			IndDel : K => WR.Del(K,Ind),
		};

		Soc
			.on('close',() =>
			{
				[...OnFin.values()].forEach(V => V(null,'Pipe Closed'))
				PoolRecSave()
				PoolData = null
				TOD.F()
			})
			.on('data',Q =>
			{
				StatOnIn(Q.length)
				PoolIn += Q.length
				PoolRecSave()
				if (Raw)
				{
					OnAux(R,Raw,Q)
					return
				}
				Wait.U(Q)
				for (;Online && !Raw && Q;)
					if (0 === State)
					{
						if (Q = !ReadUV())
						{
							StateLen = UV
							UV = 0
							UVM = 1
							State = 1
							// May add length check here to prevent memory drain
						}
					}
					else if (1 === State)
					{
						if (Q = !ReadUV())
						{
							StateID = UV
							UV = 0
							UVM = 1
							State = 2
						}
					}
					else if (2 === State)
					{
						if (Q = !ReadUV())
						{
							if (UV !== StateID + StateLen)
							{
								Q = false
								R.F(`Checksum failure ${StateID} + ${StateLen} != ${UV}`)
							}
							UV = 0
							UVM = 1
							State = 3
						}
					}
					else if (Q = Wait.W(StateLen))
					{
						if (1 & StateID)
							OnAux(R,(StateID - 1) / 2,Q)
						else
							OnProto(R,StateID,D(Q))
						State = 0
					}
				Online && Raw &&
					Wait.C() && OnAux(R,Raw,Wait.R())
			})
			.on('drain',() =>
			{
				Paused = false
				OnPR.forEach(V => V(false))
			})
		return R
	},
	MakeNoise = Sec =>
	{
		Sec.O(Proto.Noise,{Seed : MakeSeedBuf()})
	},



	AuxPool = new Map,
	AuxPoolKeyIsPipe = 0,
	AuxPoolKeyFin = 1,
	AuxPoolKeyData = 2,
	AuxPoolKeyEnd = 3,
	AuxPoolKeyPR = 4,
	AuxPoolKeyWaitTake = 2,
	AuxPipeFin = (Sec,AuxID,Err) => AuxID ?
		Sec.O(Proto.AuxFin,{ID : AuxID,Err}) :
		EndSocket(Sec.S),
	AuxPipeData = (Sec,AuxID,Data) => AuxID ?
		Sec.P(AuxID,Data) :
		Sec.P(0,Data),
	AuxPipeEnd = (Sec,AuxID) => AuxID ?
		Sec.O(Proto.AuxEnd,{ID : AuxID}) :
		Sec.S.end(),
	AuxPipePR = (Sec,AuxID,Pause) => AuxID ?
		Sec.O(Proto.AuxPR,{ID : AuxID,Pause}) :
		Pause ? Sec.S.pause() : Sec.S.resume(),
	AuxMakeRecKeyFin = 0,
	AuxMakeRecKeyIO = 1,
	AuxMakeRec = (ID,Begin,Link,IsPipePipe) =>
	{
		var
		IO = [0,0],IOLink = [0,0],
		Head = RecordByte ? WC.Buff(RecordByte) : null,
		HeadLen = 0,HeadOffset = 0,
		D,
		Save = () =>
		{
			OnRecRec(
			{
				Row : ID,
				Duration : WW.Now() - Begin,
				F2T : IO[0],
				T2F : IO[1],
				Head : HeadLen ?
					HeadLen < RecordByte ?
						WC.Slice(Head,0,HeadLen) :
						Head :
					null,
			})
			if (Link && IOLink[0] + IOLink[1])
			{
				OpLinkRec(Link[0],Link[1],IOLink[0],IOLink[1])
				IOLink[0] = IOLink[1] = 0
			}
		},
		Int = WW.To(StatInterval,Save,true);
		return [
			() =>
			{
				if (IO)
				{
					Int.F()
					Save()
					OnRecOff(ID)
					Head =
					D =
					Link =
					IO =
					IOLink =
					Int = null
				}
			},
			(Dir,Q) =>
			{
				IO[Dir] += Q.length
				IOLink[Dir] += Q.length
				if (RecordByte && HeadOffset < RecordByte && Q.length)
				{
					if (IsPipePipe)
					{
						D || (D = [null,null])
						D[Dir] || (D[Dir] = MakeDecipher())
						Q = D[Dir](Q)
					}
					Dir += 2 * Q.length
					for (;HeadOffset < RecordByte && (Dir = (Dir - (Head[HeadOffset++] = Dir % 128)) / 128);)
						Head[HeadOffset - 1] |= 128
					if (HeadOffset < RecordByte)
					{
						Head.set(RecordByte < HeadOffset + Q.length ?
							WC.Slice(Q,0,RecordByte - HeadOffset) :
							Q,HeadOffset)
						HeadLen = HeadOffset += Q.length
					}
					if (RecordByte <= HeadOffset)
						D = null
				}
			},
		]
	},
	AuxMakeRecErrSideClient = 0,
	AuxMakeRecErrSideServer = 1,
	AuxMakeRecErrKeyRec = 0,
	AuxMakeRecErrKeyErr = 1,
	AuxMakeRecErr = ID =>
	{
		var
		Online = true,
		Err = null;
		return [
			(E,S) =>
			{
				if (Online)
				{
					Online = false
					if (E)
					{
						Err = null == S ? E : `${S ? 'Server' : 'Client'} | ${E}`
						OnRecErr({Row : ID,Err})
					}
				}
			},
			() => Err
		]
	},
	AuxMakeRaw = (Host,Port) => Net.createConnection({host : Host,port : Port}),
	AuxMakeRawRaw = (ID,Begin,SocQ,SocS,IsGlobal,Row) =>
	{
		var
		Rec = AuxMakeRec(ID,Begin,[IsGlobal,Row]),
		RecErr = AuxMakeRecErr(ID),
		Fin = (S,E) =>
		{
			if (!S && SocQ)
			{
				RecErr[AuxMakeRecErrKeyRec](E)
				EndSocket(SocQ)
				EndSocket(SocS)
				AuxPool.delete(ID)
				Rec[AuxMakeRecKeyFin]()
				OnLinkDisconnect(IsGlobal,Row)
				Rec =
				SocQ =
				SocS = null
			}
		};
		SocQ.on('error',E => RecErr[AuxMakeRecErrKeyRec](E,AuxMakeRecErrSideClient))
			.on('close',() => Fin())
			.on('data',Q => Rec && Rec[AuxMakeRecKeyIO](0,Q))
			.pipe(SocS)
		SocS.on('error',E => RecErr[AuxMakeRecErrKeyRec](E,AuxMakeRecErrSideServer))
			.on('close',() => Fin())
			.on('data',Q => Rec && Rec[AuxMakeRecKeyIO](1,Q))
			.pipe(SocQ)
		AuxPool.set(ID,
		[
			false,
			Fin,
		])
		OnRecCon({Row : ID,At : WW.Now()})
	},
	AuxPRKeyFin = 0,
	AuxPRKeyPR = 1,
	AuxMakePR = (Sec,AuxID,OnPR) =>
	{
		var
		CurrentPaused = Sec.Paused(),
		NextPaused = false,
		Paused = CurrentPaused || NextPaused,
		OnChange = () =>
		{
			Paused === (Paused = CurrentPaused || NextPaused) ||
				OnPR(Paused)
		};
		Sec.OnPR(AuxID,P => OnChange(CurrentPaused = P))
		Paused && OnPR(Paused)
		return [
			() => Sec.OnPR(AuxID),
			P => OnChange(NextPaused = P),
		]
	},
	AuxMakeRawPipe = (ID,Begin,Soc,Sec,AuxID,RawIsFrom) =>
	{
		var
		C = MakeCipher(),D = MakeDecipher(),
		PR = AuxMakePR(Sec,AuxID,P => P ? Soc.pause() : Soc.resume()),
		Rec = AuxMakeRec(ID,Begin,RawIsFrom),
		RecErr = AuxMakeRecErr(ID),
		Paused = false,
		Fin = (S,E) =>
		{
			if ((!S || S === Sec) && Sec)
			{
				RecErr[AuxMakeRecErrKeyRec](E,S === Sec ?
					RawIsFrom ? AuxMakeRecErrSideServer : AuxMakeRecErrSideClient :
					null)
				EndSocket(Soc)
				S === Sec || AuxPipeFin(Sec,AuxID,RecErr[AuxMakeRecErrKeyErr]())
				AuxPool.delete(ID)
				PR[AuxPRKeyFin]()
				Rec[AuxMakeRecKeyFin]()
				Listener.forEach(V => Soc.off(...V))
				Sec.OnFin(ID)
				PR =
				Rec =
				Listener =
				Soc =
				Sec = null
			}
		},
		// https://github.com/nodejs/node/issues/38034
		Listener = WR.SplitAll(2,
		[
			'error',E => RecErr[AuxMakeRecErrKeyRec](E,
				RawIsFrom ? AuxMakeRecErrSideClient : AuxMakeRecErrSideServer),
			'close',() => Fin(),
			'data',Q =>
			{
				Rec[AuxMakeRecKeyIO](RawIsFrom ? 0 : 1,Q)
				AuxPipeData(Sec,AuxID,C(Q))
			},
			'end',() => AuxPipeEnd(Sec,AuxID),
			'drain',() => AuxPipePR(Sec,AuxID,Paused = false),
		]);
		Listener.forEach(V => Soc.on(...V))
		Sec.OnFin(ID,Fin)
		AuxPool.set(ID,
		[
			true,
			Fin,
			(S,Q) =>
			{
				if (S === Sec)
				{
					Q = D(Q)
					Rec[AuxMakeRecKeyIO](RawIsFrom ? 1 : 0,Q)
					if (!Soc.write(Q) && !Paused)
						AuxPipePR(Sec,AuxID,Paused = true)
				}
			},
			S => S === Sec && Soc.end(),
			(S,Pause) => S === Sec && PR[AuxPRKeyPR](Pause),
		])
		OnRecCon({Row : ID,At : WW.Now()})
	},
	AuxMakePipePipe = (ID,Begin,SecQ,AuxIDQ,SecS,AuxIDS) =>
	{
		var
		PRQ = AuxMakePR(SecQ,AuxIDQ,P => AuxPipePR(SecS,AuxIDS,P)),
		PRS = AuxMakePR(SecS,AuxIDS,P => AuxPipePR(SecQ,AuxIDQ,P)),
		Rec = AuxMakeRec(ID,Begin,null,true),
		RecErr = AuxMakeRecErr(ID),
		Fin = (S,E) =>
		{
			if ((!S || S === SecQ || S === SecS) && SecQ)
			{
				RecErr[AuxMakeRecErrKeyRec](E,
					S === SecQ ? AuxMakeRecErrSideClient :
					S === SecS ? AuxMakeRecErrSideServer :
					null)
				S === SecQ || AuxPipeFin(SecQ,AuxIDQ,RecErr[AuxMakeRecErrKeyErr]())
				S === SecS || AuxPipeFin(SecS,AuxIDS,RecErr[AuxMakeRecErrKeyErr]())
				AuxPool.delete(ID)
				PRQ[AuxPRKeyFin]()
				PRS[AuxPRKeyFin]()
				Rec[AuxMakeRecKeyFin]()
				SecQ.OnFin(ID)
				SecS.OnFin(ID)
				PRQ =
				PRS =
				Rec =
				SecQ =
				SecS = null
			}
		};
		SecQ.OnFin(ID,Fin)
		SecS.OnFin(ID,Fin)
		AuxPool.set(ID,
		[
			true,
			Fin,
			(S,Q) =>
			{
				if (S === SecQ)
				{
					Rec[AuxMakeRecKeyIO](0,Q)
					AuxPipeData(SecS,AuxIDS,Q)
				}
				else if (S === SecS)
				{
					Rec[AuxMakeRecKeyIO](1,Q)
					AuxPipeData(SecQ,AuxIDQ,Q)
				}
			},
			S => S === SecQ ? AuxPipeEnd(SecS,AuxIDS) :
				S === SecS && AuxPipeEnd(SecQ,AuxIDQ),
			(S,Pause) => S === SecQ ? PRQ[AuxPRKeyPR](Pause) :
				S === SecS && PRS[AuxPRKeyPR](Pause),
		])
		OnRecCon({Row : ID,At : WW.Now()})
	},
	AuxOnAny1 = H => (Sec,AuxID,Q) => (AuxID = AuxPool.get(AuxID)) && AuxID[H](Sec,Q),
	AuxOnPipe0 = H => (Sec,AuxID) => (AuxID = AuxPool.get(AuxID)) && AuxID[AuxPoolKeyIsPipe] && AuxID[H](Sec),
	AuxOnPipe1 = H => (Sec,AuxID,Q) => (AuxID = AuxPool.get(AuxID)) && AuxID[AuxPoolKeyIsPipe] && AuxID[H](Sec,Q),
	AuxOnFin = AuxOnAny1(AuxPoolKeyFin),
	AuxOnData = AuxOnPipe1(AuxPoolKeyData),
	AuxOnEnd = AuxOnPipe0(AuxPoolKeyEnd),
	AuxOnPR = AuxOnPipe1(AuxPoolKeyPR),
	AuxWaitSecExpCheck = (Ind,Exp,Sec) => Ind ?
		Exp.Pool().Row === Sec?.Pool()?.Row:
		Exp === Sec,
	AuxWaitRaw = (ID,Begin,Soc,SecExp,Link,Ind) =>
	{
		var
		RecErr = AuxMakeRecErr(ID),
		Fin = (S,E) =>
		{
			if ((!S || S === SecExp) && Soc)
			{
				RecErr[AuxMakeRecErrKeyRec](E,S === SecExp ? AuxMakeRecErrSideServer : null)
				EndSocket(Soc)
				OnRecOff(ID)
				AuxPool.delete(ID)
				SecExp.OnFin(ID)
				Soc =
				SecExp =
				Link = null
			}
		};
		SecExp.OnFin(ID,Fin)
		AuxPool.set(ID,
		[
			0,
			Fin,
			(Sec,AuxID) => AuxWaitSecExpCheck(Ind,SecExp,Sec) &&
				AuxMakeRawPipe(ID,Begin,Soc,Sec,AuxID,Link),
		])
	},
	AuxWaitPipe = (ID,Begin,SecQ,AuxIDQ,SecExp,IndQ,IndS) =>
	{
		var
		RecErr = AuxMakeRecErr(ID),
		Fin = (S,E) =>
		{
			if ((!S || S === SecQ || AuxWaitSecExpCheck(IndS,SecExp,S)) && SecQ)
			{
				RecErr[AuxMakeRecErrKeyRec](E,
					S === SecQ ? AuxMakeRecErrSideClient :
					AuxWaitSecExpCheck(IndS,SecExp,S) ? AuxMakeRecErrSideServer :
					null)
				S === SecQ || AuxPipeFin(SecQ,AuxIDQ,RecErr[AuxMakeRecErrKeyErr]())
				IndS && SecExp.IndDel(IndS)
				OnRecOff(ID)
				AuxPool.delete(ID)
				SecQ.OnFin(ID)
				SecExp.OnFin(ID)
				SecQ =
				SecExp = null
			}
		};
		SecQ.OnFin(ID,Fin)
		SecExp.OnFin(ID,Fin)
		AuxPool.set(ID,
		[
			0,
			Fin,
			(SecS,AuxIDS) =>
			{
				if (AuxWaitSecExpCheck(IndS,SecExp,SecS))
				{
					IndQ ?
						IndAccept(SecQ,IndQ,ID) :
						SecQ.O(Proto.Take,{From : AuxIDQ,To : ID})
					AuxMakePipePipe(ID,Begin,SecQ,AuxIDQ,SecS,AuxIDS)
				}
			},
		])
	},
	AuxOnWaitTake = (Sec,AuxID,Q) =>
	{
		AuxID = AuxPool.get(AuxID)
		if (AuxID && 0 === AuxID[AuxPoolKeyIsPipe])
			AuxID[AuxPoolKeyWaitTake](Sec,Q)
		else
			AuxPipeFin(Sec,Q,'No Such Aux')
	},



	LogDB,
	OnDB =
	/**
		@type {
			<U,N>
			(
				P : number
				Q : (Q : U) => WishNS.Provider<N>
				S : (Q : U) => any
			) => (Q : U) => void
		}
	*/
	(Proto,DBAction,Before) =>
	{
		DBAction || WW.ErrT('No DBAction')
		return Data =>
		{
			Before && Before(Data)
			null == Proto || OnDBBroadcast(Proto,Data)
			DBAction(Data).Now(null,E =>
			{
				LogDB('Err',ErrorS(E))
				WW.IsObj(E) && E.Code && LogDB(E.Code)
			})
		}
	},
	OnDBBroadcast = (ProtoID,Data) =>
	{
		if (MasterOnline.size || WebOnline.size)
		{
			Data = ProtoEnc(ProtoID,Data)
			MasterOnline.forEach(V => V.B(ProtoID,Data))
			WebOnline.forEach(V => V.B(ProtoID,Data))
		}
	},
	OnPoolLst = OnDB(Proto.OnPoolLst,DB.PoolLst,Data =>
	{
		Data.Pool = Data.Pool || []
		Data.Pool.forEach(V =>
		{
			var P = PoolMapRow[V.Row];
			WR.EachU((B,F) =>
			{
				V[F] = P ? P[F] : B
			},PoolLocal)
		})
		PoolSet(Data.Pool)
	}),
	OnPoolNew = OnDB(Proto.OnPoolNew,DB.PoolNew,Data =>
	{
		if (!PoolMapRow[Data.Row])
		{
			var
			P =
			{
				Row : Data.Row,
				Enabled : 9,
				Online : 9,
				ID : Data.ID,
				Birth : Data.Birth,
				Name : '',
				Desc : '',
				Count : 0,
				F2T : 0,
				T2F : 0,
			};
			ListRowNew(PoolList,P)
			PoolMapRow[Data.Row] = P
			if (null != Data.ID) PoolMapID[Data.ID] = P
		}
	}),
	OnPoolNm = OnDB(Proto.OnPoolNm,DB.PoolNm,Data =>
	{
		var P = PoolMapRow[Data.Row];
		if (P) P.Name = Data.Nm
	}),
	OnPoolDes = OnDB(Proto.OnPoolDes,DB.PoolDes,Data =>
	{
		var P = PoolMapRow[Data.Row];
		if (P) P.Desc = Data.Des
	}),
	OnPoolOn = OnDB(Proto.OnPoolOn,DB.PoolOn,Data =>
	{
		var P = PoolMapRow[Data.Row];
		if (P)
		{
			P.Online = 9
			P.IP = Data.IP
			++P.Count
			P.LastOn = P.LastOff = Data.At
			P.VerNode = Data.VN
			P.VerWish = Data.VW
			P.VerPool = Data.VP
			P.Plat = Data.Plat
		}
	}),
	OnPoolOff = OnDB(Proto.OnPoolOff,DB.PoolOff,Data =>
	{
		var P = PoolMapRow[Data.Row];
		if (P)
		{
			P.Online = 0
			P.LastOff = Data.At
		}
	}),
	OnPoolPing = OnDB(Proto.OnPoolPing,DB.PoolPing,Data =>
	{
		var P = PoolMapRow[Data.Row];
		if (P)
		{
			P.Ping = Data.Ping
			P.LastOff = Data.At
		}
	}),
	OnPoolDel = OnDB(Proto.OnPoolDel,DB.PoolDel,Data =>
	{
		var P = PoolMapRow[Data.Row];
		if (P)
		{
			P.Enabled = false
			ListRowDel(PoolList,Data)
			WR.Del(Data.Row,PoolMapRow)
			if (null != P.ID) WR.Del(P.ID,PoolMapID)
		}
	}),
	OpPoolDel = (Sec,Data) =>
	{
		if (MachineRow === Data.Row || MasterOnline.has(Data.Row))
			Sec.E(`The node #${Data.Row} is active`)
		else OnPoolDel(Data)
	},
	OnPoolRec = OnDB(null,DB.PoolRec,Data => WebBroadcast(Proto.OnPoolRec,Data)),
	SavePoolRecPrev = {},
	SavePoolRec = (PoolData,F2T,T2F) =>
	{
		var
		Slot = SavePoolRecPrev[PoolData.Row];
		if (Slot)
		{
			Slot[0] += F2T
			Slot[1] += T2F
		}
		else
		{
			SavePoolRecPrev[PoolData.Row] = Slot = [F2T,T2F]
			WW.To(StatInterval,function()
			{
				OnPoolRec(
				{
					Row : PoolData.Row,
					F2T : PoolData.F2T += Slot[0],
					T2F : PoolData.T2F += Slot[1],
				})
				SavePoolRecPrev[PoolData.Row] = null
			})
		}
	},

	OnDBLink =
	/**
		@type {
			<
				U extends keyof CrabPoolNS.DBLink
				N extends {IsGlobal : number} & WishNS.TypeP0<CrabPoolNS.DBLink[U]>
			>(
				N : boolean
				P : number
				K : U
				S : (Q : N,L : CrabPoolNS.DBLink) => any
			) => (Q : N) => any
		}
	*/
	(ToNode,Proto,Key,Before) =>
	{
		var
		DBGlobalAction = DB.LinkGlobal[Key],
		DBAction = DB.Link[Key],
		LinkGlobalAction = LinkGlobal[Key],
		LinkAction = Link[Key];
		return OnDB
		(
			null,
			Q => (Q.IsGlobal ? DBGlobalAction : DBAction)(Q),
			Data =>
			{
				Before && Before(Data,Data.IsGlobal ? LinkGlobal : Link)
				;(Data.IsGlobal ? LinkGlobalAction : LinkAction)(Data)
				;(ToNode && Data.IsGlobal ? OnDBBroadcast : WebBroadcast)(Proto,Data)
			}
		)
	},
	OnLinkLst = OnDBLink(false,Proto.OnLinkLst,'Lst',(Data,Link) =>
	{
		Data.Link = Data.Link || []
		Data.IsGlobal && Data.Link.forEach(V =>
		{
			var L = Link.Get(V.Row);
			WR.EachU((B,F) =>
			{
				V[F] = L ? L[F] : B
			},LinkLocal)
		})
	}),
	OnLinkNew = OnDBLink(true,Proto.OnLinkNew,'New'),
	OpLinkCheck = (Sec,Data) =>
	{
		var
		Host,Port;
		if (!WW.IsIn(Data.Local,0,65536))
			return Sec.E('Deploy port should be an integer in range [0,65535]')
		if (!Data.Target)
			return Sec.E('Target node is required')
		if (!PoolMapRow[Data.Target])
			return Sec.E('Target node does not exist')
		if (!Data.Addr)
			return Sec.E('Address is required')
		Host = Data.Addr.split(/:/)
		Port = +Host.pop()
		Host = Host.join(':')
		if (!WW.IsIn(Port,1,65536))
			return Sec.E('There should be a port number of the address in range [1,65535]')
		Data.Host = Host || null
		Data.Port = Port
		WR.Del('Addr',Data)
		return true
	},
	OpLinkNew = (Sec,Data) =>
	{
		if (OpLinkCheck(Sec,Data))
		{
			Data.Row = (Data.IsGlobal ? LinkGlobal : Link).Row()
			Data.Birth = WW.Now()
			OnLinkNew(Data)
		}
	},
	OnLinkOn = OnDBLink(false,Proto.OnLinkOn,'On'),
	OnLinkOff = OnDBLink(false,Proto.OnLinkOff,'Off'),
	OnLinkCon = OnDBLink(false,Proto.OnLinkCon,'Con'),
	OnLinkDisconnect = (IsGlobal,Row) =>
	{
		var L = (IsGlobal ? LinkGlobal : Link).Get(Row);
		if (L)
		{
			--L.Using
			WebBroadcast(Proto.OnLinkDis,{IsGlobal,Row})
		}
	},
	OnLinkMod = OnDBLink(true,Proto.OnLinkMod,'Mod'),
	OpLinkMod = (Sec,Data) => OpLinkCheck(Sec,Data) && OnLinkMod(Data),
	OnLinkDel = OnDBLink(true,Proto.OnLinkDel,'Del'),
	OnLinkInd = OnDBLink(true,Proto.OnLinkInd,'Ind'),
	OnLinkRec = OnDBLink(false,Proto.OnLinkRec,'Rec'),
	OpLinkRecPrev = [{},{}],
	OpLinkRec = (IsGlobal,Row,F2T,T2F) =>
	{
		var
		Prev = OpLinkRecPrev[IsGlobal ? 0 : 1],
		Slot = Prev[Row];
		if (Slot)
		{
			Slot[0] += F2T
			Slot[1] += T2F
		}
		else
		{
			Prev[Row] = Slot = [F2T,T2F]
			WW.To(StatInterval,function()
			{
				OnLinkRec(
				{
					IsGlobal,
					Row,
					F2T : Slot[0],
					T2F : Slot[1],
				})
				Prev[Row] = null
			})
		}
	},
	OnLinkDeploy = (IsGlobal,Row,Deploy,Err) =>
	{
		var L = (IsGlobal ? LinkGlobal : Link).Get(Row);
		if (L)
		{
			L.Deploy = Deploy,
			L.Err = Err
		}
		WebBroadcast(Proto.OnLinkDep,
		{
			IsGlobal,
			Row,
			Deploy,
			Err,
		})
	},

	OnRecNew = OnDB(null,DB.RecNew,() => ++RecCount),
	OnRecClient = OnDB(null,DB.RecClient),
	OnRecServer = OnDB(null,DB.RecServer),
	OnRecCon = OnDB(null,DB.RecCon),
	OnRecRec = OnDB(null,DB.RecRec),
	OnRecOff = OnDB(null,DB.RecOff),
	OnRecErr = OnDB(null,DB.RecErr),

	OnStatRec = OnDB(null,DB.StatRec),

	OnExtLst = OnDB(Proto.OnExtLst,DB.ExtLst,Data =>
	{
		var K = new Set(WR.Key(ExtMap));
		Data.Ext = Data.Ext || []
		Data.Ext.forEach(V =>
		{
			K.delete(V.Key)
			ExtMap[V.Key] = V.Val
		})
		K.size && OnExtDel([...K])
	}),
	OnExtDel = OnDB(null,DB.ExtDel,Data =>
	{
		Data.forEach(V => WR.Del(V,ExtMap))
	}),
	OnExtSet = OnDB(Proto.OnExtSet,DB.ExtSet,Data =>
	{
		Data.Val ?
			ExtMap[Data.Key] = Data.Val :
			WR.Del(Data.Key,ExtMap)
	}),



	MasterOnline = new Map,
	MakeMaster = () =>
	{
		var
		Count = MakeCount(),
		Master = Net.createServer(S =>
		{
			var
			Time = MakeTime(),
			Log = MakeLog(`Master [${Count()}] ${RemoteIP(S)}`),
			HelloData,
			HelloSeed = MakeSeed(),
			Inited,Preparing,
			Row,PoolData,
			WithInit = H => Data => Inited ? H(Data) : Sec.F('Who are you'),
			PingAt,PingCurrent,
			Ping = WW.To(TickInterval,() =>
			{
				PingAt = WW.Now()
				Sec.O(Proto.Ping,{Seed : PingCurrent = MakeSeed()})
			},false,false),
			Sec = MakeSec(S,MakeProtoAct(ProtoDec,
			{
				[Proto.Fatal] : Data => Log('Fatal',Data.Msg),

				[Proto.Hello] : Data =>
				{
					var IDSec;

					if (Inited) return Sec.F('Talked too much')
					if (Preparing)
					{
						Inited = true
						if (Data.Ack !== HelloSeed) return Sec.F(`Ack failure ${HelloSeed} ${Data.Ack}`)

						Sec.C(true)
						MasterOnline.has(Row) &&
							MasterOnline.get(Row).F('Kicked by ' + RemoteIP(S))
						OnPoolOn(
						{
							Row,
							IP : RemoteIP(S),
							At : WW.Now(),
							VN : HelloData.VerNode,
							VW : HelloData.VerWish,
							VP : HelloData.VerPool,
							Plat : HelloData.Plat,
						})
						MasterOnline.set(Row,Sec)

						Sec.O(Proto.OnPoolLst,{Pool : PoolList.map(V => (
						{
							...V,
							F2T : 0,
							T2F : 0,
						}))})
						Sec.O(Proto.OnLinkLst,
						{
							IsGlobal : 9,
							Link : LinkGlobal.All().map(V => (
							{
								...V,
								Online : 9,
								Visit : 0,
								Last : null,
								F2T : 0,
								T2F : 0,
							}))
						})
						Sec.O(Proto.OnExtLst,{Ext : ExtGetLst()})

						Sec.Pool(PoolData)
						Sec.Feat(HelloData.Feat)
						Ping.C()
						Sec.C(false)
						return
					}

					Preparing = true
					HelloData = Data

					IDSec = Data.Sec
					if (!IDSec) return Sec.F('Unnamed')
					if (MachineIDSecHEX === WC.HEXS(IDSec)) return Sec.F('Not unique')

					IDSec = HelloData.Sec
					IDSec = WC.HEXS(StepB(IDSec))
					PoolData = PoolMapID[IDSec]
					if (!PoolData)
					{
						OnPoolNew({Row : ++PoolID,ID : IDSec,Birth : WW.Now()})
						PoolData = PoolMapRow[PoolID]
					}
					Row = PoolData.Row

					Sec.O(Proto.Hello,
					{
						Row,
						Master : MachineRow,
						Syn : HelloSeed,
						Ack : Data.Syn,
						Feat : Feature,
					})
					Sec.C(false)

					Log('Node',Row)
				},
				[Proto.Ping] : WithInit(Data =>
				{
					if (Data.Seed === PingCurrent)
					{
						OnPoolPing(
						{
							Row,
							Ping : WW.Now() - PingAt,
							At : WW.Now(),
						})
					}
					Ping.D()
				}),

				[Proto.PoolNm] : WithInit(OnPoolNm),
				[Proto.PoolDes] : WithInit(OnPoolDes),
				[Proto.PoolDel] : WithInit(Data => OpPoolDel(Sec,Data)),

				[Proto.Wish] : WithInit(Data =>
				{
					if (Data.To !== MachineRow && !WR.Has(Data.To,PoolMapRow) ||
						null == Data.ID ||
						Data.From == Data.To)
						return AuxPipeFin(Sec,Data.ID,'Bad Wish')

					if (Data.To !== MachineRow && !MasterOnline.has(Data.To))
						return AuxPipeFin(Sec,Data.ID,'Target Offline')

					var
					AuxID = ++RecID,
					At = WW.Now(),
					SecS;

					OnRecNew(
					{
						Row : AuxID,
						Birth : At,
						From : Data.From,
						To : Data.To,
						Req : SolveReq(Data.Host,Data.Port),
						Client : RemoteIP(S),
						Server : Data.To === MachineRow ? null : RemoteIP(MasterOnline.get(Data.To).S),
					})
					StatOnConn()
					if (Data.To === MachineRow)
					{
						Sec.O(Proto.Take,{From : Data.ID,To : AuxID})
						AuxMakeRawPipe(AuxID,At,AuxMakeRaw(Data.Host,Data.Port),Sec,Data.ID,false)
					}
					else
					{
						SecS = MasterOnline.get(Data.To)
						AuxWaitPipe(AuxID,At,Sec,Data.ID,SecS)
						Data.ID = AuxID
						SecS.O(Proto.Wish,Data)
					}
				}),
				[Proto.Take] : WithInit(Data =>
				{
					if (null != Data.To)
						AuxOnWaitTake(Sec,Data.From,Data.To)
				}),
				[Proto.WishR] : WithInit(Data =>
				{
					if (Data.To !== MachineRow && !WR.Has(Data.To,PoolMapRow) ||
						null == Data.ID ||
						Data.From == Data.To)
						return AuxPipeFin(Sec,Data.ID,'Bad Wish')

					if (Data.To !== MachineRow && !MasterOnline.has(Data.To))
						return AuxPipeFin(Sec,Data.ID,'Target Offline')

					var
					AuxID = ++RecID,
					At = WW.Now();

					OnRecNew(
					{
						Row : AuxID,
						Birth : At,
						From : Data.From,
						To : Data.To,
						Req : SolveReq(Data.Host,Data.Port),
						Client : RemoteIP(S),
						Server : Data.To === MachineRow ? null : RemoteIP(MasterOnline.get(Data.To).S),
						Ind : true,
					})
					StatOnConn()
					Sec.O(Proto.TakeR,
					{
						ID : Data.ID,
						Key : Sec.Ind(AuxID,SecI =>
						{
							var SecS;
							OnRecClient({Row : AuxID,Client : RemoteIP(S) + '+' + RemoteIP(SecI.S)})
							if (Data.To === MachineRow)
							{
								IndAccept(SecI,Sec,AuxID)
								AuxMakeRawPipe(AuxID,At,AuxMakeRaw(Data.Host,Data.Port),SecI,null,false)
							}
							else if (SecS = MasterOnline.get(Data.To))
							{
								if (SecS.Feat(FeatureInd))
								{
									Data.ID = AuxID
									Data.Key = SecS.Ind(AuxID,SecI =>
									{
										OnRecServer({Row : AuxID,Server : RemoteIP(SecS.S) + '+' + RemoteIP(SecI.S)})
										IndAccept(SecI,SecS,AuxID)
										AuxOnWaitTake(SecI,AuxID,null)
									})
									AuxWaitPipe(AuxID,At,SecI,null,SecS,Sec,Data.Key)
									SecS.O(Proto.WishR,Data)
								}
								else
								{
									AuxWaitPipe(AuxID,At,SecI,null,SecS,Sec)
									Data.ID = AuxID
									SecS.O(Proto.Wish,Data)
								}
							}
							else
							{
								SecI.F('Target Offline')
							}
						}),
					})
				}),
				[Proto.Ind] : Data =>
				{
					if (Preparing) return Sec.F('Why')
					var
					SecO = MasterOnline.get(Data.Row);
					if (!SecO ||
						!SecO.IndHas(Data.Key))
						return Sec.F('Bad Ind')
					SecO.Ind(Data.Key,Sec)
					/*
						In a RawPipe situation, the Raw socket is resumed in the nextTick before we uncork
						So we may save a round trip if there are already data buffered in the Raw socket
					*/
					process.nextTick(() => Sec.C(false))
				},
				[Proto.AuxFin] : WithInit(Data => AuxOnFin(Sec,Data.ID,Data.Err)),
				[Proto.AuxEnd] : WithInit(Data => AuxOnEnd(Sec,Data.ID)),
				[Proto.AuxPR] : WithInit(Data => AuxOnPR(Sec,Data.ID,Data.Pause)),

				[Proto.ExtSet] : WithInit(OnExtSet),
			}),AuxOnData);
			S.on('error',E =>
			{
				Log('Err',ErrorS(E))
			}).on('close',E =>
			{
				Log('Closed',Time(),E + (Sec.Fat && ' ' + Sec.Fat))
				Ping.F()
				if (Row && MasterOnline.get(Row) === Sec)
				{
					MasterOnline.delete(Row)
					OnPoolOff({Row,At : WW.Now()})
				}
			})
			Log('Connected')
			Sec.C(true)
			MakeNoise(Sec)
		}).listen(PortMaster || 0)
			.on('listening',() => MakeLog('Master')('Deploy',Master.address().port))
	},



	NodeOnline,
	NodeMasterSec,
	MakeNode = () =>
	{
		var
		Count = MakeCount();
		MakePipeMaster((S,O) =>
		{
			var
			Time = MakeTime(),
			LogPrefix = `Node [${Count()}]`,
			Log = MakeLog(LogPrefix),
			HelloSeed = MakeSeed(),
			OnLinkGlobal = H => Data => Data.IsGlobal && H(Data),
			PingTooLong = WW.TOD(1.5 * TickInterval,() =>
			{
				Log('No Ping')
				MakeNoise(Sec)
			}),
			SecPoolPrepared,
			Sec = NodeMasterSec = MakeSec(S,MakeProtoAct(ProtoDec,
			{
				[Proto.Fatal] : Data => Log('Fatal',Data.Msg),
				[Proto.Err] : Data => WebBroadcast(Proto.Err,Data),

				[Proto.Hello] : Data =>
				{
					if (Data.Ack !== HelloSeed)
						return Sec.F(`Ack failure ${HelloSeed} ${Data.Ack}`)
					NodeStatus.Online = NodeOnline = true
					NodeStatus.Row = MachineRow = Data.Row
					NodeStatus.Master = Data.Master
					NodeStatus.MasterIP = RemoteIP(S)
					DataSession.D(DataSessionKeyNodeStatus,NodeStatus)
					Sec.O(Proto.Hello,{Ack : Data.Syn})
					WebBroadcast(Proto.NodeStatus,NodeStatus)
					Sec.Feat(Data.Feat)
					PingTooLong.D()
					Log('Authed')
				},
				[Proto.Ping] : Data =>
				{
					Sec.O(Proto.Ping,Data)
					PingTooLong.D()
				},

				[Proto.Wish] : Data =>
				{
					var
					AuxID = ++RecID,
					At = WW.Now();

					OnRecNew(
					{
						Row : AuxID,
						Birth : At,
						From : Data.From,
						To : Data.To,
						Req : SolveReq(Data.Host,Data.Port),
						Client : RemoteIP(S),
					})
					StatOnConn()

					Sec.O(Proto.Take,{From : Data.ID,To : AuxID})
					AuxMakeRawPipe(AuxID,At,AuxMakeRaw(Data.Host,Data.Port),Sec,Data.ID,false)
				},
				[Proto.Take] : Data => AuxOnWaitTake(Sec,Data.From,Data.To),
				[Proto.WishR] : Data =>
				{
					var
					AuxID = ++RecID,
					At = WW.Now(),
					RecErr = AuxMakeRecErr(AuxID),
					Fin = (_,E) =>
					{
						if (RecErr)
						{
							OnRecOff(AuxID)
							AuxPool.delete(AuxID)
							RecErr[AuxMakeRecErrKeyRec](E)
							RecErr = null
						}
					};
					OnRecNew(
					{
						Row : AuxID,
						Birth : At,
						From : Data.From,
						To : Data.To,
						Req : SolveReq(Data.Host,Data.Port),
						Client : RemoteIP(S),
						Ind : true,
					})
					StatOnConn()

					MakeInd(AuxID,Data.Key).Now(S =>
					{
						if (AuxPool.has(AuxID))
						{
							IndAccept(S,Sec,AuxID)
							AuxMakeRawPipe(AuxID,At,AuxMakeRaw(Data.Host,Data.Port),S,null,false)
						}
						else
						{
							EndSocket(S.S)
						}
					},E =>
					{
						E = `IndErr | ${E}`
						AuxOnFin(null,AuxID,E)
						AuxPipeFin(Sec,Data.ID,E)
					})
					Sec.OnFin(AuxID,Fin)
					AuxPool.set(AuxID,
					[
						false,
						Fin
					])
				},
				[Proto.TakeR] : Data =>
				{
					if (!AuxPool.has(Data.ID))
						return AuxPipeFin(Sec,Data.To,'Bad Take')

					MakeInd(Data.ID,Data.Key).Now(S =>
					{
						IndAccept(S,Sec,Data.ID)
						AuxOnWaitTake(S,Data.ID,null)
					},E =>
					{
						E = `IndErr | ${E}`
						AuxOnFin(null,Data.ID,E)
						AuxPipeFin(Sec,Data.To,E)
					})
				},
				[Proto.AuxFin] : Data => AuxOnFin(Sec,Data.ID,Data.Err),
				[Proto.AuxEnd] : Data => AuxOnEnd(Sec,Data.ID),
				[Proto.AuxPR] : Data => AuxOnPR(Sec,Data.ID,Data.Pause),



				[Proto.OnPoolLst] : Data =>
				{
					OnPoolLst(Data)
					if (!SecPoolPrepared)
					{
						SecPoolPrepared = true
						Sec.Pool(PoolMapRow[NodeStatus.Master])
					}
				},
				[Proto.OnPoolNew] : OnPoolNew,
				[Proto.OnPoolNm] : OnPoolNm,
				[Proto.OnPoolDes] : OnPoolDes,
				[Proto.OnPoolOn] : OnPoolOn,
				[Proto.OnPoolOff] : OnPoolOff,
				[Proto.OnPoolPing] : OnPoolPing,
				[Proto.OnPoolDel] : OnPoolDel,

				[Proto.OnLinkLst] : OnLinkGlobal(OnLinkLst),
				[Proto.OnLinkNew] : OnLinkGlobal(OnLinkNew),
				[Proto.OnLinkMod] : OnLinkGlobal(OnLinkMod),
				[Proto.OnLinkDel] : OnLinkGlobal(OnLinkDel),
				[Proto.OnLinkInd] : OnLinkGlobal(OnLinkInd),

				[Proto.OnExtLst] : OnExtLst,
				[Proto.OnExtSet] : OnExtSet,
			}),AuxOnData);
			S.on('connect',() =>
			{
				Log = MakeLog(`${LogPrefix} ${RemoteIP(S)}`)
				Log('Connected')
			}).on('error',E =>
			{
				Log('Err',ErrorS(E))
			}).on('close',E =>
			{
				Log('Closed',Time(),E + (Sec.Fat && ' ' + Sec.Fat))
				NodeMasterSec =
				NodeOnline =
				NodeStatus.Online = false
				WebBroadcast(Proto.NodeStatus,NodeStatus)
				PingTooLong.F()
				O.E()
			})
			Log('Created')
			MakeNoise(Sec)
			Sec.O(Proto.Hello,
			{
				Sec : MachineIDSec,
				Syn : HelloSeed,
				VerNode : process.versions.node,
				VerWish : WW.Version,
				VerPool : PoolVersion,
				Plat : PlatArch,
				Feat : Feature,
			})
		}).RetryWhen(E => E.Delay(PipeRetry)).Now()
	},



	MakeInd = (AuxID,Key) => MakePipeMaster((S,O) =>
	{
		var
		Time = MakeTime(),
		Log = MakeLog(`Ind [${AuxID}]`),
		Handled = false,
		Sec = MakeSec(S,MakeProtoAct(ProtoDec,
		{
			[Proto.Fatal] : Data =>
			{
				Handled = true
				AuxOnFin(null,AuxID,Data.Msg)
			},
			[Proto.Ind] : () =>
			{
				Handled = true
				O.U(Sec)
			},
		}),AuxOnData);
		S.on('error',E =>
		{
			Handled = true
			AuxOnFin(null,AuxID,E)
		}).on('close',E =>
		{
			Sec.Fat &&
				Log('Closed',Time(),E,Sec.Fat)
			Handled ||
				AuxOnFin(null,AuxID,'Closed Without Response')
		})
		Sec.O(Proto.Ind,
		{
			Seed : MakeSeedBuf(),
			Row : MachineRow,
			Key,
		})
	},true),
	IndAccept = (SecI,Sec,AuxID) =>
	{
		SecI.Pool(Sec.Pool())
		PipeMaster || SecI.O(Proto.Ind,{})
		SecI.Raw(AuxID)
	},



	MakeLinkServer = (IsGlobal,Row) =>
	{
		var
		Count = MakeCount(),
		Log = MakeLog(`Link${IsGlobal ? 'Global' : ''} [${Row}]`),
		Online,Paused = false,
		Local,Target,Host,Port,Req,
		Ind,
		Server,ServerPort,
		Renew,
		Make = () =>
		{
			Renew && Renew.F()
			Renew = null
			Server = Net.createServer(S =>
			{
				if (PipeMaster && !MachineRow)
					return EndSocket(S)

				var
				AuxID = ++RecID,
				At = WW.Now(),
				Fin = () =>
				{
					if (AuxID)
					{
						EndSocket(S)
						AuxOnFin(null,AuxID)
						OnLinkDisconnect(IsGlobal,Row)
						AuxID = null
					}
				},
				Sec = Target === MachineRow ?
					null :
					PipeMaster ?
						NodeOnline && !!PoolMapRow[Target] ?
							NodeMasterSec :
							null :
						MasterOnline.has(Target) ?
							MasterOnline.get(Target) :
							null,
				Bad = Q =>
				{
					OnRecErr({Row : AuxID,Err : Q})
					OnRecOff(AuxID)
					Fin()
				};

				OnLinkCon({IsGlobal,Row,At})
				OnRecNew(
				{
					Row : AuxID,
					Birth : At,
					From : MachineRow,
					To : Target,
					Req,
					Client : RemoteIP(S),
					Server : Sec && RemoteIP(Sec.S),
					Ind : Ind && Sec && Sec.Feat(FeatureInd),
				})
				StatOnConn()
				if (Target === MachineRow)
				{
					AuxMakeRawRaw(AuxID,At,S,AuxMakeRaw(Host,Port),IsGlobal,Row)
				}
				else if (Sec && !Sec.Pool())
				{
					Bad('Target Not Prepared')
				}
				else if (Sec)
				{
					S.on('error',WW.O)
						.on('close',Fin)
					if (Ind && Sec.Feat(FeatureInd))
					{
						Sec.O(Proto.WishR,
						{
							ID : AuxID,
							Key : PipeMaster ? null : Sec.Ind(AuxID,SecI =>
							{
								OnRecServer({Row : AuxID,Server : RemoteIP(Sec.S) + '+' + RemoteIP(SecI.S)})
								IndAccept(SecI,Sec,AuxID)
								AuxOnWaitTake(SecI,AuxID,null)
							}),
							From : MachineRow,
							To : Target,
							Host,
							Port,
						})
					}
					else
					{
						Sec.O(Proto.Wish,
						{
							ID : AuxID,
							From : MachineRow,
							To : Target,
							Host,
							Port,
						})
					}
					AuxWaitRaw(AuxID,At,S,Sec,[IsGlobal,Row],Ind)
				}
				else
				{
					Bad('Target Offline')
				}
			}).listen(ServerPort = Local)
				.on('listening',() =>
				{
					Log(Count(),'Deploy',Server.address().port)
					OnLinkDeploy(IsGlobal,Row,Server.address().port,null)
				})
				.on('error',E =>
				{
					OnLinkDeploy(IsGlobal,Row,null,'' + E)
					Renew = WW.To(5E3,Make)
				})
		},
		End = () =>
		{
			Renew && Renew.F()
			Server && Server.close()
			OnLinkDeploy(IsGlobal,Row,null,null)
			Server = ServerPort = Renew = null
		},
		OnChange = () =>
		{
			if (!Online || Paused || Local !== ServerPort)
				End()
			if (Online && !Paused && !Server)
				Make()
		};
		return {
			D : (V,Suppress) =>
			{
				Online = V.Online
				Local = V.Local
				Target = V.Target
				Host = V.Host
				Port = V.Port
				Ind = V.Ind
				Req = SolveReq(Host,Port)
				Suppress || OnChange()
			},
			F : End,
			O : On => OnChange(Online = On),
			I : I => OnChange(Ind = I),
			L : () => Local,
			PR : P => OnChange(Paused = P)
		}
	},



	WebOnline = new Set,
	WebBroadcast = (ProtoID,Data) =>
	{
		if (WebOnline.size)
		{
			Data = ProtoEnc(ProtoID,Data)
			WebOnline.forEach(V => V.B(ProtoID,Data))
		}
	},
	MakeWeb = Port =>
	{
		var
		Server = HTTP.createServer((Q,S) =>
		{
			WebSolveFile(Q.url)
				.FMap(V => WN.UR(V).Tap(B =>
				{
					/\.js$/.test(V) && S.setHeader('Content-Type','application/javascript; charset=UTF-8')
					S.end(B)
				}))
				.Now(null,() =>
				{
					S.writeHead(404)
					S.end(`Unable to resolve //${Q.headers.host || ''}${Q.url}`)
				})
		}).listen(Port)
			.on('listening',() => MakeLog('Web')('Deploy',Server.address().port));
		return Server
	},
	WebFileMap =
	{
		'/' : WN.JoinP(__dirname,'Web.htm'),
		'/W' : require.resolve('@zed.cwt/wish'),
	},
	WebFileEntry = WN.JoinP(__dirname,'Web.js'),
	WebFileEntryComplete = WN.JoinP(PathData,'Web.js'),
	WebFileEntryCurrent,
	WebSolveFile = Q => WebFileMap[Q = WR.Up(Q).replace(/\?.*/,'')] ? WX.Just(WebFileMap[Q]) :
		'/M' === Q ? WN.Stat(WebFileEntry).FMap(B =>
			WebFileEntryCurrent === B.mtime ?
				WX.Just(WebFileEntryComplete) :
				WN.UR(WebFileEntry).FMap(V =>
				{
					var
					Err = '';
					V = V
						.replace(/Proto\.(\w+)/g,(Q,S) =>
						{
							if (!Err && !WR.Has(S,Proto))
								Err = 'Invalid key ' + Q
							return Proto[S]
						})
						.replace(/Proto = {}/,() => `Proto =\n${ProtoJSON}`)
						.replace(/ProtoPB = ''/,() => `ProtoPB = ${ProtoPB}`)
					return WN.UW(WebFileEntryComplete,Err ? `alert(${OTJApos(Err)})` : V)
				}).Map(() =>
				(
					WebFileEntryCurrent = B.mtime,
					WebFileEntryComplete
				))) :
		WX.Throw(),
	WebOnSocketCount = MakeCount(),
	WebOnSocket = /**@type {(S : import('ws'),H : import('http').IncomingMessage) => any}*/ (S,H) =>
	{
		var
		Log = MakeLog(`WS ${WebOnSocketCount()} ${RemoteIP(H.socket)}`),
		Time = MakeTime(),
		Seed = WW.Key(256),
		CipherKey = StepB(Seed + WebToken),
		CipherDesc =
		[
			'AES-256-OFB',
			CipherKey.slice(0,32),
			CipherKey.slice(-16),
		],
		C = Crypto.createCipheriv(...CipherDesc),D = Crypto.createDecipheriv(...CipherDesc),
		Inited,Preparing,
		WithInit = H => Data => Inited ? H(Data) : Fatal('Who are you'),

		TOD = WW.TOD(WebTimeout,() => Fatal('Timeout')),
		SendPacket = (ID,Data) =>
		{
			if (S.readyState === S.OPEN)
			{
				var T,F = 0;
				for (T = ID;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
					MakeSocHeaderBuf[F - 1] |= 128
				for (T = ID + Data.length;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
					MakeSocHeaderBuf[F - 1] |= 128
				S.send(Buffer.concat(
				[
					C.update(MakeSocHeaderBuf.slice(0,F)),
					C.update(Data)
				]))
			}
		},
		Send = (ProtoID,Data) => SendPacket(ProtoID,ProtoEnc(ProtoID,Data)),
		Forward = (ProtoID,MasterAction) =>
			PipeMaster ?
				Data =>
				{
					NodeMasterSec ?
						NodeMasterSec.O(ProtoID,Data) :
						Err('Unable to perform while offline')
				} :
				MasterAction,
		Err = E => Send(Proto.Err,{Msg : E}),
		LastFatal,
		Fatal = E =>
		{
			LastFatal = E
			Send(Proto.Fatal,{Msg : E})
			S.terminate()
		},
		Sec =
		{
			D : TOD.D,
			B : SendPacket,
			E : Err,
			F : Fatal,
		},
		OnLink = H => Data =>
		{
			if (Data.IsGlobal && PipeMaster)
				Err('Unable to edit GlobalLink')
			else H(Data)
		},
		EndRec = WX.EndL(),
		EndStat = WX.EndL(),
		Act = MakeProtoAct(ProtoDec,
		{
			[Proto.Hello] : Data =>
			{
				if (Inited) return Fatal('Talked too much')
				if (Preparing)
				{
					Inited = true
					Data.Ack === Seed ||
						Fatal(`Ack failure ${Seed} ${Data.Ack}`)
					return
				}
				Preparing = true

				WebOnline.add(Sec)

				Send(Proto.NodeStatus,NodeStatus)
				Send(Proto.OnPoolLst,{Pool : PoolList})
				Send(Proto.OnLinkLst,{IsGlobal : 9,Link : LinkGlobal.All()})
				Send(Proto.OnLinkLst,{IsGlobal : 0,Link : Link.All()})
				Send(Proto.OnExtLst,{Ext : ExtGetLst()})
				Send(Proto.Hello,
				{
					Syn : Seed = MakeSeed(),
					Ack : Data.Syn,
				})
			},

			[Proto.PoolNm] : WithInit(Forward(Proto.PoolNm,OnPoolNm)),
			[Proto.PoolDes] : WithInit(Forward(Proto.PoolDes,OnPoolDes)),
			[Proto.PoolDel] : WithInit(Forward(Proto.PoolDel,Data => OpPoolDel(Sec,Data))),

			[Proto.LinkNew] : WithInit(OnLink(Data => OpLinkNew(Sec,Data))),
			[Proto.LinkOn] : WithInit(OnLinkOn),
			[Proto.LinkOff] : WithInit(OnLinkOff),
			[Proto.LinkMod] : WithInit(OnLink(Data => OpLinkMod(Sec,Data))),
			[Proto.LinkDel] : WithInit(OnLink(OnLinkDel)),
			[Proto.LinkInd] : WithInit(OnLink(OnLinkInd)),

			[Proto.ExtSet] : WithInit(Forward(Proto.ExtSet,OnExtSet)),



			[Proto.TokenNew] : WithInit(Data =>
			{
				if (!Data.Old || WebToken !== WC.U8S(StepB(Data.Old)))
					return Err('Incorrect original token')
				if (!Data.New)
					return Err('New token cannot be empty')

				WN.UW(FileToken,WC.B91S(StepB(Data.New)))
					.FP(WN.UR(FileToken))
					.Now(B =>
					{
						WebToken = WC.U8S(WC.B91P(B))
						Send(Proto.TokenNew)
						WebOnline.forEach(V => V.F('Token changed'))
					},E => Err('Failed to save the new token\n' + E))
			}),
			[Proto.RecReq] : WithInit(Data =>
			{
				var
				Page = Math.abs(0 | Data.Page),
				PageSize = Math.abs(0 | Data.PageSize);

				if (100 < PageSize)
					return Err('PageSize too huge')

				EndRec(DB.RecGet(Page,PageSize)
					.Tap(Rec => Send(Proto.RecRes,{Count : RecCount,Rec}))
					.Now(null,E => Err(`Failed to load rec ${ErrorS(E)}`)))
			}),
			[Proto.RecCut] : WithInit(Data =>
			{
				AuxOnFin(null,Data.Row,'Manually Cut')
			}),
			[Proto.StatReq] : WithInit(Data =>
			{
				var
				TZ = 0 | Data.TZ,
				Today = WW.Now();
				if (2880 < Math.abs(TZ))
					return Err('Inappropriate timezone ' + TZ)

				Today -= TZ *= 6E4
				Today -= Today % DayMS - TZ
				EndStat(DB.StatAfter(Today - 30 * DayMS)
					.Now(Stat =>
					{
						Send(Proto.StatRes,{Today,Stat})
					},E =>
					{
						Err(`Failed to load stat ${ErrorS(E)}`)
					}))
			}),
		});

		Log('Accepted')
		S.on('message',Q =>
		{
			var
			ID = 0,Check = 0,
			UVM = 1,
			F = 0;
			Q = D.update(Q)
			for (;
				ID += UVM * (127 & Q[F]),
				127 < Q[F++]
			;) UVM *= 128
			UVM = 1
			for (;
				Check += UVM * (127 & Q[F]),
				127 < Q[F++]
			;) UVM *= 128
			if (Check === ID + Q.length - F)
				Act(Sec,ID,Q.slice(F))
			else Fatal(`Checksum failure ${ID} + ${Q.length - F} != ${Check}`)
		}).on('close',(Q,S) =>
		{
			Log('Closed',Time(),Q,S + (LastFatal ? ' ' + LastFatal : ''))
			WebOnline.delete(Sec)
			TOD.F()
		}).send(Seed)
	};



	if (null == LogTop)
	{
		LogRoll = WN.RollLog({Pre : WN.JoinP(PathLog,'Event')})
		LogTop = (...Q) => LogRoll(WW.StrDate(),WW.Tick(),'|',...Q)
	}
	MakeLog = WW.IsFunc(LogTop) ? H => (H = `[${H}]`,(...Q) => LogTop(H,...Q)) : () => WW.O
	LogDB = MakeLog('DB')
	LogTop('========')



	return {
		Pool : WN.MD(PathLog)
			.FP(WN.UR(FileID).ErrAs(() =>
				WN.UW(FileID,WW.Key(320)).FP(WN.UR(FileID))))
			.Tap(B =>
			{
				MachineIDSec = StepA(B)
				MachineIDSecHEX = WC.HEXS(MachineIDSec)
				MachineIDHEX = WC.HEXS(StepB(MachineIDSec))
			})
			.FP(WN.UR(FileToken).ErrAs(K =>
			(
				K = WW.Key(20),
				WN.UW(FileToken,WC.B91S(StepB(StepA(K))) + WN.EOL +
					'Initial Token : ' + K)
					.FP(WN.UR(FileToken))
			)))
			.Tap(B => WebToken = WC.U8S(WC.B91P(B.split(/\s/)[0])))
			.FP(DB.Init)
			.FMap(DB.PoolAll)
			.Tap(PoolSet)
			.FMap(DB.PoolMax)
			.Tap(B =>
			{
				PoolID = B || PoolID
				if (!PipeMaster && !PoolMapID[MachineIDHEX])
				{
					OnPoolNew({Row : ++PoolID,ID : MachineIDHEX,Birth : WW.Now()})
				}
				if (PipeMaster)
				{
					NodeStatus = DataSession.D(DataSessionKeyNodeStatus)
					WW.IsObj(NodeStatus) || (NodeStatus = {})
					NodeStatus.Online = false
					MachineRow = NodeStatus.Row
					if (NodeStatus.Row === NodeStatus.Master)
					{
						NodeStatus.Master = null
					}
				}
				else
				{
					MachineRow = PoolMapID[MachineIDHEX].Row
					NodeStatus =
					{
						Online : true,
						Row : MachineRow,
						Master : MachineRow,
					}
					OnPoolOn(
					{
						Row : MachineRow,
						IP : null,
						At : WW.Now(),
						VN : process.versions.node,
						VW : WW.Version,
						VP : PoolVersion,
						Plat : PlatArch,
					})
					OnPoolPing(
					{
						Row : MachineRow,
						Ping : 0,
						At : WW.Now(),
					})
				}
			})
			.FMap(Link.Init)
			.FMap(LinkGlobal.Init)
			.FMap(DB.RecMax)
			.Tap(B => RecID = B || RecID)
			.FMap(DB.RecCount)
			.Tap(B => RecCount = B)
			.FMap(() => StatFresh() || DB.StatGet(StatAt))
			.Tap(B =>
			{
				if (B)
				{
					StatIn = B.InBound
					StatOut = B.OutBound
					StatConn = B.Conn
				}
			})
			.FMap(DB.ExtAll)
			.Tap(B => WR.Each(V => ExtMap[V.Key] = V.Val,B))
			.Now(null,null,() =>
			{
				PipeMaster ? MakeNode() : MakeMaster()
				WW.IsNum(PortWeb) && new (require('ws')).Server({server : MakeWeb(PortWeb)}).on('connection',WebOnSocket)
			}),
		Exp : (X = require('express').Router()) => X
			.use((Q,S,N) => '/' === Q.path && !/\/(\?.*)?$/.test(Q.originalUrl) ? S.redirect(302,Q.baseUrl + Q.url) : N())
			.use((Q,S,N) => WebSolveFile(Q.path).Now(B => S.sendFile(B),() => N())),
		Soc : WebOnSocket,
	}
}