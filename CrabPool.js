'use strict'
var
WW = require('@zed.cwt/wish'),
{R : WR,X : WX,C : WC,N : WN} = WW,
Crypto = require('crypto'),
FS = require('fs'),
HTTP = require('http'),
Net = require('net'),

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

	LinkNew : 0x8600,
	LinkOn : 0x8602,
	LinkOff : 0x8604,
	LinkMod : 0x8606,
	LinkDel : 0x8608,

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
	PipeTimeout = Option.PipeTimeout || 3E5,
	TickInterval = Option.Tick || 6E4,
	PathData = Option.Data || WN.JoinP(WN.Data,'ZED/CrabPool'),
	PathLog = WN.JoinP(PathData,'Log'),
	LogRoll,
	LogTop = Option.Log,
	MakeLog,

	FileID = WN.JoinP(PathData,'ID'),
	FileToken = WN.JoinP(PathData,'Key'),

	DataSession = WN.JSON(WN.JoinP(PathData,'Session')),
	DataSessionKeyNodeStatus = 'Node',

	MachineIDSec,
	MachineIDSecHEX,
	MachineIDHEX,
	MachineRow,
	NodeStatus = {},
	WebToken,
	MakeSeed = () => WW.Rnd(0x4000000000000),
	MakeCount = (Q = 0) => () => WR.PadS0(4,Q++),
	MakeTime = (Q = WW.Now()) => () => WW.StrMS(WW.Now() - Q),
	MakeCD = H => H ?
		((S = H()) => Q => S.update(Q)) :
		(() => Q => Q),
	MakeCipher = MakeCD(Cipher),
	MakeDecipher = MakeCD(Decipher),
	MakePipeMasterCount = MakeCount(),
	MakePipeMaster = H => WX.Just()
		.FMap(() => WX.Any(PipeMaster(MakeLog(`Pipe ${MakePipeMasterCount()}`))))
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
				S.D(L)
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
		C = MakeCipher(),D = MakeDecipher(),

		PoolData,PoolIn = 0,PoolOut = 0,
		PoolRecSave = () =>
		{
			if (PoolData && PoolIn + PoolOut)
			{
				OnPoolRec(
				{
					Row : PoolData.Row,
					F2T : PoolData.F2T += PoolOut,
					T2F : PoolData.T2F += PoolIn,
				})
				PoolIn = PoolOut = 0
			}
		},
		PoolOnRec = WR.ThrottleDelay(StatInterval,PoolRecSave),

		OnPR = new Map,
		OnFin = new Map,
		Paused = false,
		TOD = WW.TOD(PipeTimeout,() => R.F('Timeout')),
		Write = (ID,Data,Enc) =>
		{
			if (Soc.writable)
			{
				var T,F = 0;
				for (T = Data.length;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
					MakeSocHeaderBuf[F - 1] |= 128
				for (T = ID;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
					MakeSocHeaderBuf[F - 1] |= 128
				for (T = ID + Data.length;T = (T - (MakeSocHeaderBuf[F++] = T % 128)) / 128;)
					MakeSocHeaderBuf[F - 1] |= 128
				// We copy the buffer here to prevent rewrting a queued one
				MakeSocHeaderBuf.copy(T = Buffer.allocUnsafe(F))
				Soc.write(C(T))
				if (!Soc.write(Enc ? C(Data) : Data) && !Paused)
				{
					Paused = true
					OnPR.forEach(V => V(true))
				}
				StatOnOut(F += Data.length)
				PoolOut += F
				PoolData && PoolOnRec()
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

		R =
		{
			D : TOD.D,
			O : (ProtoID,Data) => Write(ProtoID,ProtoEnc(ProtoID,Data),true),
			B : (ProtoID,Data) => Write(ProtoID,Data,true),
			P : (AuxID,Data) => Write(1 + 2 * AuxID,Data,false),
			E : E => R.O(Proto.Err,{Msg : E}),
			F : E =>
			{
				R.Fat = ErrorS(E)
				R.O(Proto.Fatal,{Msg : E})
				EndSocket(Soc)
			},
			Fat : '',
			Pool : P => PoolData = P,
			Paused : () => Paused,
			OnPR : (ID,PR) => PR ? OnPR.set(ID,PR) : OnPR.delete(ID),
			OnFin : (ID,Fin) => Fin ? OnFin.set(ID,Fin) : OnFin.delete(ID),
		};

		Soc
			.on('close',() =>
			{
				[...OnFin.values()].forEach(V => V())
				PoolRecSave()
				PoolData = null
			})
			.on('data',Q =>
			{
				Wait.U(Q)
				StatOnIn(Q.length)
				PoolIn += Q.length
				PoolData && PoolOnRec()
				for (;Q;)
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
		Sec.O(Proto.Noise,{Seed : Buffer.from(WR.Times(() => WW.Rnd(256),WW.Rnd(1,256)))})
	},



	AuxPool = new Map,
	AuxPoolKeyIsPipe = 0,
	AuxPoolKeyFin = 1,
	AuxPoolKeyData = 2,
	AuxPoolKeyEnd = 3,
	AuxPoolKeyPR = 4,
	AuxPoolKeyWaitTake = 2,
	AuxPipeFin = (Sec,AuxID) => Sec.O(Proto.AuxFin,{ID : AuxID}),
	AuxPipeData = (Sec,AuxID,Data) => Sec.P(AuxID,Data),
	AuxPipeEnd = (Sec,AuxID) => Sec.O(Proto.AuxEnd,{ID : AuxID}),
	AuxPipePR = (Sec,AuxID,Pause) => Sec.O(Proto.AuxPR,{ID : AuxID,Pause}),
	AuxMakeRecKeyFin = 0,
	AuxMakeRecKeyIO = 1,
	AuxMakeRec = (ID,From,Link) =>
	{
		var
		IO = [0,0],IOLink = [0,0],
		Save = () =>
		{
			OnRecRec(
			{
				Row : ID,
				Duration : WW.Now() - From,
				F2T : IO[0],
				T2F : IO[1],
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
					Link =
					IO =
					IOLink =
					Int = null
				}
			},
			(Dir,Q) =>
			{
				IO[Dir] += Q
				IOLink[Dir] += Q
			},
		]
	},
	AuxMakeRaw = (Host,Port) => Net.createConnection({host : Host,port : Port}),
	AuxMakeRawRaw = (ID,From,SocQ,SocS,IsGlobal,Row) =>
	{
		var
		Rec = AuxMakeRec(ID,From),
		Fin = S =>
		{
			if (!S && SocQ)
			{
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
		SocQ.on('error',WW.O)
			.on('close',() => Fin())
			.pipe(SocS)
		SocS.on('error',WW.O)
			.on('close',() => Fin())
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
		CurrentPaused = Sec.Paused,
		NextPaused = false,
		Paused = CurrentPaused || NextPaused,
		OnChange = () =>
		{
			Paused === (Paused = CurrentPaused || NextPaused) &&
				OnPR(Paused)
		};
		Sec.OnPR(AuxID,P => OnChange(CurrentPaused = P))
		return [
			() => Sec.OnPR(AuxID),
			P => OnChange(NextPaused = P),
		]
	},
	AuxMakeRawPipe = (ID,From,Soc,Sec,AuxID,RawIsFrom) =>
	{
		var
		C = MakeCipher(),D = MakeDecipher(),
		PR = AuxMakePR(Sec,AuxID,P => P ? Soc.pause() : Soc.resume()),
		Rec = AuxMakeRec(ID,From,RawIsFrom),
		Paused = false,
		Fin = S =>
		{
			if ((!S || S === Sec) && Sec)
			{
				EndSocket(Soc)
				AuxPipeFin(Sec,AuxID)
				AuxPool.delete(ID)
				PR[AuxPRKeyFin]()
				Rec[AuxMakeRecKeyFin]()
				Sec.OnFin(ID)
				PR =
				Rec =
				Soc =
				Sec = null
			}
		};
		Soc.on('error',E => null == E || OnRecErr({Row : ID,Err : String(E)}))
			.on('close',() => Fin())
			.on('data',Q =>
			{
				Rec[AuxMakeRecKeyIO](RawIsFrom ? 0 : 1,Q.length)
				AuxPipeData(Sec,AuxID,C(Q))
			})
			.on('end',() => AuxPipeEnd(Sec,AuxID))
			.on('drain',() => AuxPipePR(Sec,AuxID,Paused = false))
		Sec.OnFin(ID,Fin)
		AuxPool.set(ID,
		[
			true,
			Fin,
			(S,Q) =>
			{
				if (S === Sec)
				{
					Rec[AuxMakeRecKeyIO](RawIsFrom ? 1 : 0,Q.length)
					if (!Soc.write(D(Q)) && !Paused)
						AuxPipePR(Sec,AuxID,Paused = true)
				}
			},
			S => S === Sec && Soc.end(),
			(S,Pause) => S === Sec && PR[AuxPRKeyPR](Pause),
		])
		OnRecCon({Row : ID,At : WW.Now()})
	},
	AuxMakePipePipe = (ID,From,SecQ,AuxIDQ,SecS,AuxIDS) =>
	{
		var
		PRQ = AuxMakePR(SecQ,AuxIDQ,P => AuxPipePR(SecS,AuxIDS,P)),
		PRS = AuxMakePR(SecS,AuxIDS,P => AuxPipePR(SecQ,AuxIDQ,P)),
		Rec = AuxMakeRec(ID,From),
		Fin = S =>
		{
			if ((!S || S === SecQ || S === SecS) && SecQ)
			{
				AuxPipeFin(SecQ,AuxIDQ)
				AuxPipeFin(SecS,AuxIDS)
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
					Rec[AuxMakeRecKeyIO](0,Q.length)
					AuxPipeData(SecS,AuxIDS,Q)
				}
				else if (S === SecS)
				{
					Rec[AuxMakeRecKeyIO](1,Q.length)
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
	AuxOnAny0 = H => (Sec,AuxID) => (AuxID = AuxPool.get(AuxID)) && AuxID[H](Sec),
	AuxOnPipe0 = H => (Sec,AuxID) => (AuxID = AuxPool.get(AuxID)) && AuxID[AuxPoolKeyIsPipe] && AuxID[H](Sec),
	AuxOnPipe1 = H => (Sec,AuxID,Q) => (AuxID = AuxPool.get(AuxID)) && AuxID[AuxPoolKeyIsPipe] && AuxID[H](Sec,Q),
	AuxOnFin = AuxOnAny0(AuxPoolKeyFin),
	AuxOnData = AuxOnPipe1(AuxPoolKeyData),
	AuxOnEnd = AuxOnPipe0(AuxPoolKeyEnd),
	AuxOnPR = AuxOnPipe1(AuxPoolKeyPR),
	AuxWaitRaw = (ID,From,Soc,SecExp,Link) =>
	{
		var
		Fin = S =>
		{
			if ((!S || S === SecExp) && Soc)
			{
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
			(Sec,AuxID) => SecExp === Sec && AuxMakeRawPipe(ID,From,Soc,Sec,AuxID,Link),
		])
	},
	AuxWaitPipe = (ID,From,SecQ,AuxIDQ,SecExp) =>
	{
		var
		Fin = S =>
		{
			if ((!S || S === SecExp) && SecQ)
			{
				AuxPipeFin(SecQ,AuxIDQ)
				AuxPool.delete(ID)
				SecQ.OnFin(ID)
				SecQ = null
			}
		};
		SecQ.OnFin(ID,Fin)
		AuxPool.set(ID,
		[
			0,
			Fin,
			(SecS,AuxIDS) =>
			{
				if (SecExp === SecS)
				{
					SecQ.O(Proto.Take,{From : AuxIDQ,To : ID})
					AuxMakePipePipe(ID,From,SecQ,AuxIDQ,SecS,AuxIDS)
				}
			},
		])
	},
	AuxOnWaitTake = (Sec,AuxID,Q) =>
	{
		AuxID = AuxPool.get(AuxID)
		if (AuxID && 0 === AuxID[AuxPoolKeyIsPipe])
			AuxID[AuxPoolKeyWaitTake](Sec,Q)
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
		}
		WebBroadcast(Proto.OnLinkDis,{IsGlobal,Row})
	},
	OnLinkMod = OnDBLink(true,Proto.OnLinkMod,'Mod'),
	OpLinkMod = (Sec,Data) => OpLinkCheck(Sec,Data) && OnLinkMod(Data),
	OnLinkDel = OnDBLink(true,Proto.OnLinkDel,'Del'),
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

	OnRecNew = OnDB(null,DB.RecNew),
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
						Data.Ack === HelloSeed ||
							Sec.F(`Ack failure ${HelloSeed} ${Data.Ack}`)
						return
					}
					Preparing = true

					IDSec = Data.Sec
					if (!IDSec) return Sec.F('Unnamed')
					if (MachineIDSecHEX === WC.HEXS(IDSec)) return Sec.F('Not unique')
					IDSec = WC.HEXS(StepB(IDSec))
					PoolData = PoolMapID[IDSec]
					if (!PoolData)
					{
						OnPoolNew({Row : ++PoolID,ID : IDSec,Birth : WW.Now()})
						PoolData = PoolMapRow[PoolID]
					}
					Row = PoolData.Row
					if (MasterOnline.has(Row))
					{
						MasterOnline.get(Row).F('Kicked by ' + RemoteIP(S))
					}
					OnPoolOn(
					{
						Row,
						IP : RemoteIP(S),
						At : WW.Now(),
						VN : Data.VerNode,
						VW : Data.VerWish,
						VP : Data.VerPool,
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
					Sec.O(Proto.Hello,
					{
						Row,
						Master : MachineRow,
						Syn : HelloSeed,
						Ack : Data.Syn,
					})
					Ping.C()

					Sec.Pool(PoolData)

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
					if (Data.To !== MachineRow && !MasterOnline.has(Data.To) ||
						null == Data.ID ||
						Data.From == Data.To)
					{
						AuxPipeFin(Sec,Data.ID)
						return
					}

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
				[Proto.AuxFin] : WithInit(Data => AuxOnFin(Sec,Data.ID)),
				[Proto.AuxEnd] : WithInit(Data => AuxOnEnd(Sec,Data.ID)),
				[Proto.AuxPR] : WithInit(Data => AuxOnPR(Sec,Data.ID)),

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
					Sec.Pool(PoolMapRow[NodeStatus.Master])
					Log('Authed')
				},
				[Proto.Ping] : Data => Sec.O(Proto.Ping,Data),

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
					})
					StatOnConn()

					Sec.O(Proto.Take,{From : Data.ID,To : AuxID})
					AuxMakeRawPipe(AuxID,At,AuxMakeRaw(Data.Host,Data.Port),Sec,Data.ID,false)
				},
				[Proto.Take] : Data => AuxOnWaitTake(Sec,Data.From,Data.To),
				[Proto.AuxFin] : Data => AuxOnFin(Sec,Data.ID),
				[Proto.AuxEnd] : Data => AuxOnEnd(Sec,Data.ID),
				[Proto.AuxPR] : Data => AuxOnPR(Sec,Data.ID),



				[Proto.OnPoolLst] : OnPoolLst,
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
			})
		}).RetryWhen(E => E.Delay(PipeRetry)).Now()
	},



	MakeLinkServer = (IsGlobal,Row) =>
	{
		var
		Count = MakeCount(),
		Log = MakeLog(`Link${IsGlobal ? 'Global' : ''} [${Row}]`),
		Online,Paused = false,
		Local,Target,Host,Port,Req,
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
				Sec;
				OnLinkCon({IsGlobal,Row,At})
				OnRecNew(
				{
					Row : AuxID,
					Birth : At,
					From : MachineRow,
					To : Target,
					Req,
					Client : RemoteIP(S),
				})
				StatOnConn()
				if (Target === MachineRow)
				{
					AuxMakeRawRaw(AuxID,At,S,AuxMakeRaw(Host,Port),IsGlobal,Row)
				}
				else if (PipeMaster ?
					NodeOnline && !!PoolMapRow[Target] :
					MasterOnline.has(Target))
				{
					S.on('error',WW.O)
						.on('close',Fin)
					Sec = PipeMaster ? NodeMasterSec : MasterOnline.get(Target)
					AuxWaitRaw(AuxID,At,S,Sec,[IsGlobal,Row])
					Sec.O(Proto.Wish,
					{
						ID : AuxID,
						From : MachineRow,
						To : Target,
						Host,
						Port,
					})
				}
				else
				{
					OnRecOff(AuxID)
					Fin()
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
				Req = SolveReq(Host,Port)
				Suppress || OnChange()
			},
			F : End,
			O : On => OnChange(Online = On),
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
			[Proto.PoolDel] : WithInit(Data => OpPoolDel(Sec,Data)),

			[Proto.LinkNew] : WithInit(OnLink(Data => OpLinkNew(Sec,Data))),
			[Proto.LinkOn] : WithInit(OnLinkOn),
			[Proto.LinkOff] : WithInit(OnLinkOff),
			[Proto.LinkMod] : WithInit(OnLink(Data => OpLinkMod(Sec,Data))),
			[Proto.LinkDel] : WithInit(OnLink(OnLinkDel)),

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

				DB.RecCount().FMap(Count =>
					DB.RecGet(Page,PageSize).Tap(Rec =>
						Send(Proto.RecRes,{Count,Rec})))
					.Now(null,E => Err(`Failed to load rec ${ErrorS(E)}`))
			}),
			[Proto.RecCut] : WithInit(Data =>
			{
				AuxOnFin(null,Data.Row)
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
				DB.StatAfter(Today - 30 * DayMS)
					.Now(Stat =>
					{
						Send(Proto.StatRes,{Today,Stat})
					},E =>
					{
						Err(`Failed to load stat ${ErrorS(E)}`)
					})
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