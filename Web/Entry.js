'use strict'
~function()
{
	var
	WW = Wish,
	WR = WW.R,
	WC = WW.C,
	WV = WW.V,
	Top = Wish.Top,
	WebSocket = Top.WebSocket,

	ActionWebHello = 'Hell',
	ActionWebMEZ = 'MEZ',
	ActionWebPool = 'Pool',
	ActionWebToken = 'Toke',
	ActionWebEdit = 'Edit',
	ActionWebLink = 'Link',
	ActionWebLinkS = 'LinkS',
	ActionWebLinkAdd = 'LinkAdd',
	ActionWebLinkSwitch = 'LinkSwitch',
	ActionWebLinkEdit = 'LinkEdit',
	ActionWebLinkError = 'LinkError',
	ActionWebError = 'Err',

	ClassCard = WW.Key(),

	Href = location.href.replace(/[?#].*/,'').replace(/^http/,'ws'),
	IDShort = function(Q){return Q.slice(0,8)},

	Noti = WV.Noti(),
	NotiOnline = Noti.O(),
	NotiNewToken = Noti.O(),

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
						return S.MEZ - Q.MEZ ||
							(Q.Name < S.Name ? -1 : S.Name < Q.Name) ||
							(Q.Desc < S.Desc ? -1 : S.Desc < Q.Desc) ||
							Q.Boom - S.Boom
					})
					OnPoolPool()
					OnPoolLink()
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
	OnConnect,OnMEZ,OnPoolPool,
	OnPoolLink,OnLink,OnLinkS,OnLinkError,
	PoolIndex = {},

	Rainbow = WV.Div(2,['10%'],true),
	RTab = WV.Split({Pan : Rainbow});

	WV.CSS(Rainbow[1],'min-width',100)

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
					Token.V('')
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
					Token.V('')
					TokenNew.V('')
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
						'#`R`{padding:40px;text-align:center}' +
						'#`R`>div{margin:auto;padding:20px;max-width:26em}' +
						'#`R` .`I`{margin:20px 0}',
						{
							R : ID,
							I : WV.InpW
						}
					)
				},
				Hide : function(){Token.V(''),TokenNew.V('')}
			}
		}],
		['Pool',function(V)
		{
			var
			MakeCard = function()
			{
				var
				ID,
				U = WV.Rock(ClassCard + ' ' + WV.S4),
				State = WV.Fmt('[`O`line] `H` (`I`)`M`',{O : 'Off',H : 'Not ready',I : '::'}),
				MakeEdit = function(Q,S)
				{
					var P,R;
					Q.Foc = function(){P = R.V()}
					Q.Out = function()
					{
						if (P !== (P = R.V())) ID ?
							WebSocketSend([ActionWebEdit,ID,S,P]) :
							Noti.S('Not ready, unable to perform')
					}
					return R = WV.Inp(Q)
				},
				Name = MakeEdit({Hint : 'Unnamed'},'Name'),
				Desc = MakeEdit({Type : WV.InpPX,Hint : 'No Description'},'Desc'),
				Last = WV.Fmt('Created at `O`. Total : `L`. Last on `F` => `T`',{O : '-',L : '-',F : '-',T : '-'}),
				R =
				{
					R : U,
					H : function(Q)
					{
						ID = Q
						WV.AD(State.H(IDShort(Q)).R,'ID',Q)
						return R
					},
					L : function(Q){return State.O(Q ? 'On' : 'Off'),R},
					M : function(Q){return State.M(Q ? ' (Self)' : ''),R},
					O : function(/**@type {CrabPoolNS.Pool}*/Q)
					{
						R.L(Q.S)
						State.I(Q.IP)
						Last.O(WW.StrDate(Q.Boom)).L(Q.Num)
							.F(WW.StrDate(Q.From)).T(Q.S ? 'Now' : WW.StrDate(Q.To))
						WV.AD(Last.R,'Boom',Q.Boom)
						WV.AD(Last.R,'From',Q.From)
						WV.AD(Last.R,'To',Q.S ? null : Q.To)
						Name.V(Q.Name)
						Desc.V(Q.Desc)
						return R
					},
					D : function(){return WV.Del(U),R}
				};
				WV.Ap(WV.ApR([State,Name,Desc,Last],U),V)
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
				PoolIndex = {}
				WR.Each(function(/**@type {CrabPoolNS.Pool}*/V,F)
				{
					PoolIndex[V[0]] = F
					F = V[0]
					V = V[1]
					if (V.MEZ) CardMEZ.H(F).O(V)
					else if (WR.Has(F,CardQBH)) CardQBH[F].O(V)
					else
					{
						CardQBH[F] = V = MakeCard().H(F).O(V)
						F === MachineID && CardCurrentNew(V)
					}
				},DataPoolList)
				WR.EachU(function(V,F){WR.Has(F,DataPoolMap) || V.D()},CardQBH)
			}
			WV.Ap(WV.HR(),V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`>*{margin:20px}' +
						'.`C`{padding:20px}' +
						'.`C`>*{margin:10px 0}',
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
			MakeHost = function()
			{
				var
				M,
				U = WV.Inp({Hint : 'Select A Target'}).Drop(HostSel),
				R =
				{
					R : U.R,
					S : function(Q,T)
					{
						if (Q.length)
						{
							T = U.V()
							U.On().Drop(Q)
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
			MakeDeploy = function(){return WV.Inp({Hint : 'Local Deploy Port',Yep : WV.InpYZ,Map : function(Q){return WR.Trim(Q) && +Q}})},
			MakeCard = function()
			{
				var
				ID,
				U = WV.Rock(ClassCard + ' ' + WV.S4),
				Enabled = WV.Cho({Set : [[9,'Enabled'],[0,'Disabled']],Inp : function(V)
				{
					WebSocketSend([ActionWebLinkSwitch,ID,V])
				}}),
				Host = MakeHost().S(HostSel),
				Addr = MakeAddr(),
				Deploy = MakeDeploy(),
				State = WV.Fmt('[`S`] Created at `C`. Visited : `V`. Using : `U`. Last on `L``E`',{S : '-',C : '-',V : '-',U : '-',L : '-'}),
				Save = WV.But(
				{
					X : 'Save Changes',
					The : WV.TheO,
					C : function()
					{
						WebSocketSend([ActionWebLinkEdit,Host.V(),Addr.V(),Deploy.V(),ID])
					}
				}),
				R =
				{
					R : U,
					H : function(Q){return ID = Q,R},
					O : function(/**@type {CrabPoolNS.Link}*/Q)
					{
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
					}
				};
				WV.After(WV.ApR([Enabled,Host,Addr,Deploy,State,Save],U),HR)
				return R
			},

			CardPool = {},
			SaveCard = WV.Rock(ClassCard + ' ' + WV.S4),
			SaveHost = MakeHost().S(HostSel),
			SaveAddr = MakeAddr(),
			SaveDeploy = MakeDeploy(),
			SaveSave = WV.But(
			{
				X : 'Add New Link',
				The : WV.TheO,
				C : function()
				{
					WebSocketSend([ActionWebLinkAdd,SaveHost.V(),SaveAddr.V(),SaveDeploy.V()])
					SaveHost.V('')
					SaveAddr.V('')
					SaveDeploy.V('')
				}
			});
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
					return [P,[P,V.Desc ? function(){return WV.Text(WV.Rock(ClassDesc),V.Desc)} : '']]
				},DataPoolList)
				WR.Each(function(V){V.S(HostSel)},HostPool)
			}
			OnLink = function(Q)
			{
				WR.Each(function(V,F)
				{
					F = V[0]
					V = V[1]
					;(CardPool[F] || (CardPool[F] = MakeCard().H(F))).O(V)
				},WR.ToPair(Q).sort(function(Q,S)
				{
					Q = Q[1]
					S = S[1]
					return PoolIndex[S.Host] - PoolIndex[Q.Host] ||
						S.Port - Q.Port ||
						(S.Addr < Q.Addr ? -1 : Q.Addr < S.Addr)
				}))
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
		}]/*,
		['Setting',function(V)
		{

		}]*/
	])
	RTab.At(0)

	WV.Ready(function()
	{
		WV.ApA([Rainbow[0],Noti.R],WV.Body)
	})
}()