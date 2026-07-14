/**
 * Minimal dependency-free ZIP writer/reader.
 * Writing uses STORE (no compression — backups are mostly JPEGs, which
 * don't compress). Reading supports STORE plus DEFLATE via the browser's
 * DecompressionStream, so a backup re-zipped on a computer still restores.
 */

export interface ZipInput {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function createZip(entries: ZipInput[]): Blob {
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const central: BlobPart[] = []
  let offset = 0
  let centralSize = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // DOS timestamp of the export moment (some tools reject an all-zero date).
    const now = new Date()
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
    const dosDate =
      ((Math.max(0, now.getFullYear() - 1980)) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // local file header signature
    local.setUint16(4, 20, true) // version needed
    local.setUint16(8, 0, true) // method: STORE
    local.setUint16(10, dosTime, true)
    local.setUint16(12, dosDate, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true) // compressed size (= raw for STORE)
    local.setUint32(22, size, true) // uncompressed size
    local.setUint16(26, name.length, true)
    parts.push(local.buffer, name as BlobPart, entry.data as BlobPart)

    const cent = new DataView(new ArrayBuffer(46))
    cent.setUint32(0, 0x02014b50, true) // central directory signature
    cent.setUint16(4, 20, true) // version made by
    cent.setUint16(6, 20, true) // version needed
    cent.setUint16(10, 0, true) // method: STORE
    cent.setUint16(12, dosTime, true)
    cent.setUint16(14, dosDate, true)
    cent.setUint32(16, crc, true)
    cent.setUint32(20, size, true)
    cent.setUint32(24, size, true)
    cent.setUint16(28, name.length, true)
    cent.setUint32(42, offset, true) // local header offset
    central.push(cent.buffer, name as BlobPart)
    centralSize += 46 + name.length

    offset += 30 + name.length + size
  }

  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true) // end of central directory signature
  eocd.setUint16(8, entries.length, true)
  eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, centralSize, true)
  eocd.setUint32(16, offset, true) // central directory offset

  return new Blob([...parts, ...central, eocd.buffer], { type: 'application/zip' })
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  // Locate the end-of-central-directory record (scan back past any comment).
  let eocd = -1
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file')

  const count = view.getUint16(eocd + 10, true)
  let pos = view.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()
  const decoder = new TextDecoder()

  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Corrupt ZIP')
    const method = view.getUint16(pos + 10, true)
    const compressedSize = view.getUint32(pos + 20, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const localOffset = view.getUint32(pos + 42, true)
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen))

    // Local header repeats name/extra lengths; data follows it.
    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const raw = bytes.slice(dataStart, dataStart + compressedSize)

    if (method === 0) files.set(name, raw)
    else if (method === 8) files.set(name, await inflateRaw(raw))
    else throw new Error(`Unsupported compression method ${method}`)

    pos += 46 + nameLen + extraLen + commentLen
  }
  return files
}
