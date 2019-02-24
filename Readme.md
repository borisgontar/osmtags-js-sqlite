# osmtags-js-sqlite

This is a simple Node.js application to collect tags from OpenStreetMap `osm.pbf` files into a SQLite3 database. It extracts all tags from the input files and creates a table in the target  database with the following data:
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
Some keys, like `name` can have too many values, so there is a limit for number of such values. When this limit is reached all {key, value} table rows for such key are coalesced into a single row with value "~". In this case the counts represent numbers of times the key was found in nodes, ways and relations, regardless of its value.

Some keys can have multiple 'subkeys', like `addr:street`, `addr:housenumber`, etc. The application allows to coalesce such keys into a single one (`addr` in this example). 

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
  <dt>-f path-to-osm.pdf [another-path ...]</dt>
  <dd>input file(s)</dd>
  <dt>-d path-to-database.sqlite</dt>
  <dd>The target database. If the database does not exists it will be created. If the table <code>osmtags</code> does not exists it will be created, otherwise the new data will be merged with existing data. </dd>
  <dt>-c</dt>
  <dd>Treat all keys like <code>addr</code> and <code>addr:whatever</code> as the same key <code>addr</code>.</dd>
  <dt>-l <i>number</i></dt>
  <dd>Limit number of stored distinct values for a key to the specified <i>number</i>. The default is 256.</dd>
  <dt>--memory <number></dt>
  <dd>SQLite3 cache size in Mb. The default is 1024.</dd>
</dl>

## An example
Due to excellent osm-pbf-parser by substack and better-sqlite3 by JoshuaWise the application is simple and fast. Counting tags in `north-america-latest.osm.pbf` (dated end of Jan. 2019, 8.1Gb) took less than 15 min. on my PC (Intel i7-2600 at 3.40GHz).
```
$ node osmtags.js -d tags-na.sqlite -f ../north-america-latest.osm.pbf -c -l 1024
reading ..\north-america-latest.osm.pbf
objects: 1139007752
no tags in 1031193760 nodes, 2699506 ways, 1030 relations
elapsed: 853037.913ms
```
The resuling database is about 10.5Mb in size. 
