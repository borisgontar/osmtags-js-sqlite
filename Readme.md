# osmtags-js-sqlite

This is a simple Node.js application to collect tags from an OpenStreetMap `osm.pbf` file into a SQLite3 database. It extracts all tags from the input file and creates a table in the target  database with the following data:
* All distinct keys present in the tags.
* For each key, all (well, almost) its distinct values. 
* For each {key, value} pair, number of times this pair was found in nodes, ways and relations.

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
Some keys, like `addr:street` can have too many values, so there is a limit for number of such values. When this limit is reached all {key, value} records for such key are coalesced into a single record with value "~". In this case the counts represent numbers of times the key was found in nodes, ways and relations, regardless of its value.

Some keys can have multiple 'subkeys', like `addr:street`, `addr:housenumber`, etc. The application allows to coalesce such keys into a single one (`addr` in this example). 

## Installation
Install the dependencies:
```bash
npm install through2
npm install osm-pbf-parser
npm install better-sqlite3
```
Then just copy the source file `osmtags.js` into the directory where the dependencies were installed.

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
  <dd>Treat keys like <code>addr</code> and <code>addr:whatever</code> as the same key <code>addr</code>.</dd>
  <dt>-l <i>number</i></dt>
  <dd>Limit number of stored distinct values for a key to the specified <i>number</i>. The default is 256.</dd>
  <dt>--memory <number></dt>
  <dd>SQLite3 cache size in Mb. The default is 1024.</dd>
</dl>
