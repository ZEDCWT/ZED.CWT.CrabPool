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
	ActionWebError = 'Err',

	Href = location.href.replace(/[?#].*/,'').replace(/^http/,'ws'),

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
		Shaked,
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

				case ActionWebPool :
					OnPool(Q[1])
					break

				case ActionWebToken :
					NotiNewToken(Q[1])
					NotiNewToken(false)
					break

				case ActionWebError :
					Noti.S(['Error | ',Q[1],' | ',Q[2]])
					break

				default : Suicide()
			}
		}
		Client.onopen = function()
		{
			NotiOnline('Handshaking...')
		}
		Client.onclose = function()
		{
			Online = Connecting = false
			WebSocketSend = WebSocketNotConnected
			NotiOnline(['Offline.',Shaked ? '' : ' Failed to handshake, the token may not be correct'])
		}
		NotiOnline('Connecting...')
		Connecting = true
	},

	OnConnect,
	OnMEZ,
	OnPool,

	Rainbow = WV.Div(2,['10%'],true),
	RTab = WV.Split({Pan : Rainbow});

	WV.CSS(Rainbow[1],'min-width',100)

	WV.Style(WW.Fmt
	(
		'body{height:100%}',
		{

		}
	))

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
			ClassCard = WW.Key(),
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
				Last = WV.Fmt('Registered at `O`, totally `L` time(s). Last seen `F` => `T`',{O : '-',L : '-',F : '-',T : '-'}),
				R =
				{
					R : U,
					H : function(Q)
					{
						ID = Q
						WV.AD(State.H(Q.slice(0,8)).R,'ID',Q)
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
			OnPool = function(Q)
			{
				WR.Each(function(/**@type {CrabPoolNS.Pool}*/V,F)
				{
					F = V[0]
					V = V[1]
					if (V.MEZ) CardMEZ.H(F).O(V)
					else if (WR.Has(F,CardQBH)) CardQBH[F].O(V)
					else
					{
						CardQBH[F] = V = MakeCard().H(F).O(V)
						F === MachineID && CardCurrentNew(V)
					}
				},WR.ToPair(Q).sort(function(Q,S)
				{
					Q = Q[1]
					S = S[1]
					return (Q.Name < S.Name ? -1 : S.Name < Q.Name) ||
						(Q.Desc < S.Desc ? -1 : S.Desc < Q.Desc) ||
						Q.Boom - S.Boom
				}))
				WR.EachU(function(V,F){WR.Has(F,Q) || V.D()},CardQBH)
			}
			WV.Ap(WV.HR(),V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`>*{margin:20px}' +
						'.`C`{padding:20px}',
						{
							R : ID,
							C : ClassCard
						}
					)
				}
			}
		}],
		['Link',function(V)
		{

		}],
		['Setting',function(V)
		{

		}]
	])
	RTab.At(0)

	WV.Ready(function()
	{
		WV.ApA([Rainbow[0],Noti.R],WV.Body)
	})
}()