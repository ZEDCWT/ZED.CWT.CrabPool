declare module CrabPoolNS
{
	import Net = require('net')
	interface CrabPool
	{
		(Q :
		{
			Cipher() : WishNS.Algo | {data(Q : Buffer) : Buffer}
			Decipher() : WishNS.Algo | {data(Q : Buffer) : Buffer}
			PortMaster? : number
			PortWeb? : number
			Pipe?(Control : boolean,Log : (...Q : any[]) => any) : Net.Socket | WishNS.Provider<Net.Socket>
			Retry? : number
			Timeout? : number
			Tick? : number
			Data? : string
			Log? : ((...Q : any[]) => any) | false
		}) : {
			Log(...Q : any[]) : any
			ID() : string
			/**Express.Router*/
			Exp(Express? : object) : object
			/**WS.on('connection')*/
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
		To? : number
		Name? : string
		Desc? : string
	}

	interface Link
	{
		S : boolean
		Boom : number
		Host : string
		Addr : string
		Port : number
	}
	interface LinkS
	{
		Visit : number
		Using : number
		Last : number
		Port : number
	}
}
declare module 'crabpool'
{
	var CrabPool : CrabPoolNS.CrabPool
	export = CrabPool
}