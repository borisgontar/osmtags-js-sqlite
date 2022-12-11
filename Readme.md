# osmtags-js-sqlite

This is a simple Node.js application to collect tags from OpenStreetMap `osm.pbf` files
into a SQLite3 database. It extracts all tags from the input files and creates
a table in the target database with the following data:
* All distinct keys present in the tags.
* For each key, all (if not too many) its distinct values.
* For each {key, value} pair, numbers of times this pair was found in nodes, ways and relations.

The table is created as:
```sql
create table osmtags (
  key text not null,   -- tag's key, e.g. 'amenity'
  value text not null, -- tag's value, e.g. 'fuel'
  n int default 0,     -- number of times 'amenity=fuel' seen in nodes
  w int default 0,     --    same for ways
  r int default 0,     --    same for relations
  primary key(key, value)
);
```
Some keys, like `name` can have too many values, so there is a limit for number
of such values. When this limit is reached all {key, value} table rows for such
key are coalesced into a single row with value "~". In this case the counts
represent numbers of times the key was found in nodes, ways and relations,
regardless of its value.

Some keys can have multiple 'subkeys', like `addr:street`, `addr:housenumber`, etc.
The application allows to coalesce such keys into a single one (`addr` in this example).

## Installation
1. Clone the repository.
2. Run `npm install` to install the dependencies.

## Usage
Run the application as:
```bash
$ node osmtags.js options path-to-osm.pbf [another-path ...]
```

where _options_ are:
```
$ node osmtags.js -h

Extracts all keys and their values from an OSM pbf file into a SQLite database

Options:
  -d, --database    Path to the database.                           [required]
  -c, --coalesce    Coalesce keys like name:xx into single name.
  -l, --limit       Represent key with more than l values as single row
                    with value "~".                              [default 256]
  -q, --quiet       Run silently.
  -h, --help        Show this help and exit.
      --version     Show version number and exit.

Positional args: paths to the input files.
```
Note that:

* If the target database does not exists it will be created.
  If the table `osmtags` does not exists it will be created,
  otherwise the new data will be merged with existing data.

* If the `-c` option is present, all keys like `addr` and `addr:whatever`
are treated as the same key `addr`.

* The `-l` option sets the limit of stored distinct values for a key
 to the specified number. The default is 256.

The application is simple and fast. Counting tags in
`planet-latest.osm.pbf` (dated Oct. 2022, 67Gb) took 3 hours 10 min.
on my PC (Intel i7-2600 at 3.40GHz, memory DDR3 at 800MHz, SATA SSD).
```
$ node osmtags.js -d planet-tags.sqlite -c -l 1024 planet-latest.osm.pbf
reading planet-latest.osm.pbf
scanned: 7961992696 nodes, 892558311 ways, 10291367 relations
         778282 items/sec.
no tags in 7761372553 nodes, 14830012 ways, 182 relations
elapsed: 3:09:54.805 (h:mm:ss.mmm)
```

On my NUC (Intel i0-12900, memory DDR4 at 3200 MHz, NVMe SSD) the process
took 1 hour 14 min., 1995181 items/sec.

The resuling database is about 36Mb in size. It's included into the `example`
subdirectory just in case you want to play with it.

## Examples

To run queries against the database you need the `sqlite3` utility.
Download the 'sqlite-tools' binaries from https://sqlite.org/download.html and
copy the executable files into a directory in your $PATH. To make query results
look better, set output mode like this:
```bash
$ sqlite3 planet-tags.sqlite
SQLite version 3.40.0 2022-11-16 12:10:08
Enter ".help" for usage hints.
sqlite> .mode col
sqlite> .header on
```

The application does not trim leading and trailing white space from
keys and values. Let's see if there are such:
```sql
sqlite> select count(*) from osmtags where key != trim(key);
14
select count(*) from osmtags where value != trim(value);
564
```
OpenStreetMap allows but
[does not recommend](https://wiki.openstreetmap.org/wiki/Semi-colon_value_separator)
using semicolons as separators for multiple values of the same key. Let's see:
```sql
sqlite> select count(*) from osmtags where instr(value, ';') != 0;
21682
```
Which keys with too many values are most frequenly used?
```sql
sqlite> select key, (n+w+r) total from osmtags where value='~' order by total desc limit 10;
key         total
----------  ----------
building    575692021
addr        559712241
source      301573005
highway     229231539
name        111103790
tiger       75717248
natural     55921276
surface     48147704
ref         47618702
landuse     37465609
```
And what about keys with not too many values?
```sql
select key, value, (n+w+r) total from osmtags where value!='~' order by total desc limit 10;
key         value       total
----------  ----------  ----------
power       tower       14762730
wall        no          12164943
power       pole        10497260
lanes       2           9149008
layer       1           6741169
lit         yes         6404340
created_by  JOSM        4855805
lanes       1           4548328
intermitte  yes         4425470
leaf_type   broadleave  4273000
```
Which tags are used only in ways?
```sql
select key,value,w from osmtags where n=0 and r=0 order by w desc limit 10;
key         value       w
----------  ----------  ----------
LINZ        cliff_edge  54373
HFCS        Urban Mino  47301
mapper      mspray11    36623
HFCS        Urban Coll  34776
id_origin   ~           34293
mapper      mspray12    32129
zoning      grass       29480
footway     asphalt     27913
mapper      mspray13    26951
Source      Akros       25816
```

## P.S.
Of course the [taginfo](https://taginfo.openstreetmap.org/) site already has
all kinds of statistics about tags in the OpenStreetMap database.
I just wanted to have a tool, something small and simple and, most important,
easily customizable to my needs. After all, it's about 200 lines of code.
