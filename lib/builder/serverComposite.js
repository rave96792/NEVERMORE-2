// Server-only. Do NOT import from client components.
// Renders a DTF gang-sheet composite (transparent PNG, 300 DPI) using sharp.
// Input: a Layout-like object where each item has { artworkUrl, xIn, yIn, widthIn, heightIn, rotationDeg?, zIndex? }
// Output: PNG Buffer (RGBA, colorType 6).

import sharp from 'sharp'

const EXPORT_PPI = 300
const MAX_SHEET_WIDTH_IN = 14
const MAX_SHEET_LENGTH_IN = 120

// Known sheet catalog — must mirror lib/builder/constants.ts and lib/pricing.js
const SHEETS = {
  '14x12':  { widthIn: 14, lengthIn: 12 },
  '14x24':  { widthIn: 14, lengthIn: 24 },
  '14x36':  { widthIn: 14, lengthIn: 36 },
  '14x48':  { widthIn: 14, lengthIn: 48 },
  '14x60':  { widthIn: 14, lengthIn: 60 },
  '14x72':  { widthIn: 14, lengthIn: 72 },
  '14x84':  { widthIn: 14, lengthIn: 84 },
  '14x96':  { widthIn: 14, lengthIn: 96 },
  '14x120': { widthIn: 14, lengthIn: 120 },
}

/**
 * Fetch an image URL as a Buffer. Accepts absolute https URLs (Vercel Blob) or
 * relative paths that we resolve against the current server's origin.
 */
async function fetchImage(url, { origin } = {}) {
  let full = url
  if (!/^https?:\/\//.test(url)) {
    if (!origin) throw new Error('Cannot resolve relative artwork URL without origin')
    full = origin.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url)
  }
  const r = await fetch(full, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Fetch ${full} failed: HTTP ${r.status}`)
  const ab = await r.arrayBuffer()
  return Buffer.from(ab)
}

/**
 * Render the composite PNG for a given layout.
 * `origin` is the base URL for resolving relative /api/uploads/... paths.
 */
export async function renderCompositeServer(layout, { origin } = {}) {
  const sheet = SHEETS[layout?.sheetSizeId]
  if (!sheet) throw new Error(`Unknown sheet size: ${layout?.sheetSizeId}`)
  const items = Array.isArray(layout.items) ? layout.items : []
  const sheetWpx = Math.round(sheet.widthIn * EXPORT_PPI)
  const sheetHpx = Math.round(sheet.lengthIn * EXPORT_PPI)

  // Guard rails
  if (sheet.widthIn > MAX_SHEET_WIDTH_IN + 1e-6 || sheet.lengthIn > MAX_SHEET_LENGTH_IN + 1e-6) {
    throw new Error('Sheet size out of range')
  }
  if (items.length > 200) throw new Error('Too many items on sheet')

  // Sort by zIndex ascending (draw back-to-front)
  const sorted = [...items].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  // Fetch + resize + rotate each item into a small PNG buffer, then composite.
  const overlays = []
  for (const it of sorted) {
    const wPx = Math.max(1, Math.round(it.widthIn * EXPORT_PPI))
    const hPx = Math.max(1, Math.round(it.heightIn * EXPORT_PPI))
    const rot = ((it.rotationDeg ?? 0) % 360 + 360) % 360

    let buf
    try {
      buf = await fetchImage(it.artworkUrl, { origin })
    } catch (e) {
      console.warn('[composite] skip item — fetch failed:', it.artworkUrl, e?.message)
      continue
    }

    // 1. Resize (fit inside the target box, preserve aspect via 'contain' — but user's
    //    natural width/height already carries the intended aspect). We use 'fill' since
    //    the builder already committed to that width/height in inches.
    let img = sharp(buf, { failOn: 'none' })
      .ensureAlpha()
      .resize({ width: wPx, height: hPx, fit: 'fill' })

    if (rot !== 0) {
      // sharp.rotate expands the canvas to fit rotated result and pads with transparent
      img = img.rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    }

    const outBuf = await img.png().toBuffer({ resolveWithObject: true })
    // After rotation, the buffer's width/height may be > wPx/hPx. Anchor by CENTER on the sheet.
    const cxPx = Math.round((it.xIn + it.widthIn / 2) * EXPORT_PPI)
    const cyPx = Math.round((it.yIn + it.heightIn / 2) * EXPORT_PPI)
    const left = Math.round(cxPx - outBuf.info.width / 2)
    const top  = Math.round(cyPx - outBuf.info.height / 2)
    overlays.push({ input: outBuf.data, left, top })
  }

  const base = sharp({
    create: {
      width: sheetWpx,
      height: sheetHpx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const composed = base
    .composite(overlays)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
  return composed.toBuffer()
}
