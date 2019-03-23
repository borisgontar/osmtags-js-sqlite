# osmtags-js-sqlite

This is a simple Node.js application to collect tags from OpenStreetMap `osm.pbf` files
into a SQLite3 database. It extracts all tags from the input files and creates 
a table in the target  database with the following data:
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
node ./osmtags.js options
```
where _options_ are:
<dl>
  <dt>-f path-to-osm.pbf [another-path ...]</dt>
  <dd>input file(s)</dd>
  <dt>-d path-to-database.sqlite</dt>
  <dd>The target database. If the database does not exists it will be created. 
  If the table <code>osmtags</code> does not exists it will be created, 
  otherwise the new data will be merged with existing data. </dd>
  <dt>-c</dt>
  <dd>Treat all keys like <code>addr</code> and <code>addr:whatever</code> 
  as the same key <code>addr</code>.</dd>
  <dt>-l <i>number</i></dt>
  <dd>Limit number of stored distinct values for a key to the specified <i>number</i>. 
  The default is 256.</dd>
  <dt>-h, --help</dt>
  <dd>Prints short help message.</dd>
</dl>

## Examples
Due to excellent [osm-pbf-parser](https://github.com/substack/osm-pbf-parser) 
by substack and [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) 
by JoshuaWise the application is simple and fast. Counting tags in 
`north-america-latest.osm.pbf` (dated end of Jan. 2019, 8.1Gb) took less than 15 min. 
on my PC (Intel i7-2600 at 3.40GHz).
```
$ node osmtags.js -d tags-na.sqlite -f ../north-america-latest.osm.pbf -c -l 1024
reading ..\north-america-latest.osm.pbf
scanned: 1055691461 nodes, 82486428 ways, 829863 relations
no tags in 1031193760 nodes, 2699506 ways, 1030 relations
elapsed: 853037.913ms
```
The resuling database is about 10.5Mb in size. 

The application does not trim (removes leading and trailing white space) 
keys and values. Let's see if there are such:
```sql
sqlite> select count(*) from osmtags where key != trim(key);
0
select count(*) from osmtags where value != trim(value);
556
```
OpenStreetMap allows but 
[does not recommend](https://wiki.openstreetmap.org/wiki/Semi-colon_value_separator) 
using semicolons as separators for multiple values of the same key. Let's see:
```sql
sqlite> select count(*) from osmtags where instr(value, ';') != 0;
7334
```
Which keys with too many values are most frequenly used?
```sql
sqlite> select key, (n+w+r) total from osmtags where value='~' order by total desc limit 10;
key                        total
-------------------------  ------------
tiger                      80362772
addr                       60173520
building                   36065503
source                     30639740
name                       17251934
NHD                        11667256
waterway                   7838344
height                     6802137
gnis                       6780575
lacounty                   5928937
```
And what about keys with not too many values?
```sql
select key, value, (n+w+r) total from osmtags where value!='~' order by total desc limit 10;
key              value                      total
---------------  -------------------------  ----------
highway          residential                11472697
highway          service                    7896478
natural          water                      4528548
attribution      Office of Geographic and   2605080
access           private                    2555790
oneway           yes                        2460704
lanes            2                          2452580
power            tower                      2192232
highway          footway                    1992092
natural          tree                       1984326
```
Which tags are used only in ways?
```sql
select key,value from osmtags where n=0 and r=0 order by w desc limit 10;
condition   good 
width       12.2
width       15.2
highway     path
width       9.1
source      massgis
highway     tertiary
building    shed
hgv         yes
footway     sidewalk
```
## P.S.
Of course the [taginfo](https://taginfo.openstreetmap.org/) site already has 
all kinds of statistics about tags in the OpenStreetMap database. 
I just wanted something small and simple and, most important, 
easily customizable to my needs. After all, it's less than 200 lines of code. 
