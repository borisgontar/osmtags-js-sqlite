/*
This is a trivial rewrite of substack/osm-pbf-parser version 2.3.0,
which no longer (as of Nov. 2022) available on Github.
See also astro/osm-pbf-parser there.
*/

import protobuf from 'protocol-buffers';
import { Transform } from 'readable-stream';
import { obj } from 'stream-combiner2';
import { inflate } from 'node:zlib';
import { readFileSync } from 'node:fs';

const SIZE = 0, HEADER = 1, BLOB = 2;
const NANO = 1e-9;

const parsers = {
    file: protobuf(readFileSync('./lib/fileformat.proto', 'utf8')),
    osm: protobuf(readFileSync('./lib/osmformat.proto', 'utf8'))
}

export class BlobParser extends Transform {
    constructor(options) {
        super(options);
        this._readableState.objectMode = true;
        this._readableState.highWaterMark = 1;
        this._writableState.objectMode = false;
        this._writableState.highWaterMark = 0;
        this._mode = SIZE;
        this._waiting = 4;
        this._prev = null;
        this._header = null;
        this._blob = null;
        this._offset = 0;
        this._sizeOffset = null;
    }

    /**
     * @param {Buffer} buf
     * @param {string} enc
     * @param {Function} next
     */
    _transform(buf, enc, next) {
        if (this._prev) {
            buf = Buffer.concat([this._prev, buf]);
            this._prev = null;
        }
        if (buf.length < this._waiting) {
            this._prev = buf;
            return next();
        }

        if (this._mode === SIZE) {
            this._sizeOffset = this._offset;
            let len = buf.readUInt32BE(0);
            this._mode = HEADER;
            this._offset += this._waiting;
            this._waiting = len;
            this._transform(buf.subarray(4), enc, next);
        }
        else if (this._mode === HEADER) {
            this._header = parsers.file.BlobHeader.decode(buf.subarray(0, this._waiting));
            this._mode = BLOB;
            let nbuf = buf.subarray(this._waiting);
            this._offset += this._waiting;
            this._waiting = this._header.datasize;
            this._transform(nbuf, enc, next);
        }
        else if (this._mode === BLOB) {
            this._blob = parsers.file.Blob.decode(buf.subarray(0, this._waiting));
            let h = this._header;
            this._mode = SIZE;
            let nbuf = buf.subarray(this._waiting);
            this._offset += this._waiting;
            this._waiting = 4;

            if (!this._blob.zlib_data)
                throw new Error("BlobParser: no zlib data, possibly unimplemented raw/lzma/bz2 data");
            this.push({
                type: h.type,
                offset: this._sizeOffset,
                zlib_data: this._blob.zlib_data
            });

            this._transform(nbuf, enc, next);
        }
    }
}

export class BlobDecompressor extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 1 });
    }
    /**
     * @param {Buffer} buf
     * @param {string} enc
     * @param {Function} callback
     */
    _transform(chunk, enc, callback) {
        inflate(chunk.zlib_data, (err, data) => {
            if (data) {
                chunk.data = data;
                delete chunk.zlib_data;
                this.push(chunk);
            }
            callback(err);
        });
    }
}

export class PrimitivesParser extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 1 });
    }
    /**
     * @param {Buffer} buf
     * @param {string} enc
     * @param {Function} callback
     */
    _transform(chunk, enc, callback) {
        if (chunk.type === 'OSMHeader') {
            this._osmheader = parsers.osm.HeaderBlock.decode(chunk.data);
        } else if (chunk.type === 'OSMData') {
            const block = parsers.osm.PrimitiveBlock.decode(chunk.data);
            const opts = {
                stringtable: decodeStringtable(block.stringtable.s),
                granularity: NANO * block.granularity,
                lat_offset: NANO * block.lat_offset,
                lon_offset: NANO * block.lon_offset,
                date_granularity: block.date_granularity,
                HistoricalInformation: this._osmheader.required_features.indexOf('HistoricalInformation') >= 0
            };
            // Output:
            const items = [];
            block.primitivegroup.forEach(group => {
                if (group.dense) {
                    parseDenseNodes(group.dense, opts, items);
                }
                for (let way of group.ways)
                    parseWay(way, opts, items);
                //group.ways.forEach(way => {
                //    parseWay(way, opts, items);
                //});
                //group.relations.forEach(relation => {
                //    parseRelation(relation, opts, items);
                //});
                for (let rel of group.relations)
                    parseRelation(rel, opts, items);
                if (group.nodes && group.nodes.length > 0) {
                    console.warn(group.nodes.length + " unimplemented nodes");
                }
                if (group.changesets && group.changesets.length > 0) {
                    console.warn(group.changesets.length + " unimplemented changesets");
                }
            });

            if (items.length > 0)
                this.push(items);
        }
        callback();
    }
}

function decodeStringtable(bufs) {
    return bufs.map(buf => {
        if (!Buffer.isBuffer(buf))
            throw new Error("PrimitivesParser: no buffer");
        return buf.toString('utf8');
    });
}

function parseDenseNodes(dense, opts, results) {
    let id = 0, lat = 0, lon = 0;
    let timestamp = 0, changeset = 0, uid = 0, user_sid = 0;
    let offset = 0, tagsOffset = 0;
    for (; offset < dense.id.length; offset++) {
        id += dense.id[offset];
        lat += dense.lat[offset];
        lon += dense.lon[offset];
        const dkv = dense.keys_vals;
        const tags = {};
        for (; tagsOffset < dkv.length - 1 && dkv[tagsOffset] !== 0; tagsOffset += 2) {
            let k = opts.stringtable[dkv[tagsOffset]];
            let v = opts.stringtable[dkv[tagsOffset + 1]];
            tags[k] = v;
        }
        // Skip the 0
        tagsOffset += 1;

        const node = {
            type: 'node',
            id: id,
            lat: opts.lat_offset + opts.granularity * lat,
            lon: opts.lon_offset + opts.granularity * lon,
            tags: tags
        };

        let dInfo;
        if ((dInfo = dense.denseinfo)) {
            timestamp += dInfo.timestamp[offset];
            changeset += dInfo.changeset[offset];
            uid += dInfo.uid[offset];
            user_sid += dInfo.user_sid[offset];
            node.info = {
                version: dInfo.version[offset],
                timestamp: opts.date_granularity * timestamp,
                changeset: changeset,
                uid: uid,
                user: opts.stringtable[user_sid]
            };
            if (opts.HistoricalInformation && ('visible' in dInfo)) {
                node.info.visible = dInfo.visible[offset];
            }
        }

        results.push(node);
    }
}

function parseWay(data, opts, results) {
    const tags = {};
    for (let i = 0; i < data.keys.length && i < data.vals.length; i++) {
        const k = opts.stringtable[data.keys[i]];
        const v = opts.stringtable[data.vals[i]];
        tags[k] = v;
    }

    let ref = 0;
    let refs = data.refs.map(ref1 => {
        ref += ref1;
        return ref;
    });

    const way = {
        type: 'way',
        id: data.id,
        tags: tags,
        refs: refs
    };

    if (data.info) {
        way.info = parseInfo(data.info, opts);
    }

    results.push(way);
}

function parseRelation(data, opts, results) {
    const tags = {};
    for (let i = 0; i < data.keys.length && i < data.vals.length; i++) {
        let k = opts.stringtable[data.keys[i]];
        let v = opts.stringtable[data.vals[i]];
        tags[k] = v;
    }

    let id = 0;
    const members = [];
    for (let i = 0; i < data.roles_sid.length && i < data.memids.length && i < data.types.length; i++) {
        id += data.memids[i];
        let typeStr;
        switch (data.types[i]) {
            case 0:
                typeStr = 'node';
                break;
            case 1:
                typeStr = 'way';
                break;
            case 2:
                typeStr = 'relation';
                break;
            default:
                typeStr = '?';
        }

        members.push({
            type: typeStr,
            id: id,
            role: opts.stringtable[data.roles_sid[i]]
        });
    }

    const relation = {
        type: 'relation',
        id: data.id,
        tags: tags,
        members: members
    };
    if (data.info) {
        relation.info = parseInfo(data.info, opts);
    }

    results.push(relation);
}

function parseInfo(dInfo, opts) {
    const info = {
        version: dInfo.version,
        timestamp: opts.date_granularity * dInfo.timestamp,
        changeset: dInfo.changeset,
        uid: dInfo.uid,
        user: opts.stringtable[dInfo.user_sid]
    };
    if (opts.HistoricalInformation && ('visible' in dInfo)) {
        info.visible = dInfo.visible;
    }
    return info;
}

export class BlobEncoder extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 1 });
    }
    /**
     * @param {Buffer} buf
     * @param {string} enc
     * @param {Function} next
     */
    _transform(blob, enc, next) {
        var blobMessage = parsers.file.Blob.encode({
            zlib_data: blob.zlib_data
        });
        var blobHeader = parsers.file.BlobHeader.encode({
            type: blob.type,
            datasize: blobMessage.length
        })
        var sizeBuf = Buffer.alloc(4);
        sizeBuf.writeUInt32BE(blobHeader.length, 0);
        this.push(sizeBuf);
        this.push(blobHeader);
        this.push(blobMessage);

        next();
    }
}

export default function () {
    return obj([
        new BlobParser(),
        new BlobDecompressor(),
        new PrimitivesParser()
    ]);
}
