import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { storeUploadBuffer, ALLOWED_MIME, MAX_UPLOAD_BYTES } from '@/lib/api/uploads'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  const ct = request.headers.get('content-type') || ''
  if (!ct.includes('multipart/form-data')) {
    return handleCORS(NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }))
  }
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string' || !(file instanceof File)) {
      return handleCORS(NextResponse.json({ error: 'file field is required' }, { status: 400 }))
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return handleCORS(NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 }))
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return handleCORS(NextResponse.json({ error: `File must be 1 byte – ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` }, { status: 413 }))
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const stored = await storeUploadBuffer(buf, file.type)
    return handleCORS(NextResponse.json({
      ...stored,
      originalName: (file.name || stored.filename).slice(0, 120),
    }))
  } catch (e) {
    console.error('Upload error:', e)
    return handleCORS(NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 }))
  }
}
