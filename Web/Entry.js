'use strict'
~function()
{
	var
	WW = Wish,
	WC = WW.C,
	WV = WW.V,
	Top = Wish.Top,
	WebSocket = Top.WebSocket,

	ActionWebHello = 'Hell',
	ActionWebMEZ = 'MEZ',
	ActionWebPool = 'Pool',
	ActionWebToken = 'Toke',

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
				WebSocketSend([ActionWebHello,Wish.C.B91S(Key)])
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
					OnConnect(Q[1],Q[2])
					break
				case ActionWebMEZ :
					OnMEZ(Q[1])
					break

				case ActionWebPool :
					OnPool(Q[1])
					break

				case ActionWebToken :
					NotiNewToken(Q[2])
					NotiNewToken(false)
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
				U = WV.Rock(ClassCard + ' ' + WV.S4),
				R =
				{
					R : U,
					I : function(Q)
					{

					},
					O : function(/**@type {{S : number,IP : string,Boom : number,From : number,To : number}}*/Q)
					{

					},
					C : function(Q)
					{

					}
				};
				return R
			},
			CardMEZ = MakeCard(
			{

			}),
			CardQBH = [],
			CardCurrent;
			OnConnect = function()
			{

			}
			OnMEZ = function()
			{

			}
			OnPool = function(Q)
			{

			}
			WV.ApR([CardMEZ,WV.HR()],V)
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