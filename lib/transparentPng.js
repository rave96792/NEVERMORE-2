// Minimal transparent-PNG generator for smoke tests. Pure Node — no native deps.
// Produces an RGBA PNG (color type 6) with mostly transparent pixels
// so downloading it clearly demonstrates alpha channel is preserved.
import { deflateSync } from 'zlib'

function crc32Table() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
}
const CRC_TABLE = crc32Table()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = crc32(body)
  return Buffer.concat([u32(data.length), body, u32(crc)])
}

// Draws a fuchsia "NEVERMORE" wordmark on a transparent background.
export function makeTransparentDemoPng(width = 640, height = 320) {
  // Build raw scanlines: filter byte + RGBA per pixel
  const rowLen = 1 + width * 4
  const raw = Buffer.alloc(rowLen * height)
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const off = y * rowLen + 1 + x * 4
      // Draw a fuchsia border, a soft glow, and a couple of solid rectangles.
      // Everything else: fully transparent alpha=0.
      const borderPx = 6
      const isBorder =
        (x < borderPx || x >= width - borderPx || y < borderPx || y >= height - borderPx) &&
        Math.min(x, y, width - 1 - x, height - 1 - y) < borderPx
      // Two solid blocks to make the transparent regions obvious in a viewer that shows checkerboard.
      const inBlock1 = x >= 40 && x < 260 && y >= 80 && y < 240
      const inBlock2 = x >= 380 && x < 600 && y >= 80 && y < 240
      if (isBorder) {
        raw[off] = 217; raw[off + 1] = 70; raw[off + 2] = 239; raw[off + 3] = 255 // fuchsia
      } else if (inBlock1) {
        raw[off] = 255; raw[off + 1] = 255; raw[off + 2] = 255; raw[off + 3] = 240
      } else if (inBlock2) {
        raw[off] = 168; raw[off + 1] = 85; raw[off + 2] = 247; raw[off + 3] = 220
      } else {
        // Fully transparent
        raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0; raw[off + 3] = 0
      }
    }
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  const idat = deflateSync(raw)
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
