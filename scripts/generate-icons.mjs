// Generates the PWA PNG icons (192, 512, 512-maskable) without any image
// dependencies: pixels are drawn into an RGBA buffer and encoded as PNG by
// hand (zlib deflate + chunk CRCs are all Node built-ins provide).
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BLUE = [0x39, 0x87, 0xe5, 255]
const WHITE = [255, 255, 255, 255]
const RED = [0xd0, 0x3b, 0x3b, 255]
const CLEAR = [0, 0, 0, 0]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // Raw scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function drawIcon(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4)
  const put = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }

  const radius = maskable ? 0 : size * 0.2
  const inRoundedSquare = (x, y) => {
    if (maskable) return true
    const r = radius
    const cx = x < r ? r : x >= size - r ? size - r - 1 : x
    const cy = y < r ? r : y >= size - r ? size - r - 1 : y
    if (cx === x && cy === y) return true
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= r * r
  }

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) put(x, y, inRoundedSquare(x, y) ? BLUE : CLEAR)

  // Barcode bars (fractions of the 512 design grid). Maskable icons shrink
  // the glyph into the 80% safe zone.
  const s = maskable ? 0.78 : 1
  const off = (1 - s) / 2
  const map = (v) => Math.round((off + (v / 512) * s) * size)
  const bars = [
    [128, 22],
    [170, 12],
    [202, 30],
    [252, 12],
    [284, 22],
    [326, 12],
    [358, 26],
  ]
  for (const [bx, bw] of bars) {
    for (let y = map(166); y < map(346); y++)
      for (let x = map(bx); x < map(bx + bw); x++) put(x, y, WHITE)
  }
  // Scan line
  for (let y = map(248); y < map(262); y++)
    for (let x = map(96); x < map(416); x++) put(x, y, RED)

  return encodePng(size, px)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192, { maskable: false }))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512, { maskable: false }))
writeFileSync(join(outDir, 'icon-512-maskable.png'), drawIcon(512, { maskable: true }))
console.log('Icons written to', outDir)
