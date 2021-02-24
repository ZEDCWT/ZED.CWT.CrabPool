'use strict'
var
WW = require('@zed.cwt/wish'),
{X : WX,N : WN} = WW,
SQLite = require('sqlite3');

/**@type {CrabPoolNS.DB}*/
module.exports = Option =>
{
	var
	PathData = Option.PathData,

	DB,
	Exec,
	Run,
	Get,
	All,
	MakeDB = H => (...Q) => WX.P(O =>
	{
		H.call(DB,...Q,(E,R) =>
		{
			if (E)
			{
				if (WW.IsObj(E)) E.Code = Q[0]
				O.E(E)
			}
			else
			{
				O.D(R).F()
			}
		})
	}),



	MakeLink = /**@type {(H : string) => CrabPoolNS.DBLink}*/ H => (
	{
		All : () => All(`select * from ${H} where 0 <> Enabled order by Row`),
		Lst : Q => WX.Merge
		(
			Run(`update ${H} set Enabled = 0 where 0 <> Enabled`),
			...Q.Link.map(V => Run
			(
				`
					replace into ${H} values
					(
						?,9,?,?,
						?,?,?,?,
						?,?,?,?
					)
				`,
				[
					V.Row,
					V.Online,
					V.Birth,
					V.Local,
					V.Target,
					V.Host,
					V.Port,
					V.Visit,
					V.Last,
					V.F2T,
					V.T2F,
				]
			))
		).Fin(),
		Max : () => Get(`select max(Row) Max from ${H}`).Map(B => B.Max),
		New : Q => Run(`insert into ${H} values(?,9,9,?,?,?,?,?,0,null,0,0)`,
			[Q.Row,Q.Birth,Q.Local,Q.Target,Q.Host,Q.Port]),
		On : Q => Run(`update ${H} set Online = 9 where ? = Row and 0 = Online`,[Q.Row]),
		Off : Q => Run(`update ${H} set Online = 0 where ? = Row and 0 <> Online`,[Q.Row]),
		Con : Q => Run(
		`
			update ${H} set
				Visit = 1 + Visit,
				Last = ?
			where ? = Row
		`,[Q.At,Q.Row]),
		Mod : Q => Run(
		`
			update ${H} set
				Local = ?,
				Target = ?,
				Host = ?,
				Port = ?
			where ? = Row
		`,[Q.Local,Q.Target,Q.Host,Q.Port,Q.Row]),
		Del : Q => Run(`update ${H} set Enabled = 0 where ? = Row`,[Q.Row]),
		Rec : Q => Run(`update ${H} set F2T = F2T + ?,T2F = T2F + ? where ? = Row`,[Q.F2T,Q.T2F,Q.Row]),
	});

	return {
		Init : WX.P(O =>
		{
			DB = new SQLite.Database(WN.JoinP(PathData,'Pool.db'),E =>
			{
				if (E) O.E(E)
				else
				{
					Exec = MakeDB(DB.exec)
					Run = MakeDB(DB.run)
					Get = MakeDB(DB.get)
					All = MakeDB(DB.all)
					O.D().F()
				}
			})
			DB.serialize()
		})
			.FMap(() => Exec(
			`
				create table if not exists Pool
				(
					Row integer primary key,
					Enabled integer,
					ID text,
					Birth integer,
					VerNode text,
					VerWish text,
					VerPool text,
					Name text,
					Desc text,
					IP text,
					Ping integer,
					Count integer,
					LastOn integer,
					LastOff integer,
					F2T integer,
					T2F integer
				);
				create table if not exists LinkGlobal
				(
					Row integer primary key,
					Enabled integer,
					Online integer,
					Birth integer,
					Local integer,
					Target integer,
					Host text,
					Port integer,
					Visit integer,
					Last integer,
					F2T integer,
					T2F integer
				);
				create table if not exists Link
				(
					Row integer primary key,
					Enabled integer,
					Online integer,
					Birth integer,
					Local integer,
					Target integer,
					Host text,
					Port integer,
					Visit integer,
					Last integer,
					F2T integer,
					T2F integer
				);
				create table if not exists Rec
				(
					Row integer primary key,
					Online integer,
					Birth integer,
					Connected integer,
					Duration integer,
					HostFrom integer,
					HostTo integer,
					Req text,
					F2T integer,
					T2F integer
				);
				create table if not exists Stat
				(
					At integer primary key,
					InBound integer,
					OutBound integer,
					Conn integer
				);
				create table if not exists Ext
				(
					Key text primary key,
					Val text
				);
				update Rec set Online = 0 where 0 <> Online;
			`.replace(/^	{4}/mg,'').trim())),

			PoolAll : () => All(`select * from Pool where 0 <> Enabled order by Row`),
			PoolLst : Q => WX.Merge
			(
				Run('update Pool set Enabled = 0 where 0 <> Enabled'),
				...Q.Pool.map(V => Run
				(
					`replace into Pool values(?,9,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
					[
						V.Row,
						V.ID,
						V.Birth,
						V.VerNode,
						V.VerWish,
						V.VerPool,
						V.Name,
						V.Desc,
						V.IP,
						V.Ping,
						V.Count,
						V.LastOn,
						V.LastOff,
						V.F2T,
						V.T2F,
					]
				))
			).Fin(),
			PoolMax : () => Get(`select max(Row) Max from Pool`).Map(B => B.Max),
			PoolNew : Q => Run(
			`
				insert into Pool values
				(
					?,9,?,?,
					null,null,null,
					'','',
					null,null,0,null,null,0,0
				)
			`,[Q.Row,Q.ID,Q.Birth]),
			PoolNm : Q => Run(`update Pool set Name = ? where ? = Row`,[Q.Nm,Q.Row]),
			PoolDes : Q => Run(`update Pool set Desc = ? where ? = Row`,[Q.Des,Q.Row]),
			PoolOn : Q => Run(
			`
				update Pool set
					IP = ?,
					Count = 1 + Count,
					LastOn = ?,
					LastOff = ?,
					VerNode = ?,
					VerWish = ?,
					VerPool = ?
				where ? = Row
			`,[Q.IP,Q.At,Q.At,Q.VN,Q.VW,Q.VP,Q.Row]),
			PoolOff : Q => Run(
			`
				update Pool set
					LastOff = ?
				where ? = Row
			`,[Q.At,Q.Row]),
			PoolPing : Q => Run(
			`
				update Pool set
					Ping = ?,
					LastOff = ?
				where ? = Row
			`,[Q.Ping,Q.At,Q.Row]),
			PoolDel : Q => Run('update Pool set Enabled = 0 where ? = Row',[Q.Row]),
			PoolRec : Q => Run(`update Pool set F2T = ?,T2F = ? where ? = Row`,[Q.F2T,Q.T2F,Q.Row]),

			LinkGlobal : MakeLink('LinkGlobal'),
			Link : MakeLink('Link'),

			RecMax : () => Get(`select max(Row) Max from Rec`).Map(B => B.Max),
			RecNew : Q => Run(`insert into Rec values(?,9,?,null,null,?,?,?,null,null)`,
				[Q.Row,Q.Birth,Q.From,Q.To,Q.Req]),
			RecCon : Q => Run(
			`
				update Rec set
					Connected = ?,
					Duration = 0,
					F2T = 0,
					T2F = 0
				where ? = Row
			`,[Q.At,Q.Row]),
			RecRec : Q => Run(
			`
				update Rec set
					Duration = ?,
					F2T = ?,
					T2F = ?
				where ? = Row
			`,[Q.Duration,Q.F2T,Q.T2F,Q.Row]),
			RecOff : Q => Run(`update Rec set Online = 0 where ? = Row`,[Q]),

			StatGet : Q => Get(`select * from Stat where ? = At`,[Q]),
			StatRec : Q => Run(`replace into Stat values(?,?,?,?)`,[Q.At,Q.In,Q.Out,Q.Conn]),

			ExtAll : () => All('select * from Ext'),
			ExtLst : Q => WX.Merge(...Q.Ext.map(V =>
				Run(`replace into Ext values(?,?)`,[V.Key,V.Val]))),
			ExtDel : Q => WX.Merge(...Q.map(V =>
				Run('delete from Ext where ? = Key',[V]))),
			ExtSet : Q => Q.Val ?
				Run('replace into Ext values(?,?)',[Q.Key,Q.Val]) :
				Run('delete from Ext where ? = Key',[Q.Key]),
	}
}