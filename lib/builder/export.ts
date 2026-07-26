'use client'

import { EXPORT_PPI } from './constants'
import type { ArtworkItem, Layout } from './types'
import { SHEETS } from './constants'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Renders the composite at EXPORT_PPI (300 DPI) onto an off-screen canvas.
// The output is transparent-background PNG suitable for DTF print.
export async function renderComposite(layout: Layout): Promise<Blob> {
  const sheet = SHEETS[layout.sheetSizeId]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sheet.widthIn * EXPORT_PPI)
  canvas.height = Math.round(sheet.lengthIn * EXPORT_PPI)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Transparent background for DTF workflow.
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const sorted = [...layout.items].sort((a, b) => a.zIndex - b.zIndex)
  for (const item of sorted) {
    const img = await loadImage(item.artworkUrl)
    const wPx = item.widthIn * EXPORT_PPI
    const hPx = item.heightIn * EXPORT_PPI
    const cx = (item.xIn + item.widthIn / 2) * EXPORT_PPI
    const cy = (item.yIn + item.heightIn / 2) * EXPORT_PPI

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((item.rotationDeg * Math.PI) / 180)
    ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx)
    ctx.restore()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

export async function exportAndUpload(layout: Layout): Promise<string> {
  const blob = await renderComposite(layout)
  const fd = new FormData()
  fd.append('file', new File([blob], 'gang-sheet-composite.png', { type: 'image/png' }))
  const r = await fetch('/api/uploads', { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Upload failed')
  const j = await r.json()
  return j.artworkUrl as string
}

/**
 * Ask the server to render the composite with sharp. Returns the artwork URL.
 * Throws on non-2xx so the caller can fall back to the client canvas renderer.
 */
export async function exportAndUploadServer(layout: Layout): Promise<string> {
  const r = await fetch('/api/composite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout }),
  })
  if (!r.ok) {
    let msg = 'Server composite render failed'
    try { const j = await r.json(); msg = j?.error || msg } catch {}
    throw new Error(msg)
  }
  const j = await r.json()
  if (!j?.artworkUrl) throw new Error('Server composite returned no artworkUrl')
  return j.artworkUrl as string
}
