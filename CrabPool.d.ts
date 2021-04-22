declare module CrabPoolNS
{
	interface CrabPool
	{
		(Q :
		{
			Cipher?() : import('crypto').Cipher
			Decipher?() : import('crypto').Cipher
			PortMaster? : number
			PortWeb? : number
			Pipe?(Log : (...Q : any[]) => any,Independent : boolean) : import('net').Socket | WishNS.Provider<import('net').Socket>
			PipeRetry? : number
			Timeout? : number
			Tick? : number
			Data? : string
			Log? : ((...Q : any[]) => any) | false
		}) : {
			Exp<U extends import('express').Router>(Express? : U) : U
			/**WS.on('connection')*/
			Soc(S : import('ws'),H : import('http').IncomingMessage) : any
		}
	}

	type AnyP = WishNS.Provider<any>
	interface DB
	{
		(Q :
		{
			PathData : string
		}) : {
			Init : AnyP

			PoolAll() : WishNS.Provider<Pool[]>
			PoolLst(Q : {Pool : Pool[]}) : AnyP
			PoolMax() : WishNS.Provider<number>
			PoolNew(Q : {Row : number,ID : string,Birth : number}) : AnyP
			PoolNm(Q : {Row : number,Nm : string}) : AnyP
			PoolDes(Q : {Row : number,Des : string}) : AnyP
			PoolOn(Q :
			{
				Row : number
				IP : string
				At : number
				VN : string
				VW : string
				VP : string
			}) : AnyP
			PoolOff(Q : {Row : number,At : number}) : AnyP
			PoolPing(Q : {Row : number,Ping : number,At : number}) : AnyP
			PoolDel(Q : {Row : number}) : AnyP
			PoolRec(Q : {Row : number,F2T : number,T2F : number}) : AnyP

			LinkGlobal : DBLink
			Link : DBLink

			RecMax() : WishNS.Provider<number>
			RecNew(Q :
			{
				Row : number
				Birth : number
				From : number
				To : number
				Req : string
				Client : string
			}) : AnyP
			RecCon(Q : {Row : number,At : number}) : AnyP
			RecRec(Q : {Row : number,Duration : number,F2T : number,T2F : number}) : AnyP
			RecOff(Row : number) : AnyP
			RecErr(Q : {Row : number,Err : string}) : AnyP
			RecCount() : WishNS.Provider<number>
			RecGet(Page : number,PageSize : number) : WishNS.Provider<Rec[]>

			StatGet(At : number) : WishNS.Provider<Stat?>
			StatRec(Q : {At : number,In : number,Out : number,Conn : number}) : AnyP
			StatAfter(At : number) : WishNS.Provider<Stat[]>

			ExtAll() : WishNS.Provider<Ext[]>
			ExtLst(Q : {Ext : Ext[]}) : AnyP
			ExtDel(Key : string[]) : AnyP
			ExtSet(Q : {Key : string,Val : string}) : AnyP
		}
	}
	interface DBLink
	{
		All() : WishNS.Provider<Link[]>
		Lst(Q : {Link : Link[]}) : AnyP
		Max() : WishNS.Provider<number>
		New(Q :
		{
			Row : number
			Birth : number
			Local : number
			Target : number
			Host : string
			Port : number
		}) : AnyP
		On(Q : {Row : number}) : AnyP
		Off(Q : {Row : number}) : AnyP
		Con(Q : {Row : number,At : number}) : AnyP
		Mod(Q :
		{
			Row : number
			Local : number
			Target : number
			Host : string
			Port : number
		}) : AnyP
		Del(Q : {Row : number}) : AnyP
		Rec(Q : {Row : number,F2T : number,T2F : number}) : AnyP
		Ind(Q : {Row : number,Ind : number}) : AnyP
	}

	interface Pool
	{
		Row? : number
		/** Non DB field */
		Online? : number
		ID? : string
		Birth? : number
		VerNode? : string
		VerWish? : string
		VerPool? : string
		Name? : string
		Desc? : string
		IP? : string
		Ping? : number
		Count? : number
		LastOn? : number
		LastOff? : number
		F2T? : number
		T2F? : number
	}
	interface Link
	{
		Row? : number
		Online? : number
		Birth? : number
		Local? : number
		Target? : number
		Host? : string
		Port? : number
		Visit? : number
		Last? : number
		F2T? : number
		T2F? : number
		Ind? : number
		/** Non DB field */
		Using? : number
		/** Non DB field */
		Deploy? : number
		/** Non DB field */
		Err? : string
	}
	interface Rec
	{
		Row? : number
		Online? : number
		Birth? : number
		Connected? : number
		Duration? : number
		HostFrom? : number
		HostTo? : number
		Req? : string
		F2T? : number
		T2F? : number
	}
	interface Stat
	{
		At? : number
		InBound? : number
		OutBound? : number
		Conn? : number
	}
	interface Ext
	{
		Key? : string
		Val? : string
	}
}
declare module 'crabpool'
{
	var CrabPool : CrabPoolNS.CrabPool
	export = CrabPool
}