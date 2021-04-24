'use strict'
~function()
{
	var
	WW = Wish,
	WR = WW.R,
	WC = WW.C,
	WB = WW.B,
	WV = WW.V,
	Top = Wish.Top,
	Confirm = Top.confirm,
	Console = Top.console,



	DayMS = 864E5,



	ClassCard = WW.Key(),

	Noti = WV.Noti(),
	NotiConn = Noti.O(),
	NotiNewToken = Noti.O(),
	ShortCut = WB.SC(),

	Sure = function(Q,S){Confirm(Q.join('\n')) && S()},
	StoreKey = '[CrabPool]~',
	StoreKeyClipHeight = 'ClipHeight',
	StoreGet = function(Q){return WB.StoG(StoreKey + Q)},
	StoreSet = function(Q,S){return WB.StoS(StoreKey + Q,S)},

	OnTick = WW.BusS(),

	SolveSize = function(Q){return null == Q ? '-' : WR.ToSize(Q) + ' (' + Q + ')'},
	SolveSpeed = function(Q,S){return WR.ToSize(1E3 * Q / (S || 1)) + '/s'},

	LogEnabled = false,
	Log = function()
	{
		LogEnabled && WW.Ap(Console.log,Console,arguments)
	},
	CrabPool =
	{
		O : function()
		{
			LogEnabled = !LogEnabled
			return 'Log is ' + (LogEnabled ? 'on' : 'off')
		}
	},



	Proto = {},
	ProtoInv = WR.Inv(Proto),
	ProtoPB = '',
	ProtoJar = WC.PBJ().S(WC.B91P(ProtoPB)),
	ProtoEnc = function(ProtoID,Data){return Data ? ProtoJar.E(ProtoInv[ProtoID],Data) : WC.Buff(0)},
	ProtoDec = function(ProtoID,Data){return ProtoJar.D(ProtoInv[ProtoID],Data)},
	MakeProtoAct = function(P,H)
	{
		return function(OnError,ProtoID,Data)
		{
			var Act = H[ProtoID];
			if (Act)
				try
				{
					Data = P(ProtoID,Data)
					ProtoLog('In',ProtoID,Data)
					Act(Data)
				}
				catch(E){OnError('[' + ProtoID + '] ' + E)}
		}
	},
	ProtoLog = function(Dir,ProtoID,Data)
	{
		Log(Dir,ProtoInv[ProtoID],Data)
	},

	NodeStatus = {},
	NodeIsMaster = function(Q)
	{
		return NodeStatus.Master && NodeStatus.Master === (Q || NodeStatus).Row
	},
	MakeSeed = function(){return WW.Rnd(0x4000000000000)},

	ListRowFind = function(List,Q){return WW.BSL(List,Q.Row,function(Q,S){return Q.Row < S})},
	ListRowNew = function(List,Q)
	{
		!List.length || List[~-List.length].Row < Q.Row ?
			List.push(Q) :
			List.splice(ListRowFind(List,Q),0,Q)
	},
	ListRowDel = function(List,Q)
	{
		Q = ListRowFind(List,Q)
		Q < List.length && List.splice(Q,1)
	},
	StepA = function(Q){return WC.HSHA512(Q,'NE##*(&J')},
	StepB = function(Q){return WC.HSHA512('A5:;-)%M',Q)},

	PoolList = [],
	PoolListSorted = [],
	PoolMapRow = {},
	PoolOnData,
	PoolIndex,
	PoolShowBrief = function(Q){return '#' + Q.Row + ' ' + (Q.Name || '[Unnamed]')},
	PoolShow = function(Q){return PoolShowBrief(Q) + (Q.Desc ? ' | ' + Q.Desc : '')},
	PoolShowRow = function(Q)
	{
		var P = PoolMapRow[Q];
		return P ? PoolShow(P) : '#' + Q + ' <Inactive Node>'
	},
	MakeLink = function()
	{
		var
		List = [],
		Row = {},
		Panel;
		return {
			Pan : function(Q)
			{
				Panel = Q
			},
			All : function()
			{
				return List
			},

			Lst : function(Q)
			{
				List = Q.Link || []
				Row = {}
				WR.Each(function(V)
				{
					Row[V.Row] = V
				},List)
				Panel.Lst(List)
			},
			New : function(Q)
			{
				Q.Online = 9
				Q.Visit = 0
				Q.Last = null
				Q.F2T = 0
				Q.T2F = 0
				Q.Using = 0
				Q.Deploy = null
				Q.Err = null
				ListRowNew(List,Q)
				Row[Q.Row] = Q
				Panel.New(Q)
			},
			On : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					L.Online = true
					Panel.On(Q)
				}
			},
			Off : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					L.Online = false
					Panel.Off(Q)
				}
			},
			Con : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					++L.Visit
					++L.Using
					L.Last = Q.At
					Panel.Con(Q)
				}
			},
			Dis : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					--L.Using
					Panel.Dis(Q)
				}
			},
			Mod : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					L.Local = Q.Local
					L.Target = Q.Target
					L.Host = Q.Host
					L.Port = Q.Port
					Panel.Mod(Q)
				}
			},
			Del : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					ListRowDel(List,Q)
					WR.Del(Q.Row,Row)
					Panel.Del(L)
				}
			},
			Rec : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					L.F2T += Q.F2T
					L.T2F += Q.T2F
					Panel.Rec(Q)
				}
			},
			Dep : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					L.Deploy = Q.Deploy
					L.Err = Q.Err
					Panel.Dep(Q)
				}
			},
			Ind : function(Q)
			{
				var L = Row[Q.Row];
				if (L)
				{
					L.Ind = Q.Ind
					Panel.Ind(Q)
				}
			}
		}
	},
	LinkGlobal = MakeLink(9),
	Link = MakeLink(0),
	OnLink = function(H)
	{
		return function(Data)
		{
			(Data.IsGlobal ? LinkGlobal : Link)[H](Data)
		}
	},
	ExtMap = {},
	ExtOnChange = WW.Bus(),
	RecOnRec,
	StatOnStat,



	Online,
	WebSocketNotConnected = function(){Noti.S('Unable to perform when not connected')},
	WebSocketSend = WebSocketNotConnected,
	WSKey,WSCipher,WSDecipher,
	WSTouching,WSTouched,WSFatalCurr,WSFatalChecksum,
	WSOnOffline = WW.BusS(),
	WSFatal = function(E)
	{
		WSFatalCurr = E
		WS.F()
	},
	WS = WB.WS(
	{
		Rect : false,
		Str : function(Q)
		{
			if (!WSCipher)
			{
				WSKey = StepB(Q + WC.U8S(StepB(StepA(WSKey))))
				WSCipher = WC.AESES(WC.Slice(WSKey,0,32),WC.Slice(WSKey,-16),WC.OFB)
				WSDecipher = WC.AESDS(WC.Slice(WSKey,0,32),WC.Slice(WSKey,-16),WC.OFB)
				WebSocketSend = function(ProtoID,Data)
				{
					ProtoLog('Out',ProtoID,Data)
					Data = ProtoEnc(ProtoID,Data)
					WS.D(WSCipher.D(WC.BV()
						.UV(ProtoID)
						.UV(ProtoID + Data.length)
						.B()
						.concat(Data)))
					return true
				}
				WebSocketSend(Proto.Hello,{Syn : WSKey = MakeSeed()})
			}
		},
		Bin : function(Q)
		{
			var
			B = WC.BV(WSDecipher.D(Q)),
			ID = B.UV(),
			Check = B.UV(),
			Data = B.N();
			if (Check === ID + Data.length)
				WSAction(WSFatal,ID,Data)
			else
			{
				WSFatalChecksum = true
				Log('Checksum failure ' + ID + ' + ' + Data.length + ' != ' + Check)
				WS.F()
			}
		},
		Hsk : function()
		{
			WSTouched = true
			NotiConn('Handshaking...')
		},
		End : function()
		{
			NotiConn(
			[
				'Disconnected | ',
				WSFatalCurr ? WSFatalCurr :
				!WSTouched ? 'Connection timeout' :
				!Online ? 'Failed to handshake, the token may not be correct' :
				WSFatalChecksum ? 'Transmission corrupted' :
				'Connection closed'
			])
			Online =
			WSKey =
			WSCipher =
			WSDecipher =
			WSTouching =
			WSTouched =
			WSFatalCurr =
				false
			WebSocketSend = WebSocketNotConnected
			RTab.At(0)
			WSOnOffline.D()
		}
	}),
	WSConn = function()
	{
		Online =
		WSTouched =
		WSFatalCurr =
			false
		WSTouching = true
		WS.C()
	},
	WSAction = MakeProtoAct(ProtoDec,WW.MakeO
	(
		Proto.Fatal,function(Data)
		{
			WSFatal(Data.Msg)
		},
		Proto.Err,function(Data)
		{
			Noti.S(Data.Msg)
		},

		Proto.Hello,function(Data)
		{
			if (Data.Ack !== WSKey)
				return WSFatal('Ack failure ' + WSKey + ' ' + Data.Ack)

			NotiConn('Connected')
			NotiConn(false)
			Online = true
			WebSocketSend(Proto.Hello,{Ack : Data.Syn})
		},



		Proto.NodeStatus,function(Data)
		{
			NodeStatus = Data
			PoolOnData.Node(NodeStatus)
			LinkPanel[0].Node(NodeStatus)
			LinkPanel[1].Node(NodeStatus)
		},
		Proto.TokenNew,function()
		{
			NotiNewToken('New token saved, connect again')
			NotiNewToken(false)
		},
		Proto.RecRes,function(Data)
		{
			RecOnRec(Data)
		},
		Proto.StatRes,function(Data)
		{
			StatOnStat(Data)
		},



		Proto.OnPoolLst,function(Data)
		{
			PoolList = Data.Pool || []
			PoolMapRow = {}
			WR.Each(function(V)
			{
				PoolMapRow[V.Row] = V
			},PoolList)
			PoolOnData.Lst(PoolList)
		},
		Proto.OnPoolNew,function(Data)
		{
			var
			P =
			{
				Row : Data.Row,
				Enabled : 9,
				ID : Data.ID,
				Birth : Data.Birth,
				Name : '',
				Desc : '',
				Count : 0,
				F2T : 0,
				T2F : 0,
			};
			if (!PoolMapRow[Data.Row])
			{
				ListRowNew(PoolList,P)
				PoolMapRow[Data.Row] = P
				PoolOnData.New(P)
			}
		},
		Proto.OnPoolNm,function(Data)
		{
			var P = PoolMapRow[Data.Row];
			if (P)
			{
				P.Name = Data.Nm
				PoolOnData.Nm(P)
			}
		},
		Proto.OnPoolDes,function(Data)
		{
			var P = PoolMapRow[Data.Row];
			if (P)
			{
				P.Desc = Data.Des
				PoolOnData.Des(P)
			}
		},
		Proto.OnPoolOn,function(Data)
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
				PoolOnData.On(P)
			}
		},
		Proto.OnPoolOff,function(Data)
		{
			var P = PoolMapRow[Data.Row];
			if (P)
			{
				P.Online = 0
				P.LastOff = Data.At
				PoolOnData.Off(P)
			}
		},
		Proto.OnPoolPing,function(Data)
		{
			var P = PoolMapRow[Data.Row];
			if (P)
			{
				P.Ping = Data.Ping
				P.LastOff = Data.At
				PoolOnData.Ping(P)
			}
		},
		Proto.OnPoolDel,function(Data)
		{
			var P = PoolMapRow[Data.Row];
			if (P)
			{
				P.Enabled = false
				ListRowDel(PoolList,Data)
				WR.Del(Data.Row,PoolMapRow)
				PoolOnData.Del(P)
			}
		},
		Proto.OnPoolRec,function(Data)
		{
			var P = PoolMapRow[Data.Row];
			if (P)
			{
				P.F2T = Data.F2T
				P.T2F = Data.T2F
				PoolOnData.Rec(P)
			}
		},

		Proto.OnLinkLst,OnLink('Lst'),
		Proto.OnLinkNew,OnLink('New'),
		Proto.OnLinkOn,OnLink('On'),
		Proto.OnLinkOff,OnLink('Off'),
		Proto.OnLinkCon,OnLink('Con'),
		Proto.OnLinkDis,OnLink('Dis'),
		Proto.OnLinkMod,OnLink('Mod'),
		Proto.OnLinkDel,OnLink('Del'),
		Proto.OnLinkRec,OnLink('Rec'),
		Proto.OnLinkDep,OnLink('Dep'),
		Proto.OnLinkInd,OnLink('Ind'),

		Proto.OnExtLst,function(Data)
		{
			var K = ExtMap;
			ExtMap = {}
			WR.Each(function(V)
			{
				WR.Del(V.Key,K)
				ExtMap[V.Key] = V.Val
				ExtOnChange.Emit(V.Key,V.Val)
			},Data.Ext)
			WR.EachU(function(_,F)
			{
				ExtOnChange.Emit(F,null)
			},K)
		},
		Proto.OnExtSet,function(Data)
		{
			Data.Val ?
				ExtMap[Data.Key] = Data.Val :
				WR.Del(Data.Key,ExtMap)
			ExtOnChange.Emit(Data.Key,Data.Val)
		}
	)),



	Rainbow = WV.Div(2,['10%'],true),
	RTab = WV.Split({Pan : Rainbow,Main : true}),
	RTopState = WV.Fmt('`S` `O` / `P`\nGlobalLink `L` / `I`\nLink `N` / `K`','-'),

	MakeLinkPanel = WR.Curry(function(IsGlobal,Pan)
	{
		var
		ClassControl = WW.Key(),
		ClassDesc = WW.Key(),
		LinkPool = IsGlobal ? LinkGlobal : Link,
		LinkTargetDrop = [],
		OnlineCount,
		CardList = [],
		CardRow = {},
		MakeTarget = function()
		{
			var
			U = WV.Inp({Hint : 'Choose the target'});
			return {
				R : U,
				Drop : function(Q)
				{
					var V;
					if (Q.length)
					{
						V = U.V()
						if (NewCond()) U.On()
						U.Drop(Q,function(S,_,Q)
						{
							return Q.test(S[1][0]) || Q.test(S[3])
						})
						U.V(V)
					}
					else U.Off().V('')
				},
				V : U.V
			}
		},
		MakeAddr = function(){return WV.Inp({Hint : '${Host}:${Port} or ${Port} only'})},
		MakeDeploy = function(Q)
		{
			return WV.Inp(
			{
				Hint : 'Local Deploy Port',
				Yep : WV.InpYZ,
				Ent : Q,
				Map : function(Q){return WR.Trim(Q) && 0 | Q}
			})
		},
		MakeCard = function()
		{
			var
			LinkData,
			LinkDataOnline,

			Card = WV.Rock(ClassCard + ' ' + WV.S4,'fieldset'),
			Index = WV.A('legend'),
			Control = WV.Rock(ClassControl),
			Enabled = WV.Cho(
			{
				Set : [[9,'Enabled'],[0,'Disabled']],
				Blk : false,
				Inp : function()
				{
					LinkData && WebSocketSend(Enabled.V() ? Proto.LinkOn : Proto.LinkOff,
					{
						IsGlobal : IsGlobal,
						Row : LinkData.Row
					})
				}
			}),
			Ind = WV.Cho(
			{
				Mul : true,
				Set : [[true,'Independent Connection']],
				Blk : false,
				Inp : function()
				{
					LinkData && WebSocketSend(Proto.LinkInd,
					{
						IsGlobal : IsGlobal,
						Row : LinkData.Row,
						Ind : Ind.V().length
					})
				}
			}),
			Save = WV.But(
			{
				X : 'Save Changes',
				The : WV.TheO,
				C : function()
				{
					LinkData && WebSocketSend(Proto.LinkMod,
					{
						IsGlobal : IsGlobal,
						Row : LinkData.Row,
						Local : Deploy.V(),
						Target : Target.V(),
						Addr : Addr.V()
					})
				}
			}),
			Del = WV.But(
			{
				X : 'Remove',
				The : WV.TheP,
				C : function()
				{
					LinkData && Sure(
					[
						'Sure to remove this link?',
						'[' + LinkData.Port + '] ' + PoolShowRow(LinkData.Target),
						LinkData.Addr
					],function()
					{
						LinkData && WebSocketSend(Proto.LinkDel,
						{
							IsGlobal : IsGlobal,
							Row : LinkData.Row
						})
					})
				}
			}),
			Target = MakeTarget(),
			Addr = MakeAddr(),
			Deploy = MakeDeploy(),
			Stat = WV.Fmt('[Port `P`] Visited `V`. Using `U`. Sent `S`. Received `C`. Created `B`. Last `F``E`','-'),

			OnOF = function()
			{
				LinkDataOnline = LinkData.Online
				Enabled.V(LinkDataOnline ? 9 : 0,true)
				Stat
					.P(LinkData.Online && LinkData.Deploy || '-')
					.E(LinkData.Online && LinkData.Err ? '\n' + LinkData.Err : '')
			},
			OnTarget = function()
			{
				Target.V(LinkData.Target)
				Addr.V((LinkData.Host ? LinkData.Host + ':' : '') + LinkData.Port)
				Deploy.V(LinkData.Local)
			},
			OnRec = function()
			{
				Stat
					.S(SolveSize(LinkData.F2T))
					.C(SolveSize(LinkData.T2F))
			},
			OnInd = function()
			{
				Ind.V(LinkData.Ind ? [true] : [],true)
			};
			WV.ApR([Enabled,Ind,Save,Del],Control)
			WV.ApR([Index,Control,Target.R,Addr,Deploy,Stat],Card)
			return {
				R : Card,
				In : function(Q)
				{
					LinkData = Q
					Stat
						.B(WW.StrDate(Q.Birth))
						.V(Q.Visit)
						.U(Q.Using)
						.F(null == Q.Last ? '-' : WW.StrDate(Q.Last))
					OnOF()
					OnTarget()
					OnRec()
					OnInd()
				},
				Out : function()
				{
					LinkData = null
				},
				Drop : Target.Drop,
				Idx : function(Q,S)
				{
					WV.T(Index,
						WR.PadU(Q,~-S) + ' / ' + S +
						' #' + LinkData.Row)
				},
				Cond : function(Q)
				{
					if (Q)
					{
						Ind.On()
						WV.ApR([Save,Del],Control)
						Target.R.On()
						Addr.On()
						Deploy.On()
					}
					else
					{
						Ind.Off()
						WV.Del(Save.R)
						WV.Del(Del.R)
						Target.R.Off()
						Addr.Off()
						Deploy.Off()
					}
				},

				On : function()
				{
					if (!LinkDataOnline)
					{
						++OnlineCount
						OnCount()
					}
					OnOF()
				},
				Off : function()
				{
					if (LinkDataOnline)
					{
						--OnlineCount
						OnCount()
					}
					OnOF()
				},
				Con : function()
				{
					Stat
						.V(LinkData.Visit)
						.U(LinkData.Using)
						.F(WW.StrDate(LinkData.Last))
				},
				Dis : function()
				{
					Stat.U(LinkData.Using)
				},
				Mod : OnTarget,
				Rec : OnRec,
				Dep : OnOF,
				Ind : OnInd
			}
		},
		SortList = WR.Sort(function(Q,S)
		{
			return PoolIndex[Q.Target] - PoolIndex[S.Target] ||
				Q.Local - S.Local
		}),
		ToDrop = WR.Map(function(V)
		{
			return [
				V.Row,
				[
					PoolShowBrief(V),
					V.Desc && function(){return WV.Text(WV.Rock(ClassDesc),V.Desc)}
				],
				PoolShow(V),
				V.Desc || ''
			]
		}),
		OnList = WR.ThrottleDelay(2E2,function(Q)
		{
			var
			PrevCardList = CardList,
			Cond = NewCond();
			OnlineCount = 0
			CardList = []
			CardRow = {}
			LinkTargetDrop = ToDrop(PoolListSorted)
			NewTarget.Drop(LinkTargetDrop)
			WR.EachU(function(V,F)
			{
				var C = PrevCardList[F];
				OnlineCount += !!V.Online
				if (!C)
				{
					C = MakeCard()
					WV.Ap(C.R,Pan)
				}
				CardList.push(C)
				CardRow[V.Row] = C
				C.In(V)
				C.Drop(LinkTargetDrop)
				C.Idx(F,Q.length)
				C.Cond(Cond)
			},SortList(Q))
			WR.Each(function(V)
			{
				V.Out()
				WV.Del(V.R)
			},PrevCardList.slice(CardList.length))
			OnCount()
		}),
		OnCount = function()
		{
			var Len = LinkPool.All().length;
			RTopState
				[IsGlobal ? 'L' : 'N'](WR.PadU(OnlineCount,~-Len))
				[IsGlobal ? 'I' : 'K'](Len)
		},
		OnIndex = function()
		{
			var List = SortList(LinkPool.All());
			LinkTargetDrop = ToDrop(PoolListSorted)
			NewTarget.Drop(LinkTargetDrop)
			WR.EachU(function(V,F)
			{
				var C = CardRow[V.Row];
				if (C)
				{
					C.Drop(LinkTargetDrop)
					C.Idx(F,List.length)
				}
			},List)
		},
		Dispatch = function(H)
		{
			return function(Q)
			{
				var C = CardRow[Q.Row];
				C && C[H](Q)
			}
		},

		NewCond = function()
		{
			return !IsGlobal || NodeIsMaster()
		},
		NewCard = WV.Rock(ClassCard + ' ' + WV.S4),
		NewTarget = MakeTarget(),
		NewAddr = MakeAddr(),
		NewNew = WV.But(
		{
			X : 'Add New Link',
			The : WV.TheO,
			C : function()
			{
				if (!IsGlobal || NewCond())
					if (WebSocketSend(Proto.LinkNew,
					{
						IsGlobal : IsGlobal,
						Local : NewDeploy.V(),
						Target : NewTarget.V(),
						Addr : NewAddr.V()
					}))
					{
						NewDeploy.V('').Foc()
					}
			}
		}),
		NewDeploy = MakeDeploy(NewNew.C),

		OnNode = function()
		{
			var C = NewCond();
			(C ? WV.ClsR : WV.ClsA)(NewCard,WV.None)
			WR.Each(function(V)
			{
				V.Cond(C)
			},CardList)
		};

		WV.ApR([NewTarget.R,NewAddr,NewDeploy,NewNew],NewCard)
		WV.Ap(NewCard,Pan)
		OnNode()

		LinkPool.Pan(LinkPanel[IsGlobal ? 0 : 1] =
		{
			Node : OnNode,
			Idx : OnIndex,

			Lst : OnList,
			New : function(Q)
			{
				var
				C = MakeCard(),
				List = LinkPool.All();
				OnlineCount += !!Q.Online
				WV.After(C.R,NewCard)
				CardList.unshift(C)
				CardRow[Q.Row] = C
				C.In(Q)
				C.Drop(LinkTargetDrop)
				C.Cond(NewCond())
				OnCount()
				WR.EachU(function(V,F)
				{
					var C = CardRow[V.Row];
					C.Idx(F,List.length)
				},SortList(List))
			},
			On : Dispatch('On'),
			Off : Dispatch('Off'),
			Con : Dispatch('Con'),
			Dis : Dispatch('Dis'),
			Mod : function(Q)
			{
				Dispatch('Mod')(Q)
				OnIndex()
			},
			Del : function(Q)
			{
				var C = CardRow[Q.Row];
				C.Out()
				WV.Del(C.R)
				WR.Del(Q.Row,CardRow)
				C = CardList.indexOf(C)
				if (~C) CardList.splice(C,1)
				if (Q.Online) --OnlineCount
				OnCount()
			},
			Rec : Dispatch('Rec'),
			Dep : Dispatch('Dep'),
			Ind : Dispatch('Ind')
		})

		return {
			CSS : function()
			{
				return WW.Fmt
				(
					'.`C`>*{vertical-align:middle}' +
					'.`D`{font-size:.9em;color:#A9A9A9}',
					{
						C : ClassControl,
						D : ClassDesc
					}
				)
			}
		}
	}),
	LinkPanel = [];

	WV.CSS(Rainbow[1],'min-width',100)
	WV.Ap(RTopState.R,RTab.B)

	WV.Style(WW.Fmt
	(
		'body{height:100%;font-size:14px;overflow:hidden}' +

		'.`T`>.`M`{text-align:center;margin:6px 0}' +
		'.`V`{padding:0 20px}' +
		'.`V`>*{margin:20px 0}' +

		'.`C`{padding:20px}' +
		'fieldset.`C`{padding:4px 20px 20px}' +
		'.`C`>*{margin:4px 0}' +
		'.`C` legend{margin:0}' +
		'.`C` button{padding-top:0;padding-bottom:0}' +
		'',
		{
			T : WV.TabT,
			V : WV.TabW,
			M : WV.FmtW,

			C : ClassCard
		}
	))



	RTab.Add(
	[
		['Auth',function(V)
		{
			var
			Pan = WV.Rock(WV.S6),
			Connect = function()
			{
				if (!WSTouching)
				{
					NotiConn('Connecting...')
					WSKey = Token.V()
					Token.V('').Fresh().Foc()
					TokenEnt.Off()
					TokenNew.On()
					TokenNewEnt.On()
					WSConn()
				}
			},
			Token = WV.Inp(
			{
				Hint : 'Token',
				Pass : true,
				Ent : Connect
			}),
			TokenEnt = WV.But(
			{
				X : 'Connect',
				The : WV.TheO,
				Blk : true,
				C : Connect
			}),
			SaveNew = function()
			{
				if (Online && WebSocketSend(Proto.TokenNew,
				{
					Old : StepA(Token.V()),
					New : StepA(TokenNew.V()),
				}))
				{
					Token.V('').Fresh()
					TokenNew.V('').Fresh().Foc()
					NotiNewToken('Saving the new token')
				}
			},
			TokenNew = WV.Inp(
			{
				Hint : 'New Token',
				Pass : true,
				Ent : SaveNew
			}).Off(),
			TokenNewEnt = WV.But(
			{
				X : 'Save New Token',
				The : WV.TheO,
				Blk : true,
				C : SaveNew
			}).Off();

			NotiConn('Enter the Token to connect')
			WSOnOffline.R(function()
			{
				TokenEnt.On()
				TokenNew.Off()
				TokenNewEnt.Off()
			})
			WV.ApR(
			[
				Token,TokenEnt,
				TokenNew,TokenNewEnt
			],Pan)
			WV.Ap(Pan,V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`{padding:40px;text-align:center}' +
						'#`R`>div{margin:auto;padding:20px;max-width:26em}' +
						'#`R` .`I`{margin:20px 0}',
						{
							R : ID,
							I : WV.InpW
						}
					)
				}
			}
		}],
		['Pool',function(Pan,_,PanK)
		{
			var
			OnlineCount,
			CardList = [],
			CardRow = {},
			MakeCard = function()
			{
				var
				PoolData,
				PoolDataOnline,

				Card = WV.Rock(ClassCard + ' ' + WV.S4,'fieldset'),
				Index = WV.A('legend'),
				Identity = WV.Fmt('#`W` [`O` `P`ms] (`I` Node v`VN` Wish v`VW` Pool v`VP`)','-',WV.A('span')),
				MakeEdit = function(Opt,Act)
				{
					var V,R;
					Opt.Foc = function(){V = R.V()}
					Opt.Out = function()
					{
						V === (V = R.V()) || Act(V)
					}
					return R = WV.Inp(Opt)
				},
				Name = MakeEdit({Hint : 'Unnamed'},function(V)
				{
					PoolData && WebSocketSend(Proto.PoolNm,{Row : PoolData.Row,Nm : V})
				}),
				Desc = MakeEdit({Type : WV.InpPX,Hint : 'No Description'},function(V)
				{
					PoolData && WebSocketSend(Proto.PoolDes,{Row : PoolData.Row,Des : V})
				}),
				Stat = WV.Fmt('Visited `V`. Sent `S`. Received `C`. Created `B`. Last `F` => `T` (`K`)'),
				Del = WV.But(
				{
					X : 'Remove',
					The : WV.TheP,
					C : function()
					{
						if (PoolData && !PoolData.Online)
						(
							Sure(
							[
								'Sure to remove this machine?',
								PoolShowBrief(PoolData),
								PoolData.Desc || '',
							],function()
							{
								if (PoolData && !PoolData.Online)
									WebSocketSend(Proto.PoolDel,{Row : PoolData.Row})
							})
						)
					}
				}),

				OnIP = function()
				{
					Identity.I(PoolData.IP ||
						NodeIsMaster(PoolData) && NodeStatus.MasterIP ||
						'::')
				},
				OnOF = function()
				{
					PoolDataOnline = PoolData.Online
					Identity
						.O(PoolDataOnline ? 'Online' : 'Offline')
						.VN(PoolData.VerNode)
						.VW(PoolData.VerWish)
						.VP(PoolData.VerPool)
					PoolDataOnline ?
						WV.ClsA(Del.Off().R,WV.None) :
						WV.ClsR(Del.On().R,WV.None)
					Stat
						.V(PoolData.Count)
						.F(WW.StrDate(PoolData.LastOn))
						.T(PoolDataOnline ? 'Now' : WW.StrDate(PoolData.LastOff))
					OnPassed()
				},
				OnPassed = function()
				{
					Stat.K(WW.StrS(((PoolData.Online ? WW.Now() : PoolData.LastOff) - PoolData.LastOn) / 1E3))
				},
				OnTick = function()
				{
					PoolData.Online && OnPassed()
				},
				OnRec = function()
				{
					Stat
						.S(SolveSize(PoolData.F2T))
						.C(SolveSize(PoolData.T2F))
				};
				WV.ApR(
				[
					Index,
					WV.ApR([Identity,Del],WV.Rock()),
					Name,
					Desc,
					Stat
				],Card)
				return {
					R : Card,
					In : function(Q)
					{
						PoolData = Q
						Identity
							.W(Q.Row)
							.P(WR.Default('-',Q.Ping))
						Name.V(Q.Name)
						Desc.V(Q.Desc)
						Stat
							.B(WW.StrDate(Q.Birth))
							.F(WW.StrDate(Q.LastOn))
						OnOF()
						OnRec()
					},
					Out : function()
					{
						PoolData = null
					},
					Idx : function(Q,S)
					{
						OnIP()
						WV.T(Index,
							WR.PadU(Q,~-S) + ' / ' + S +
							(NodeIsMaster(PoolData) ? ' Master' : '') +
							(NodeStatus.Row === PoolData.Row ? ' Self' : ''))
					},
					Tick : OnTick,

					Nm : function(Q){Name.V(Q.Name),OnIndex()},
					Des : function(Q){Desc.V(Q.Desc),OnIndex()},
					On : function()
					{
						if (!PoolDataOnline)
						{
							++OnlineCount
							OnCount()
						}
						OnIP()
						OnOF()
					},
					Off : function()
					{
						if (PoolDataOnline)
						{
							--OnlineCount
							OnCount()
						}
						OnOF()
					},
					Ping : function(Q){Identity.P(Q.Ping)},
					Rec : OnRec
				}
			},
			SortList = WR.Sort(function(Q,S)
			{
				return (NodeStatus.Master === S.Row) - (NodeStatus.Master === Q.Row) ||
					(NodeStatus.Row === S.Row) - (NodeStatus.Row === Q.Row) ||
					(Q.Name < S.Name ? -1 : S.Name < Q.Name) ||
					(Q.Desc < S.Desc ? -1 : S.Desc < Q.Desc) ||
					Q.Row - S.Row
			}),
			OnList = WR.ThrottleDelay(2E2,function(Q)
			{
				var PrevCardList = CardList;
				OnlineCount = 0
				PoolIndex = {}
				CardList = []
				CardRow = {}
				WR.EachU(function(V,F)
				{
					var C = PrevCardList[F];
					OnlineCount += !!V.Online
					if (!C)
					{
						C = MakeCard()
						WV.Ap(C.R,Pan)
					}
					CardList.push(C)
					CardRow[V.Row] = C
					C.In(V)
					C.Idx(PoolIndex[V.Row] = F,PoolList.length)
				},PoolListSorted = SortList(Q))
				WR.Each(function(V)
				{
					V.Out()
					WV.Del(V.R)
				},PrevCardList.slice(CardList.length))
				OnCount()
				LinkPanel[0].Idx()
				LinkPanel[1].Idx()
			}),
			OnCount = function()
			{
				RTopState
					.O(WR.PadU(OnlineCount,~-PoolList.length))
					.P(PoolList.length)
			},
			OnIndex = function()
			{
				WR.EachU(function(V,F)
				{
					CardRow[V.Row].Idx(PoolIndex[V.Row] = F,PoolList.length)
				},PoolListSorted = SortList(PoolList))
				LinkPanel[0].Idx()
				LinkPanel[1].Idx()
			},
			Dispatch = function(H)
			{
				return function(Q)
				{
					var C = CardRow[Q.Row];
					C && C[H](Q)
				}
			},

			DoOnTick = function()
			{
				WR.Each(function(V){V.Tick()},CardList)
			};

			PoolOnData =
			{
				Node : function(Data)
				{
					RTopState.S(NodeIsMaster() ? 'Master' :
						Data.Online ? 'Online' :
						'Offline')
					Data.Online &&
						OnList(PoolList)
				},

				Lst : OnList,
				New : function(Q)
				{
					var C = MakeCard();
					OnlineCount += !!Q.Online
					WV.Ap(C.R,Pan)
					CardList.push(C)
					CardRow[Q.Row] = C
					C.In(Q)
					OnCount()
					OnIndex()
				},
				Nm : Dispatch('Nm'),
				Des : Dispatch('Des'),
				On : Dispatch('On'),
				Off : Dispatch('Off'),
				Ping : Dispatch('Ping'),
				Del : function(Q)
				{
					var C = CardRow[Q.Row];
					C.Out()
					WV.Del(C.R)
					WR.Del(Q.Row,CardRow)
					C = CardList.indexOf(C)
					if (~C) CardList.splice(C,1)
					if (Q.Online) --OnlineCount
					OnCount()
				},
				Rec : Dispatch('Rec')
			}
			OnTick.R(function()
			{
				RTab.Is(PanK) && DoOnTick()
			})
			return {
				Show : DoOnTick
			}
		}],
		['GlobalLink',MakeLinkPanel(9)],
		['Link',MakeLinkPanel(0)],
		['Statistic',function(Pan,_,PanK)
		{
			var
			ClassHint = WW.Key(),

			Page = 0,PageLoading,
			PageSize = 20,
			TZ = {TZ : new Date().getTimezoneOffset()},
			ReloadTo = WW.To(5E3,function()
			{
				if (Online)
				{
					LoadRec()
					WebSocketSend(Proto.StatReq,TZ)
					ReloadTo.D()
				}
			},false,false),
			ReloadHint = WV.Rock(ClassHint),
			Reload = WV.But(
			{
				X : 'Reload Statistic',
				Blk : true,
				The : WV.TheO,
				C : ReloadTo.C
			}),

			MakeStat = function(Name,Delta)
			{
				var
				U = WV.Rock(ClassCard + ' ' + WV.FmtW + ' ' + WV.S4);
				WV.T(U,Name + ' -')
				return {
					R : U,
					D : function(Q)
					{
						var
						From = Q.Today - Delta * DayMS,
						To = Delta ? Q.Today : 9 / 0,
						Sent = 0,Received = 0,Conn = 0;
						WR.Each(function(V)
						{
							if (From <= V.At && V.At < To)
							{
								Sent += V.OutBound
								Received += V.InBound
								Conn += V.Conn
							}
						},Q.Stat)
						WV.T(U,
						[
							Name + ' ' + WW.StrDate(From) + ' => ' + (Delta ? WW.StrDate(Q.Today) : 'Now'),
							'Sent ' + SolveSize(Sent) +
								' Received ' + SolveSize(Received) +
								' Connection ' + Conn
						].join('\n'))
					}
				}
			},
			StatToday = MakeStat('Today',0),
			StatYesterday = MakeStat('Yesterday',1),
			StatLast7 = MakeStat('Last 7 days',7),
			StatLast30 = MakeStat('Last 30 days',30),
			StatAll =
			[
				StatToday,
				StatYesterday,
				StatLast7,
				StatLast30
			],

			LoadRec = function(Q)
			{
				if (null != Q) Page = Q
				WebSocketSend(Proto.RecReq,{Page : PageLoading = Page,PageSize : PageSize})
			},
			PagerT = WV.Page({Inp : LoadRec}),
			PagerB = WV.Page({Inp : LoadRec}),
			RecList = WV.Sist(
			{
				Make : function(V,S)
				{
					var
					Card = WV.Rock(ClassCard + ' ' + WV.FmtW + ' ' + WV.S4,'fieldset'),
					Index = WV.A('legend'),
					Desc = WV.Rock(),
					Cut = WV.But(
					{
						X : 'Disconnect',
						The : WV.TheP,
						C : function()
						{
							S.length && S[0].Online && Sure(
							[
								'Sure to disconnect it?',
								WV.T(Desc)
							],function()
							{
								WebSocketSend(Proto.RecCut,{Row : S[0].Row}) &&
									LoadRec()
							})
						}
					});
					WV.ApR([Index,Desc],Card)
					WV.Ap(Card,V)
					return {
						U : function(/**@type {CrabPoolNS.Rec}*/ B)
						{
							WV.T(Index,'#' + B.Row)
							B.Online && WV.Ap(Cut.R,Index)
							WV.T(Desc,WR.Where(WR.Id,
							[
								'From ' + PoolShowRow(B.HostFrom) +
									(B.Client ? ' (' + B.Client + ')' : ''),
								'To ' + PoolShowRow(B.HostTo) +
									(B.Server ? ' (' + B.Server + ')' : ''),
								(B.Ind ? '[Independent] ' : '') +
									'Address ' + B.Req,
								'Created ' + WW.StrDate(B.Birth) +
									' Connected ' + (null == B.Connected ? '-' :
										'+' + (B.Connected < 1E3 + B.Birth ? B.Connected - B.Birth + 'ms' : WW.StrMS(B.Connected - B.Birth,true))) +
									' Duration ' + WW.StrMS(B.Duration,true),
								'Sent ' + SolveSize(B.F2T) + ' Received ' + SolveSize(B.T2F) +
									(null == B.Connected ? '' :
										' Average ' + SolveSpeed(B.F2T,B.Duration) +
										' ' + SolveSpeed(B.T2F,B.Duration)),
								B.Err,
							]).join('\n'))
						}
					}
				}
			});

			WV.ApR(
			[
				StatToday,
				StatYesterday,
				StatLast7,
				StatLast30,
				ReloadHint,
				Reload,
				PagerT,
				RecList,
				PagerB
			],Pan)

			RecOnRec = function(Data)
			{
				var
				Max;
				Max = WR.Ceil(Data.Count / PageSize)
				PagerT.At(PageLoading,Max)
				RecList.D(Data.Rec || [])
				PagerB.At(PageLoading,Max)
			}
			StatOnStat = function(Data)
			{
				WR.Each(function(V){V.D(Data)},StatAll)
				WV.T(ReloadHint,'Statistic loaded at ' + WW.StrDate())
			}

			ShortCut.On('j',function()
			{
				RTab.Is(PanK) && PagerT.Prev()
			}).On('k',function()
			{
				RTab.Is(PanK) && PagerT.Next()
			})

			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R` .`C`{margin:20px 0}' +
						'.`H`{text-align:center}',
						{
							R : ID,
							C : ClassCard,
							H : ClassHint
						}
					)
				},
				Show : function()
				{
					ReloadTo.C()
					RecList.In()
				},
				HideP : function()
				{
					ReloadTo.F()
					RecList.Out()
				}
			}
		}],
		['Ext',function(Pan)
		{
			var
			ClipKey = 'Clip',
			ClipTitle = WV.X('Clipboard'),
			ClipSaving,
			ClipContent = WV.Inp(
			{
				The : WV.TheS,
				Stat : true,
				Row : 8,
				Inp : function(V){ClipContent.Stat(undefined,V.length)},
				InpU : function(V)
				{
					if (WebSocketSend(Proto.ExtSet,{Key : ClipKey,Val : V}))
					{
						ClipSaving = WW.Now()
						ClipContent.Stat('Saving...')
					}
				}
			}).Stat('',0),
			ClipTimeout = WW.To(5E3,function()
			{
				StoreSet(StoreKeyClipHeight,WV.CS(ClipContent.I,'height'))
			},true,false);

			ExtOnChange.On(ClipKey,function(Q)
			{
				ClipContent.V(Q)
				ClipContent.Stat(ClipSaving ? 'Saved in ' + (WW.Now() - ClipSaving) + 'ms' : '')
				ClipSaving = 0
			})
			WSOnOffline.R(function()
			{
				if (ClipSaving)
				{
					ClipContent.Stat('Disconnected before saved')
					ClipSaving = 0
				}
			})
			WV.CSS(ClipContent.I,'height',StoreGet(StoreKeyClipHeight) || '')
			WV.ApR([ClipTitle,ClipContent],Pan)

			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`{text-align:center}',
						{
							R : ID
						}
					)
				},
				Show : function()
				{
					ClipTimeout.D()
				},
				HideP : function()
				{
					ClipTimeout.F().C()
				}
			}
		}]
	])

	ShortCut.On('[',RTab.Prev)
		.On(']',RTab.Next)

	WV.Ready(function()
	{
		Top.CrabPool = CrabPool
		WV.ApR([Rainbow[0],Noti],WV.Body)
		RTab.At(0)
		WW.To(500,OnTick.D,true)
	})
}()