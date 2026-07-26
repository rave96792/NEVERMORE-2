import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { storeUploadBuffer } from '@/lib/api/uploads'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  try {
    const body = await request.json()
    const layout = body?.layout
    if (!layout || typeof layout !== 'object') {
      return handleCORS(NextResponse.json({ error: 'layout is required' }, { status: 400 }))
    }
    const { renderCompositeServer } = await import('@/lib/builder/serverComposite')
    const origin = new URL(request.url).origin
    const buf = await renderCompositeServer(layout, { origin })
    if (!buf || buf.length < 100) {
      return handleCORS(NextResponse.json({ error: 'Composite render produced empty PNG' }, { status: 500 }))
    }
    const stored = await storeUploadBuffer(buf, 'image/png', { filename: `${uuidv4()}.png` })
    return handleCORS(NextResponse.json(stored))
  } catch (e) {
    console.error('[composite] render failed:', e?.message)
    return handleCORS(NextResponse.json({ error: e?.message || 'Composite render failed', detail: 'server_composite_failed' }, { status: 500 }))
  }
}
