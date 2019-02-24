const fs = require('fs');
const through = require('through2');
const parseOSM = require('osm-pbf-parser');
const Database = require('better-sqlite3');

/** @type {{files:string, d:string, c:boolean, memory:number, l:number}} */
const argv = require('yargs')
    .options({
        f: {
            alias: 'files',
            array: true,
            describe: 'Path(s) to input file(s) .osm.pbf',
            demand: true,
            normalize: true
        },
        d: {
            alias: 'database',
            nargs: 1,
            describe: 'Path to .sqlite database',
            demand: true,
            normalize: true
        },
        c: {
            describe: 'Coalesce keys like name:xx into name',
            boolean: true
        },
        l: {
            alias: 'limit',
            describe: 'Represent key with more than l values as single row with value "~"',
            number: true,
            default: 256
        },
        memory: {
            describe: 'Cache size in Mb',
            default: 1024,
            number: true
        },
        h: {alias: 'help'}
    })
    .usage('Extracts all keys and their values from an OSM pbf file.')
    .version(false)
    .strict(true)
    .argv;

const db = new Database(argv.d, {verbose: null});
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = 1');
db.pragma(`cache_size = -${argv.memory*1024}`);

const create_stmt = db.prepare(
    'create table if not exists osmtags(' +
    'key text not null, value text not null,' +
    'n int default 0, w int default 0, r int default 0,' +
    'primary key(key, value))');
const drop_stmt = db.prepare('drop table if exists osmtags');

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
    if (count > 0)
        console.log('%d records loaded', count);
}

function store() {
    const ins_stmt = db.prepare('insert into osmtags values(?,?,?,?,?)');
    drop_stmt.run();
    create_stmt.run();
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
        fs.createReadStream(file)
            .pipe(parseOSM())
            .pipe(through.obj(
                (items, enc, next) => {
                    for (let item of items)
                        callback(item);
                    next();
                }))
            .on('finish', resolve);
    });
}

async function pass() {
    for (let file of argv.files) {
        console.log('reading ' + file);
        let count = 0;
        let empty = [0, 0, 0];
        await scan(file, item => {
            let {type, tags} = item;
            let j = type == 'node' ? 0 : type == 'way' ? 1 : 2;
            let haskeys = false;
            for (let key in tags) if (tags.hasOwnProperty(key)) {
                haskeys = true;
                let value = tags[key];
                if (argv.c) {
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
                else if (Object.keys(row).length <= argv.l) {
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
            if ((++count % 1000000) === 0)
                process.stdout.write('objects: ' + count + '\r');
        });
        console.log('objects:', count);
        console.log('no tags in %d nodes, %d ways, %d relations', ...empty);
    }
}

create_stmt.run();
load();
console.time('elapsed');
pass().then(() => {
    store();
    db.close();
    console.timeEnd('elapsed');
});