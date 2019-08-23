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
	WebSocketSend = WW.O,
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
					break
				case ActionWebMEZ :
					break

				case ActionWebPool :
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
			NotiOnline(['Closed.',Shaked ? '' : ' Failed to handshake, the token may not be correct'])
		}
		NotiOnline('Connecting...')
		Connecting = true
	},

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
			R = WV.Rock(WV.Ini + ' ' + WV.S6),
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
				if (Online)
				{
					WebSocketSend([ActionWebToken,WC.B91S(TokenStepA(Token.V())),WC.B91S(TokenStepA(TokenNew.V()))])
					Token.V('')
					TokenNew.V('')
					NotiNewToken('Saving new token')
				}
				else
				{
					NotiNewToken('Unable to save new token, not connected')
					NotiNewToken(false)
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
			WV.ApA([WV.Rock(WV.VertM),R],V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`{text-align:center}' +
						'#`R`>div{margin:40px;padding:20px}' +
						'#`R` .`I`{margin:20px 0;width:20em}',
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