import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { UPLOAD_DIR } from '@/lib/api/uploads'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function GET(_request, { params }) {
  const { filename } = await params
  if (!filename || !/^[a-f0-9-]{6,}\.[a-z0-9]{2,5}$/i.test(filename)) {
    return handleCORS(NextResponse.json({ error: 'Bad filename' }, { status: 400 }))
  }
  const filePath = path.join(UPLOAD_DIR, filename)
  try {
    const buf = await fs.readFile(filePath)
    const ext = filename.split('.').pop().toLowerCase()
    const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' })[ext] || 'application/octet-stream'
    return handleCORS(new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(buf.length),
      },
    }))
  } catch {
    return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
}
