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
	WebSocket = Top.WebSocket,
	Confirm = Top.confirm,

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
	ActionWebError = 'Err',

	ClassCard = WW.Key(),

	Href = location.href.replace(/[?#].*/,'').replace(/^http/,'ws'),
	IDShort = function(Q){return Q.slice(0,8)},
	Sure = function(Q,S){Confirm(Q) && S()},

	Noti = WV.Noti(),
	NotiOnline = Noti.O(),
	NotiNewToken = Noti.O(),
	ShortCut = WB.SC(),

	StoreKey = '[CrabPool]~',
	StoreKeyClipHeight = 'ClipHeight',
	StoreGet = function(Q){return WB.StoG(StoreKey + Q)},
	StoreSet = function(Q,S){return WB.StoS(StoreKey + Q,S)},

	Online,Connecting,
	WebSocketNotConnected = function(){Noti.S('Unable to perform when offline')},
	WebSocketSend = WebSocketNotConnected,
	MachineID,
	TokenStepA = function(Q){return WC.HSHA512(Q,MachineID)},
	TokenStepB = function(Q){return WC.HSHA512(MachineID,Q)},
	MakeWebSocket = function(Key)
	{
		var
		Client = new WebSocket(Href),
		Suicide = function(){Client.close()},
		Touched,Shaked,
		Cipher,Decipher;
		Client.onmessage = function(Q)
		{
			if (!Cipher)
			{
				MachineID = Q.data
				Key = TokenStepA(Key)
				Q = TokenStepB(Key)
				Cipher = WC.AESES(Q,Q,WC.CFB)
				Decipher = WC.AESDS(Q,Q,WC.CFB)
				WebSocketSend = function(Q)
				{
					if (1 === Client.readyState)
					{
						Q = Cipher.D(WC.OTJ([WW.Key(WW.Rnd(20,40)),Q,WW.Key(WW.Rnd(20,40))]))
						Client.send(WC.B91S(Q))
						return true
					}
				}
				WebSocketSend([ActionWebHello,WC.B91S(Key)])
				Q = Key = null
				return
			}
			Q = Decipher.D(WC.B91P(Q.data))
			Q = WC.JTOO(WC.U16S(Q))
			if (!WW.IsArr(Q)) return Suicide()
			Q = Q[1]
			if (!WW.IsArr(Q)) return Suicide()
			switch (Q[0])
			{
				case ActionWebHello :
					Online = Shaked = true
					NotiOnline('Connected')
					NotiOnline(false)
					MachineID = Q[1]
					OnConnect(Q[2])
					break
				case ActionWebMEZ :
					OnMEZ(Q[1])
					break
				case ActionWebToken :
					NotiNewToken(Q[1])
					NotiNewToken(false)
					break

				case ActionWebPool :
					DataPoolList = WR.ToPair(DataPoolMap = Q[1]).sort(function(Q,S)
					{
						Q = Q[1]
						S = S[1]
						return (S.MEZ || 0) - (Q.MEZ || 0) ||
							(Q.Name < S.Name ? -1 : S.Name < Q.Name) ||
							(Q.Desc < S.Desc ? -1 : S.Desc < Q.Desc) ||
							Q.Boom - S.Boom
					})
					OnPoolPool()
					OnPoolLink()
					break

				case ActionWebPing :
					OnPing(Q[1],Q[2])
					break

				case ActionWebLink :
					OnLink(Q[1])
					break
				case ActionWebLinkS :
					OnLinkS(Q[1])
					break
				case ActionWebLinkError :
					OnLinkError(Q[1],Q[2])
					break

				case ActionWebExt :
					Ext.Emit(Q[1],Q[2])
					break

				case ActionWebError :
					Noti.S(['Error | ',Q[1],' | ',Q[2]])
					break

				default : Suicide()
			}
		}
		Client.onopen = function()
		{
			Touched = true
			NotiOnline('Handshaking...')
		}
		Client.onclose = function()
		{
			Online = Connecting = false
			WebSocketSend = WebSocketNotConnected
			NotiOnline(['Offline | ',Touched ? Shaked ? 'Connection closed' : 'Failed to handshake, the token may not be correct' : 'Timeout'])
			RTab.At(0)
		}
		NotiOnline('Connecting...')
		Connecting = true
	},

	DataPoolMap = {},DataPoolList = [],
	OnConnect,OnMEZ,OnPoolPool,OnPing,
	OnPoolLink,OnLink,OnLinkS,OnLinkError,
	Ext = WW.Bus(),
	PoolIndex = {},

	Rainbow = WV.Div(2,['10%'],true),
	RTab = WV.Split({Pan : Rainbow,Main : true}),
	RTopState = WV.Fmt('Online `O` / `N`\nLink `L` / `I`','-');

	WV.CSS(Rainbow[1],'min-width',100)
	WV.Ap(RTopState.R,RTab.B)

	RTab.Add(
	[
		['Auth',function(V)
		{
			var
			R = WV.Rock(WV.S6),
			Connect = function()
			{
				if (Connecting) Noti.S('Already ' + (Online ? 'connected' : 'connecting'))
				else
				{
					MakeWebSocket(Token.V())
					Token.V('').Fresh().Foc()
				}
			},
			Token = WV.Inp(
			{
				Hint : 'Token',
				Pass : true,
				Ent : Connect
			}),
			SaveNew = function()
			{
				if (WebSocketSend([ActionWebToken,WC.B91S(TokenStepA(Token.V())),WC.B91S(TokenStepA(TokenNew.V()))]))
				{
					Token.V('').Fresh()
					TokenNew.V('').Fresh().Foc()
					NotiNewToken('Saving new token')
				}
			},
			TokenNew = WV.Inp(
			{
				Hint : 'New Token',
				Pass : true,
				Ent : SaveNew
			});

			NotiOnline('Offline, enter the Token to connect')
			WV.ApR(
			[
				Token,WV.But(
				{
					X : 'Connect',
					The : WV.TheO,
					Blk : true,
					C : Connect
				}),
				TokenNew,WV.But(
				{
					X : 'Save New Token',
					The : WV.TheO,
					Blk : true,
					C : SaveNew
				})
			],R)
			WV.Ap(R,V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'body{height:100%}' +
						'.`T`>.`M`{text-align:center;margin:6px 0}' +

						'#`R`{padding:40px;text-align:center}' +
						'#`R`>div{margin:auto;padding:20px;max-width:26em}' +
						'#`R` .`I`{margin:20px 0}',
						{
							R : ID,
							I : WV.InpW,
							T : WV.TabT,
							M : WV.FmtW
						}
					)
				},
				Hide : function(){Token.V('').Fresh(),TokenNew.V('').Fresh()}
			}
		}],
		['Pool',function(V)
		{
			var
			MakeCard = function()
			{
				var
				ID,O,IP,
				U = WV.Rock(ClassCard + ' ' + WV.S4,'fieldset'),
				Index = WV.A('legend'),
				State = WV.Fmt('[`O`line`P`] `H` (`I`)`M`',{O : 'Off',H : 'Not ready',I : '::'}),
				MakeEdit = function(Q,S)
				{
					var P,R;
					Q.Foc = function(){P = R.V()}
					Q.Out = function()
					{
						if (P !== (P = R.V())) ID ?
							WebSocketSend([ActionWebPoolEdit,ID,S,P]) :
							Noti.S('Not ready, unable to perform')
					}
					return R = WV.Inp(Q)
				},
				Name = MakeEdit({Hint : 'Unnamed'},'Name'),
				Desc = MakeEdit({Type : WV.InpPX,Hint : 'No Description'},'Desc'),
				Last = WV.Fmt('Created at `O`. Total : `L`. Last on `F` => `T`','-'),
				Del = WV.But(
				{
					X : 'Remove',
					The : WV.TheP,
					C : function()
					{
						if (ID)
						{
							Sure(
							[
								'Sure to remove this machine?',
								IDShort(ID) + (O.Name ? ':' + O.Name : ''),
								O.Desc || ''
							].join('\n'),function(){WebSocketSend([ActionWebPoolDel,ID])})
						}
					}
				}).Off(),
				R =
				{
					R : U,
					I : function(Q,S){return WV.Text(Index,Q + ' / ' + S),R},
					H : function(Q)
					{
						ID = Q
						WV.AD(State.H(IDShort(Q)).R,'ID',Q)
						return R
					},
					L : function(Q)
					{
						State.O(Q ? 'On' : 'Off')
						Q ?
							WW.IsStr(Q) && State.I(IP = Q) :
							State.P('')
						return R
					},
					M : function(Q){return State.M(Q ? ' (Self)' : ''),R},
					O : function(/**@type {CrabPoolNS.Pool}*/Q)
					{
						O = Q
						R.L(Q.S)
						IP || State.I(Q.IP)
						Last.O(WW.StrDate(Q.Boom)).L(Q.Num)
							.F(WW.StrDate(Q.From)).T(Q.S ? 'Now' : WW.StrDate(Q.To))
						WV.AD(Last.R,'Boom',Q.Boom)
						WV.AD(Last.R,'From',Q.From)
						WV.AD(Last.R,'To',Q.S ? null : Q.To)
						Name.V(Q.Name)
						Desc.V(Q.Desc)
						Q.S ? Del.Off() : Del.On()
						;(Q.S ? WV.ClsA : WV.ClsR)(Del.R,WV.None)
						return R
					},
					P : function(Q)
					{
						State.P(' ' + Q + 'ms')
						return R
					},
					D : function(){return WV.Del(U),R}
				};
				WV.ClsA(Del.R,WV.None)
				WV.Ap(WV.ApR([Index,State,Name,Desc,Last,Del],U),V)
				return R
			},
			CardMEZ = MakeCard(),
			CardQBH = {},
			CardCurrent,
			CardCurrentNew = function(Q)
			{
				if (Q && Q !== CardCurrent)
				{
					CardCurrent && CardCurrent.M(false)
					Q.M(true)
					CardCurrent = Q
				}
			};
			OnConnect = function(Q)
			{
				CardCurrentNew(Q ? CardMEZ : CardQBH[MachineID])
			}
			OnMEZ = function(Q){CardMEZ.L(Q)}
			OnPoolPool = function()
			{
				var Count = 0
				PoolIndex = {}
				WR.EachU(function(/**@type {CrabPoolNS.Pool}*/V,I,F)
				{
					PoolIndex[V[0]] = I
					F = V[0]
					V = V[1]
					Count += !!V.S
					if (V.MEZ) CardQBH[F] = V = CardMEZ.H(F).O(V)
					else if (WR.Has(F,CardQBH)) V = CardQBH[F].O(V)
					else
					{
						CardQBH[F] = V = MakeCard().H(F).O(V)
						F === MachineID && CardCurrentNew(V)
					}
					V.I(WR.PadU(I,DataPoolList.length),DataPoolList.length)
				},DataPoolList)
				WR.EachU(function(V,F){WR.Has(F,DataPoolMap) || V.D()},CardQBH)
				RTopState.O(Count).N(DataPoolList.length)
			}
			OnPing = function(Q,S)
			{
				WR.EachU(function(V,F)
				{
					WR.Has(F,CardQBH) && CardQBH[F].P(V)
				},WW.IsObj(Q) ? Q : WR.OfObj(Q,S))
			}
			WV.Ap(WV.HR(),V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`>*{margin:20px}' +
						'.`C`{padding:20px}' +
						'fieldset.`C`{padding:4px 20px 20px}' +
						'.`C`>*{margin:4px 0}' +
						'.`C` legend{margin:0}',
						{
							R : ID,
							C : ClassCard,
						}
					)
				}
			}
		}],
		['Link',function(V)
		{
			var
			ClassDesc = WW.Key(),
			HR = WV.HR(),
			HostSel = [],
			HostMap = {},
			HostMapInv = {},
			HostPool = WW.Set(),
			MakeHostFilter = function(S,_,Q){return Q.test(S[0]) || Q.test(S[3])},
			MakeHost = function()
			{
				var
				M,
				U = WV.Inp({Hint : 'Select A Target'}).Drop(HostSel,MakeHostFilter),
				R =
				{
					R : U.R,
					S : function(Q,T)
					{
						if (Q.length)
						{
							T = U.V()
							U.On().Drop(Q,MakeHostFilter)
							if (M) U.V(HostMapInv[M[T]])
							M = HostMap
						}
						else U.Off().V('')
						return R
					},
					V : function(Q)
					{
						return undefined === Q ?
							HostMap[U.V()] :
							U.V(HostMapInv[Q]) && R
					}
				};
				WW.SetAdd(HostPool,R)
				return R
			},
			MakeAddr = function(){return WV.Inp({Hint : 'IP/Domain With Port'})},
			MakeDeploy = function(Q){return WV.Inp({Hint : 'Local Deploy Port',Yep : WV.InpYZ,Ent : Q,Map : function(Q){return WR.Trim(Q) && +Q}})},
			MakeCard = function()
			{
				var
				ID,O,
				U = WV.Rock(ClassCard + ' ' + WV.S4,'fieldset'),
				Index = WV.A('legend'),
				Enabled = WV.Cho({Set : [[9,'Enabled'],[0,'Disabled']],Inp : function(V)
				{
					WebSocketSend([ActionWebLinkSwitch,ID,V])
				}}),
				Host = MakeHost().S(HostSel),
				Addr = MakeAddr(),
				Deploy = MakeDeploy(),
				State = WV.Fmt('[`S`] Created at `C`. Visited : `V`. Using : `U`. Last on `L``E`','-').E(''),
				Save = WV.But(
				{
					X : 'Save Changes',
					The : WV.TheO,
					C : function()
					{
						WebSocketSend([ActionWebLinkEdit,Host.V(),Addr.V(),Deploy.V(),ID])
					}
				}),
				Del = WV.But(
				{
					X : 'Remove',
					The : WV.TheP,
					C : function()
					{
						Sure(
						[
							'Sure to remove this link?',
							'[' + O.Port + '] ' + HostMapInv[O.Host],
							O.Addr
						].join('\n'),function(){WebSocketSend([ActionWebLinkDel,ID])})
					}
				}),
				R =
				{
					R : U,
					I : function(Q,S){return WV.Text(Index,Q + ' / ' + S),R},
					H : function(Q){return ID = Q,R},
					O : function(/**@type {CrabPoolNS.Link}*/Q)
					{
						O = Q
						Enabled.V(Q.S ? 9 : 0,true)
						WV.AD(State.C(WW.StrDate(Q.Boom)).R,'Boom',Q.Boom)
						Host.V(Q.Host)
						Addr.V(Q.Addr)
						Deploy.V(Q.Port)
						return R
					},
					S : function(/**@type {CrabPoolNS.LinkS}*/Q)
					{
						State.S(Q.Port < 0 ? 'Offline' : 'Port ' + Q.Port).V(Q.Visit).U(Q.Using)
						Q.Last && WV.AD(State.L(WW.StrDate(Q.Last)).R,'Last',Q.Last)
						return R
					},
					E : function(Q)
					{
						State.E(Q ? '\n' + Q : '')
						return R
					},
					D : function()
					{
						WV.Del(U)
						WW.SetDel(HostPool,Host)
						return R
					}
				};
				WV.After(WV.ApR([Index,Enabled,Host,Addr,Deploy,State,Save,Del],U),HR)
				return R
			},

			CardPool = {},
			SaveCard = WV.Rock(ClassCard + ' ' + WV.S4),
			SaveHost = MakeHost().S(HostSel),
			SaveAddr = MakeAddr(),
			SaveSave = WV.But(
			{
				X : 'Add New Link',
				The : WV.TheO,
				C : function()
				{
					if (WebSocketSend([ActionWebLinkAdd,SaveHost.V(),SaveAddr.V(),SaveDeploy.V()]))
					{
						SaveDeploy.V('').Foc()
					}
				}
			}),
			SaveDeploy = MakeDeploy(SaveSave.C);
			OnPoolLink = function()
			{
				HostMap = {}
				HostMapInv = {}
				HostSel = WR.Map(function(V,F,P)
				{
					F = V[0]
					V = V[1]
					P = IDShort(F) + (V.Name ? ':' + V.Name : '')
					HostMap[P] = F
					HostMapInv[F] = P
					return [P,[P,V.Desc ? function(){return WV.Text(WV.Rock(ClassDesc),V.Desc)} : ''],P,V.Desc]
				},DataPoolList)
				WR.Each(function(V){V.S(HostSel)},HostPool)
			}
			OnLink = function(Q,S)
			{
				var Count = 0
				WR.EachU(function(V,I,F)
				{
					F = V[0]
					V = V[1]
					Count += !!V.S
					;(CardPool[F] || (CardPool[F] = MakeCard().H(F)))
						.I(WR.PadU(S.length + ~I,S.length),S.length)
						.O(V)
				},S = WR.ToPair(Q).sort(function(Q,S)
				{
					Q = Q[1]
					S = S[1]
					return PoolIndex[S.Host] - PoolIndex[Q.Host] ||
						S.Port - Q.Port ||
						(S.Addr < Q.Addr ? -1 : Q.Addr < S.Addr)
				}))
				WR.EachU(function(V,F){WR.Has(F,Q) || V.D()},CardPool)
				RTopState.L(Count).I(S.length)
			}
			OnLinkS = function(Q)
			{
				WR.EachU(function(V,F)
				{
					F = CardPool[F]
					F && F.S(V)
				},Q)
			}
			OnLinkError = function(Q,S)
			{
				Q = CardPool[Q]
				Q && Q.E(S)
			}
			WV.ApR([SaveHost,SaveAddr,SaveDeploy,SaveSave],SaveCard)
			WV.ApA([SaveCard,HR],V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`>*{margin:20px}' +
						'.`D`{font-size:.9em;color:#A9A9A9}',
						{
							R : ID,
							D : ClassDesc
						}
					)
				}
			}
		}],
		['Ext',function(V)
		{
			var
			ClassTitle = WW.Key(),

			ClipTitle = WV.Text(WV.Rock(ClassTitle),'Clipboard'),
			ClipContent = WV.Inp(
			{
				Type : WV.InpPX,
				The : WV.TheS,
				Stat : true,
				Row : 5,
				Inp : function(V){ClipContent.Stat(undefined,V.length)},
				InpU : function(V){WebSocketSend([ActionWebExt,ActionWebExtClip,V])}
			}).Stat('',0),
			ClipTimeout = WW.To(5E3,function()
			{
				StoreSet(StoreKeyClipHeight,WV.CS(ClipContent.I,'height'))
			},true).F();

			Ext.On(ActionWebExtClip,ClipContent.V)
			WV.CSS(ClipContent.I,'height',StoreGet(StoreKeyClipHeight) || '')
			WV.ApR([ClipTitle,ClipContent],V)

			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`{text-align:center}' +
						'.`T`{margin:16px}' +
						'#`R` .`I`{padding:0 16px}',
						{
							R : ID,
							I : WV.InpW,
							T : ClassTitle
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
		}]/*,
		['Setting',function(V)
		{

		}]*/
	])

	ShortCut.On('[',RTab.Prev)
		.On(']',RTab.Next)

	WV.Ready(function()
	{
		WV.ApA([Rainbow[0],Noti.R],WV.Body)
		RTab.At(0)
	})
}()