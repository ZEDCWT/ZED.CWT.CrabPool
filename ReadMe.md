# CrabPool | Yet Another Private Network Solution

CrabPool aims to create a centralized network that one can access resources related to any other nodes in the network easily.



## Index
+ [Installation](#installation)
+ [Usage](#usage)
+ [API]
+ [Misc](#misc)
+ [Examples](#examples)



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
	Deipher : () => <A decipher, will be described in section API>,
	PortMaster : 2412 // Port to deploy the master
})
```

### Create a node
```js
const CrabPool = require('crabpool')
const Net = require('net')

CrabPool(
{
	Cipher : () => <The same cipher used by the master>,
	Deipher : () => <The same decipher used by the master>,
	Pipe : () => Net.createConnection(2412,'IP to the master')
})
```

### Custom the Links
To access resources of other Nodes, one need to configure links. Simply install the optional dependence `ws` by `npm i ws`, and add `PortWeb` property to the setup object like this:
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
Then a local web server `localhost:4000` will be deploy and can be visited from browsers (that support WebSocket). The initial manage token can be found in the log, whice will be described in section [API], prefixed with `Key`.
You can also use it as an `Express.Router` and mount it to any path you like on an existing server, which will also be described in the [API] section.



## API

### CrabPool(Option)
+ `Option` : `Object`
	+ `Cipher` : `() => WishNS.Algo | {data(Q : Buffer) : Buffer}` Required. A cipher to encrypt/compress/etc the data stream, must not use block ciphers that output only when blocks are filled (such as `aes-128-cbc`). See [Example : Cipher][ExCipher]
	+ `Decipher` : `() => WishNS.Algo | {data(Q : Buffer) : Buffer}` Required. A decipher responses to the `Cipher` above. See [Example : Cipher][ExCipher]
	+ `PortMaster` : `number` Optional. Port to deploy a Master server.
	+ `PortWeb` : `number` Optional. Port to deploy the Web Server.
	+ `Pipe(Control,Log)` Require for Nodes, must not be present for the Master. See [Example : Pipe][ExPipe]
		+ `Control` : `boolean`. When `true`, then it currently requires a socket to transfer control messages, or when `false`, it requires a socket to establish tunnels.
		+ `Log` : `(...Q : any[]) => any`. Write logs.
		+ Returns : `Net.Socket | WishNS.Provider<Net.Socket>`
	+ `Retry` : `number` Optional. Default `1E4`ms. Interval to wait before connecting to the Master again after the previous connection closed.
	+ `Timeout` : `number` Optional. Default `3E5`ms. Time to wait to shutdown an inactive connection.
	+ `Tick` : `number` Optional. Default `2E4`ms. Interval to transfer heartbeat packages.
	+ `Data` : `string` Optional. Default : Windows `%AppData%/ZED/CrabPool`, Unix `%HOME%/.local/share/ZED/CrabPool`, Mac `%HOME%/Library/Preferences/ZED/CrabPool`. Path to store settings, logs and other files. See [Data Folder Structure](#data-folder-structure)
	+ `Log` : `(...Q : any[]) => any` Optional. Control how should `CrabPool` logs.
+ Returns : `Object`
	+ `Log` : `(...Q : any[]) => any`. Log to where `CrabPool` logs.
	+ `Exp` : `(Express? : require('express')) => require('express').Router`. Given an optional `Express` object, returns a Router. See [Example : Custom Web Server][ExWeb]
	+ `Soc` : `Function`. Used to handle event `require('ws')::on('connection')`. See [Example : Custom Web Server][ExWeb]



## Misc

## Data Folder Structure
```sh
ZED/CrabPool
+-- ID # Unique machine ID, randomly generated on the first run.
+-- Key # The manage token for the Web Server, randomly generated on the first run, the original token will also be logged.
+-- Pool.json # The database of all machines in the network.
+-- Link.json # The database of Links.
+-- LinkS.json # Status of Links.
+-- Log/ # All logs will be output here.
|   +-- Event*.log
```



## Examples

### Example : Cipher
Use `crypto`
```js
const Crypto = require('crypto')
const Key = ...
const IV = ...

CrabPool(
{
	Cipher : () => Crypto.createCipheriv('aes-128-cfb',Key,IV),
	Decipher : () => Crypto.createDecipheriv('aes-128-cfb',Key,IV),
})
```
Use bundled methods
```js
const CrabPool = require('crabpool')
const Wish = require('@zed.cwt/wish')
const Key = 'A key ...' || Buffer.from('A key ...')
const IV = 'An IV' || Buffer.from('An IV')

CrabPool(
{
	Cipher : () => Wish.C.AESES(Key,IV,Wish.C.CFB),
	Decipher : () => Wish.C.AESDS(Key,IV,Wish.C.CFB)
})
```

### Example : Pipe
Simply connect to the Master
```js
const CrabPool = require('crabpool')
const Net = require('net')

CrabPool(
{
	Pipe : () => Net.createConnection({host : ...,port : ...,allowHalfOpen : ...})
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
	Pipe : Wish.X.WrapPromise((Control,Log) =>
	{
		if (!Control && Addr) return Promise.resolve(Net.createConnection(Addr))
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
	Pipe : Wish.X.WrapRx((Control,Log) =>
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



[API]: #api
[ExCipher]: #example--cipher
[ExPipe]: #example--pipe
[ExWeb]: #example--custom-web-server