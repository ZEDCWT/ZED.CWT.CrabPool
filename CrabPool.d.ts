declare module CrabPoolNS
{
	import Net = require('net')
	interface CrabPool
	{
		(Q :
		{
			Cipher() : WishNS.Algo
			Decipher() : WishNS.Algo
			PortMaster? : number
			PortWeb? : number
			Pipe(Control : boolean,Log? : (...Q : any[]) => any) : Net.Socket | WishNS.Provider<Net.Socket>
			Retry? : number
			Timeout? : number
			Tick? : number
			OnPool?() : any
			Data? : string
			Log? : ((...Q : any[]) => any) | false
		}) : WishNS.Provider<undefined>
	}
}
declare module 'crabpool'
{
	var CrabPool : CrabPoolNS.CrabPool
	export = CrabPool
}