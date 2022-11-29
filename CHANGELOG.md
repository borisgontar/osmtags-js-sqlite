# Change Log

## [1.2.1] - 2022-11-29

Dependency on substack/osm-pbf-parser removed as this package is
no longer (as of Nov. 2022) available on Github. The code is copied
into lib and a rewritten a bit.

## [1.2.0] - 2022-11-26

Code cleanup, dependencies updated.

## [1.1.0] - 2022-11-26

Dependencies updated. Dependency on yargs removed, now using
util.parseArgs from Node.js, so version 18.3.0 or newer is required.

Command line: paths to input files are now positional arguments.
