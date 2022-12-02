// This file is auto generated by the protocol-buffers compiler

/* eslint-disable quotes */
/* eslint-disable indent */
/* eslint-disable no-redeclare */
/* eslint-disable camelcase */

// Remember to `npm install --save protocol-buffers-encodings`
var encodings = require('protocol-buffers-encodings')
var varint = encodings.varint
var skip = encodings.skip

var Blob = exports.Blob = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var BlobHeader = exports.BlobHeader = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

defineBlob()
defineBlobHeader()

function defineBlob () {
  Blob.encodingLength = encodingLength
  Blob.encode = encode
  Blob.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (defined(obj.raw)) {
      var len = encodings.bytes.encodingLength(obj.raw)
      length += 1 + len
    }
    if (defined(obj.raw_size)) {
      var len = encodings.int32.encodingLength(obj.raw_size)
      length += 1 + len
    }
    if (defined(obj.zlib_data)) {
      var len = encodings.bytes.encodingLength(obj.zlib_data)
      length += 1 + len
    }
    if (defined(obj.lzma_data)) {
      var len = encodings.bytes.encodingLength(obj.lzma_data)
      length += 1 + len
    }
    if (defined(obj.OBSOLETE_bzip2_data)) {
      var len = encodings.bytes.encodingLength(obj.OBSOLETE_bzip2_data)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (defined(obj.raw)) {
      buf[offset++] = 10
      encodings.bytes.encode(obj.raw, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.raw_size)) {
      buf[offset++] = 16
      encodings.int32.encode(obj.raw_size, buf, offset)
      offset += encodings.int32.encode.bytes
    }
    if (defined(obj.zlib_data)) {
      buf[offset++] = 26
      encodings.bytes.encode(obj.zlib_data, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.lzma_data)) {
      buf[offset++] = 34
      encodings.bytes.encode(obj.lzma_data, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.OBSOLETE_bzip2_data)) {
      buf[offset++] = 42
      encodings.bytes.encode(obj.OBSOLETE_bzip2_data, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      raw: null,
      raw_size: 0,
      zlib_data: null,
      lzma_data: null,
      OBSOLETE_bzip2_data: null
    }
    while (true) {
      if (end <= offset) {
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.raw = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 2:
        obj.raw_size = encodings.int32.decode(buf, offset)
        offset += encodings.int32.decode.bytes
        break
        case 3:
        obj.zlib_data = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 4:
        obj.lzma_data = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 5:
        obj.OBSOLETE_bzip2_data = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineBlobHeader () {
  BlobHeader.encodingLength = encodingLength
  BlobHeader.encode = encode
  BlobHeader.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.type)) throw new Error("type is required")
    var len = encodings.string.encodingLength(obj.type)
    length += 1 + len
    if (defined(obj.indexdata)) {
      var len = encodings.bytes.encodingLength(obj.indexdata)
      length += 1 + len
    }
    if (!defined(obj.datasize)) throw new Error("datasize is required")
    var len = encodings.int32.encodingLength(obj.datasize)
    length += 1 + len
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.type)) throw new Error("type is required")
    buf[offset++] = 10
    encodings.string.encode(obj.type, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.indexdata)) {
      buf[offset++] = 18
      encodings.bytes.encode(obj.indexdata, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (!defined(obj.datasize)) throw new Error("datasize is required")
    buf[offset++] = 24
    encodings.int32.encode(obj.datasize, buf, offset)
    offset += encodings.int32.encode.bytes
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      type: "",
      indexdata: null,
      datasize: 0
    }
    var found0 = false
    var found2 = false
    while (true) {
      if (end <= offset) {
        if (!found0 || !found2) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.type = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.indexdata = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 3:
        obj.datasize = encodings.int32.decode(buf, offset)
        offset += encodings.int32.decode.bytes
        found2 = true
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defined (val) {
  return val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))
}
