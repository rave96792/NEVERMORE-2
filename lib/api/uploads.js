import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/data/uploads'
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25MB
export const ALLOWED_MIME = new Set(['image/png'])
export const EXT_BY_MIME = { 'image/png': 'png' }

/** Store a buffer or file as { artworkUrl, filename, size, contentType, storage } */
export async function storeUploadBuffer(buf, contentType, opts = {}) {
  const ext = EXT_BY_MIME[contentType] || 'bin'
  const filename = opts.filename || `${uuidv4()}.${ext}`

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`uploads/${filename}`, buf, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType,
      addRandomSuffix: false,
    })
    return { artworkUrl: blob.url, filename, size: buf.length, contentType, storage: 'blob' }
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buf)
  return { artworkUrl: `/api/uploads/${filename}`, filename, size: buf.length, contentType, storage: 'disk' }
}
