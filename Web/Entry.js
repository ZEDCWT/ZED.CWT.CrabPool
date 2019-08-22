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

	Href = location.href.replace(/[?#].*/,'').replace(/^http/,'ws'),

	WebSocketSend = WW.O,
	MakeWebSocket = function(Key)
	{
		var
		Client = new WebSocket(Href),
		Suicide = function(){Client.close()},
		Cipher,Decipher;
		Client.onmessage = function(Q)
		{
			if (!Cipher)
			{
				Key = WC.HSHA512(Q.data,WC.HSHA512(Key,Q.data))
				Cipher = WC.AESES(Key,Key,WC.CFB)
				Decipher = WC.AESDS(Key,Key,WC.CFB)
				Key = null
				WebSocketSend =Top.WSS= function(Q)
				{
					if (1 === Client.readyState)
					{
						Q = Cipher.D(WC.OTJ(Q))
						Client.send(WC.B91S(Q))
					}
				}
				return
			}
			Q = Decipher.D(WC.B91P(Q.data))
			Q = WC.JTOO(WC.U16S(Q))
			if (!WW.IsArr(Q)) return Suicide()
			switch (Q[0])
			{
				case ActionWebHello :
					break
				case ActionWebMEZ :
					break

				case ActionWebPool :
					break

				default : Suicide()
			}
		}
		Client.onopen = function()
		{
		}
		Client.onclose = function()
		{

		}
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
			Pass = WV.Inp(
			{
				Hint : 'Password',
				Pass : true,
				Ent : function()
				{
					MakeWebSocket(Pass.V())
					Pass.V('')
				}
			});

			WV.ApA([Pass.R],R)
			WV.ApA([WV.Rock(WV.VertM),R],V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`{text-align:center}' +
						'#`R`>div{margin:40px;padding:20px}' +
						'.`I`{width:20em}',
						{
							R : ID,
							I : WV.InpW
						}
					)
				},
				Hide : function(){Pass.V('')}
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
		WV.Ap(Rainbow[0],WV.Body)
	})
}()