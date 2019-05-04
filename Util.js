var
Wish = require('@zed.cwt/wish'),

MakeID = () =>
{
	var
	R = '';
	for (;R.length < 32;) R += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Wish.Rnd(36)]
	return R
},
SolveAddr = Q => Q.split`:`.reverse(),

WrapCipher = (Pipe,Encipher,Decipher,OnData,OnDrain) =>
{
	Pipe.on('data',Q => Decipher.write(Q))
		.on('end',() => Decipher.end())
	Decipher.on('end',OnDrain)
		.on('readable',T =>
		{
			for (;null !== (T = Decipher.read());)
				OnData(T)
		})
	Encipher.on('end',() => Pipe.end())
		.on('readable',T =>
		{
			for (;null !== (T = Encipher.read());)
				Pipe.write(T)
		})
	return {
		W : Q => Encipher.write(Q),
		E : () => Encipher.end()
	}
},

MakeReader = (OnJSON,OnRaw) =>
{
	var
	Cache = [],CacheLen = 0,
	Take = function*(Q,R)
	{
		for (;CacheLen < Q;)
		{
			Cache.push(yield)
			CacheLen += Cache[~-Cache.length].length
		}
		if (1 in Cache) Cache = [Buffer.concat(Cache)]
		R = Cache[0].slice(0,Q)
		CacheLen -= Q
		CacheLen ? Cache[0] = Cache[0].slice(Q) : Cache.pop()
		return R
	},
	T = function*()
	{
		for (;
			T = yield* Take(2),
			T = (T[0] | T[1] << 8) >>> 0,
			false !== OnJSON(JSON.parse((yield* Take(T)).toString('utf8')))
		;);
		Cache.forEach(OnRaw)
		for (;;) OnRaw(yield)
	}();
	T.next()
	return T
},
WrapFeeder = Feed => (Data,T) =>
{
	Buffer.isBuffer(Data) ||
	(
		Data = Wish.IsObj(Data) ? JSON.stringify(Data) : Data,
		Data = Buffer.from(Data,'utf8')
	)
	T = Data.length
	Feed(Buffer.from([255 & T,255 & T >>> 8]))
	Feed(Data)
};

module.exports =
{
	MakeID,
	SolveAddr,

	WrapCipher,
	WrapFeeder,

	MakeReader,
}