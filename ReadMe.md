# CrabPool | Yet Another Private Network Solution

CrabPool aims to create a centralized network that one can access resources related to any other nodes in the network easily.



## Index
+ [Installation](#installation)
+ [Usage](#usage)
+ [API]
+ [Misc](#misc)
+ [Examples](#examples)
+ [Changelog](#changelog)



## Installation
```sh
npm i crabpool
```



## Usage
To create a CrabPool network, a unique Master is required, and all other Nodes would connect to the Master to accomplish the network.

### Create a Master
```js
const CrabPool = require('crabpool')

CrabPool(
{
	Cipher : () => <A cipher, will be described in section API>,
	Deipher : () => <A decipher, responses to the cipher above>,
	PortMaster : 3389 // Port to deploy the master
})
```

### Create a Node
```js
const CrabPool = require('crabpool')
const Net = require('net')

CrabPool(
{
	Cipher : () => <The same cipher used by the master>,
	Deipher : () => <The same decipher used by the master>,
	Pipe : () => Net.createConnection(3389,'IP to the master')
})
```

### Custom the Links
To access the resources of other Nodes, one needs to configure links. Simply install the optional dependence `ws` by `npm i ws`, and add `PortWeb` property to the setup object like this:
```js
const CrabPool = require('crabpool')

CrabPool(
{
	Cipher : ...,
	Deipher : ...,
	Pipe : ...,
	PortWeb : 4000
})
```
Then a local web server `localhost:4000` will be deployed and can be visited from browsers (that support WebSocket). The initial manage token can be found in the [Data Folder](#data-folder-structure)
You can also use it as an `Express.Router` and mount it to any path you like on an existing server, which will also be described in the [API] section.



## API

### CrabPool(Option)
+ `Option` : `Object`
	+ `Cipher` : `import('crypto').Cipher` Optional. A cipher to encrypt/compress/etc the data stream, must not use block ciphers that output only when blocks are filled (such as `AES-CBC`). Leave empty if the socket is already secured or for debug use. See [Example : Cipher][ExCipher]
	+ `Decipher` : `import('crypto').Cipher` Optional. A decipher responses to the `Cipher` above. See [Example : Cipher][ExCipher]
	+ `PortMaster` : `number` Required for the Master, must not be present for Nodes. Port to deploy a Master server.
	+ `PortWeb` : `number` Optional. Port to deploy the Web Server.
	+ `Pipe(Log,Ind?)` Require for Nodes, must not be present for the Master. See [Example : Pipe][ExPipe]
		+ `Log` : `(...Q : any[]) => any`. Write logs.
		+ `Ind?` : `boolean`. True will be passed if this pipe connection is independent for a single socket.
		+ Returns : `import('net').Socket | WishNS.Provider<import('net').Socket>`
	+ `PipeRetry` : `number` Optional. Default `1E4`ms. Interval to wait before connecting to the Master again after the previous connection closed.
	+ `Tick` : `number` Optional. Default `6E4`ms. Heartbeat interval.
	+ `Timeout` : `number` Optional. Default `2 * Tick`ms. Time to wait to shutdown an inactive connection.
	+ `Data` : `string` Optional. Path to store settings, logs and other files. See [Data Folder Structure](#data-folder-structure)
	+ `Log` : `(...Q : any[]) => any` Optional. Control how should `CrabPool` logs.
	+ `RecordByte` : `number` Optional. Default `0`. Record first few bytes of the communications of each link.
+ Returns : `Object`
	+ `Exp` : `(Express? : import('express').Router) => import('express').Router`. Given an optional `Express.Router` object, returns the Router. See [Example : Custom Web Server][ExWeb]
	+ `Soc` : `(S : import('ws'),H : import('http').IncomingMessage) => any`. Used to handle event `import('ws')::on('connection')`. See [Example : Custom Web Server][ExWeb]



## Misc

### Data Folder Structure
Windows `%AppData%/ZED/CrabPool`  
Unix `%HOME%/.local/share/ZED/CrabPool`  
Mac `%HOME%/Library/Preferences/ZED/CrabPool`  
```sh
ZED/CrabPool
+-- ID # Unique machine ID, randomly generated on the first run.
+-- Key # The manage token for the Web Server, randomly generated on the first run
+-- Pool.db # The database
+-- Session.json # Stores the previous connection status
+-- Log/ # All logs will be output here.
|   +-- Event*.log
```



## Examples

### Example : Cipher
```js
const Crypto = require('crypto')
const Key = ...
const IV = ...

CrabPool(
{
	Cipher : () => Crypto.createCipheriv('AES-128-CFB',Key,IV),
	Decipher : () => Crypto.createDecipheriv('AES-128-CFB',Key,IV),
})
```

### Example : Pipe
Simply connect to the Master
```js
const CrabPool = require('crabpool')
const Net = require('net')

CrabPool(
{
	Pipe : () => Net.createConnection({host : ...,port : ...})
})
```
Connect to the Master with dynamic address
```js
const CrabPool = require('crabpool')
const Net = require('net')
const Wish = require('@zed.cwt/wish')

let Addr

CrabPool(
{
	Pipe : Wish.X.WrapPromise((Log,Ind) =>
	{
		if (Ind && Addr) return Promise.resolve(Net.createConnection(Addr))
		return ResolveAddr()
			.then(O =>
			{
				Log('Resolved',O)
				return Net.createConnection(Addr = O)
			})
	})
})

// Can also use RxJS here
CrabPool(
{
	Pipe : Wish.X.WrapRx(Log =>
	{
		return RxJS.Observable<Net.Socket>
	})
})
```

### Example : Custom Web Server
Required dependencies
```sh
npm i ws express
```
Then
```js
const CrabPool = require('crabpool')
const Express = require('express')
const HTTP = require('http')
const WS = require('ws')

const Pool = CrabPool({...})
const Exp = Express().use('/Fish',Pool.Exp())
const Server = HTTP.createServer(Exp).listen(8000)
new WS.Server({server : Server,path : '/Fish/'})
	.on('connection',Pool.Soc)
```
And now you can visit from `localhost:8000/Fish`



## Changelog

### Updates from v0.x.x
V1 is a rewrite of V0, including the following highlights
+ Extensible protocol. The size of message packets is up to 65535 in V0 including random paddings, making it impossible to handle larger messages. V1 now supports arbitrary sizes of messages.
+ Socket pause & resume. In an asymmetrical connection network for V0, data may be queued in the memory waiting to be sent, causing congestion issues. It is now handled in V1 by pausing & resuming at appropriate timing.
+ Database. V1 now uses SQLite instead of JSON files to persist infomation.
+ GlobalLink. It is now possible to configure common links at the Master side, the all nodes would benefit from them.
+ Statistic. V1 added few statistic fields to monitor the pool.
+ Active connection. It is now possible to monitor/cut active connections through the current node. Because of this, we removed the socket timeout facility, so that connections can stay as long as both the server & the client agree.




[API]: #api
[ExCipher]: #example--cipher
[ExPipe]: #example--pipe
[ExWeb]: #example--custom-web-server