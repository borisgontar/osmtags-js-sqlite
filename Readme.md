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
  n int default 0, -- number of times 'amenity=fuel' seen in nodes
  w int default 0, --    same in ways
  r int default 0, --    same in relations
  primary key(key, value)
);
```
Some keys, like `addr:street` can have too many values, so there is a limit for number of such values. When this limit is reached all {key, value} records for such key are coalesced into a single record with value "~". In this case the counts simply represent numbers of times the key was found in nodes, ways and relations, regardless of its value.

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
<dt>-f path-to-osm.pdf [another-path ...]</dt>
<dd>input file(s) </dd>
