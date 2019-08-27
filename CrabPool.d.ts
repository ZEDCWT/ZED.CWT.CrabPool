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
			Data? : string
			Log? : ((...Q : any[]) => any) | false
		}) : {
			Log(...Q : any[]) : any
			// Express.Router
			Exp : object
			// WS.on('connection')
			Soc : Function
		}
	}

	interface Pool
	{
		MEZ? : boolean
		S : boolean
		Num : number
		IP : string
		Boom : number
		From : number
		To : number
		Name? : string
		Desc? : string
	}
}
declare module 'crabpool'
{
	var CrabPool : CrabPoolNS.CrabPool
	export = CrabPool
}