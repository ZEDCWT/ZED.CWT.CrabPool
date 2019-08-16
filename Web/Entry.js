'use strict'
~function()
{
	var
	WW = Wish,
	WR = WW.R,
	WX = WW.X,
	WC = WW.C,
	WV = WW.V,
	Top = Wish.Top,
	WebSocket = Top.WebSocket,

	ActionWebHello = 'Hell',
	ActionWebPool = 'Pool',

	Href = location.href.replace(/[?#].*/,'').replace(/^http/,'ws'),

	WebSocketSend,
	MakeWebSocket = function()
	{
		WebSocketSend = WW.O
		WX.Provider(function(O)
		{
			var
			Client = new WebSocket(Href),
			Suicide = function(){Client.close()};
			Client.onmessage = function(Q)
			{
				Q = WC.B91P(Q.data)

				Q = WC.JTOO(WC.U16S(Q))
				if (!WW.IsArr(Q)) return Suicide()
				switch (Q[0])
				{
					case ActionWebHello :
						break

					case ActionWebPool :
						console.log(Q[1])
						break

					default : Suicide()
				}
			}
			Client.onopen = function()
			{
			}
			Client.onclose = O.E
			WebSocketSend = function(Q)
			{
				Q = WC.OTJ(Q)
				Client.send(WC.B91S(Q))
			}
		}).RetryWhen(function(V){return V.Delay(1E3)}).Now()
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
			R = WV.Rock(WV.Ini + ' ' + WV.S6);

			WV.ApA([WV.Rock(WV.VertM),R],V)
			return {
				CSS : function(ID)
				{
					return WW.Fmt
					(
						'#`R`{text-align:center}' +
						'#`R`>div{padding:20px;vertical-align:middle}',
						{
							R : ID
						}
					)
				}
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
		MakeWebSocket()
	})
}()