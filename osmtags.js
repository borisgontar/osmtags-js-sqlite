import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { parseArgs, format } from 'node:util';
import { join, dirname } from 'node:path';
import { Transform } from 'readable-stream';
import { BlobDecompressor, BlobParser, PrimitivesParser } from './lib/parser.js';
import Database from 'better-sqlite3';

const usage = `
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
`;

const { args, files } = (() => {
    try {
        const { values, positionals } = parseArgs({
            options: {
                database: { type: 'string', short: 'd' },
                coalesce: { type: 'boolean', short: 'c' },
                limit: { type: 'string', short: 'l' },
                quiet: { type: 'boolean', short: 'q' },
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean' }
            },
            allowPositionals: true,
            strict: true
        });
        if (values.help) {
            console.log(usage);
            process.exit(0);
        }
        if (values.version) {
            version();
            process.exit(0);
        }
        if (!values.database)
            throw new Error('Required option missing: -d.');
        let l = Number(values.limit) || 256;
        if (!Number.isInteger(l) || l < 0)
            throw new Error('Option --limit should be a positive integer.');
        return { args: values, files: positionals };
    } catch (err) {
        console.log(usage);
        console.log(err.message);
        process.exit(1);
    }
})();

const create_sql = `
create table if not exists osmtags (
  key text not null,
  value text not null,
  n int default 0,
  w int default 0,
  r int default 0,
  primary key(key, value))
`;

const db = (() => {
    try {
        const db = new Database(args.database);
        db.prepare(create_sql).run();
        return db;
    } catch (err) {
        console.log(err.message);
        process.exit(1);
    }
})();

const table = {};

function load() {
    let stmt = db.prepare('select key, value, n, w, r from osmtags');
    let count = 0;
    for (let row of stmt.iterate()) {
        let {key, value, n, w, r} = row;
        if (!table[key])
            table[key] = {};
        table[key][value] = [n, w, r];
        count += 1;
    }
    if (count > 0 && !args.quiet)
        console.log(`${count} records loaded from existing osmtags`);
}

function store() {
    const ins_stmt = db.prepare('insert or replace into osmtags values(?,?,?,?,?)');
    db.prepare('begin').run();
    for (let key of Object.keys(table).sort()) {
        let row = table[key];
        for (let value of Object.keys(row).sort()) {
            let c = row[value];
            ins_stmt.run(key, value, c[0], c[1], c[2]);
        }
    }
    db.prepare('commit').run();
}

/**
 * @param {string} file
 * @param {Function} callback
 * @returns {Promise}
 */
function scan(file, callback) {
    return new Promise(resolve => {
        createReadStream(file)
            //.pipe(parseOSM())
            .pipe(new BlobParser())
            .pipe(new BlobDecompressor())
            .pipe(new PrimitivesParser({withInfo: false}))
            .pipe(new Transform.PassThrough({
                objectMode: true,
                //highWaterMark: 1,
                transform: (items, enc, next) => {
                    for (let item of items)
                        callback(item);
                    next();
                }
            }))
            .on('finish', resolve);
    });
}

async function pass() {
    for (let file of files) {
        if (!existsSync(file)) {
            console.log(`File not found: '${file}', skipping.`);
            continue;
        }
        if (!args.quiet)
            console.log('reading ' + file);
        const count = [0, 0, 0];
        const empty = [0, 0, 0];
        const tmout = args.quiet ? 0 : setInterval(() => {
            process.stdout.write(format(
                'scanned: %d nodes, %d ways, %d relations\r', ...count));
        }, 1000);
        const limit = parseInt(args.limit);
        let elapsed = Date.now();
        await scan(file, item => {
            let {type, tags} = item;
            let j = type == 'node' ? 0 : type == 'way' ? 1 :
                type == 'relation' ? 2 : -1;
            if (j < 0)
                throw new Error('file format error: type=' + type);
            let haskeys = false;
            for (let key in tags) {
                haskeys = true;
                let value = tags[key];
                if (args.coalesce) {
                    let i = key.indexOf(':');
                    if (i > 0)
                        key = key.substring(0, i);
                }
                if (!table[key])
                    table[key] = {};
                const row = table[key];
                if (row['~'])
                    row['~'][j] += 1;
                else if (row[value])
                    row[value][j] += 1;
                else if (Object.keys(row).length <= limit) {
                    row[value] = [0, 0, 0];
                    row[value][j] += 1;
                } else {
                    let acc = [0, 0, 0];
                    for (let v in row) {
                        acc[0] += row[v][0];
                        acc[1] += row[v][1];
                        acc[2] += row[v][2];
                    }
                    acc[j] += 1;
                    table[key] = {'~': acc};
                }
            }
            if (!haskeys)
                empty[j] += 1;
            count[j] += 1;
        });
        elapsed = (Date.now() - elapsed) * 0.001;    // seconds
        if (!args.quiet) {
            clearInterval(tmout);
            let ips = (count[0] + count[1] + count[2]) / elapsed;
            console.log('scanned: %d nodes, %d ways, %d relations', ...count);
            console.log(`         ${ips.toFixed(0)} items/sec.`);
            console.log('no tags in %d nodes, %d ways, %d relations', ...empty);
        }
    }
}

function version() {
    const db = new Database(':memory:');
    const sqlite_version = db.prepare('select sqlite_version()').pluck().get();
    db.close();
    let version = 'unknown';
    try {
        const pkgfn = join(dirname(process.argv[1]), '/package.json');
        const pkg = JSON.parse(readFileSync(pkgfn).toString());
        version = pkg.version;
    } catch (err) {
        console.log('Installation problem: package.json missing or corrupted.');
    }
    console.log(`App version: ${version}, Node: ${process.versions.node}, ` +
        `SQLite: ${sqlite_version}`);
}

try {
    load();
    if (!args.quiet)
        console.time('elapsed');
    pass().then(() => {
        store();
        db.close();
        if (!args.quiet)
            console.timeEnd('elapsed');
    });
} catch (err) {
    console.dir(err);
    process.exit(1);
}
