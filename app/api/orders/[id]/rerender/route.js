import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { renderOrder } from '@/lib/builder/renderOrder'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function OPTIONS() { return optionsResponse() }

// POST /api/orders/[id]/rerender
// Admin-token-protected. Safe to call repeatedly (idempotent):
//   - If renderStatus is already 'succeeded' and body.force !== true, returns early.
//   - Otherwise re-renders every item with a captured layout.
export async function POST(request, { params }) {
  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}))
    const token = String(body.adminToken || request.headers.get('x-admin-token') || '')
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const force = body.force === true
    const origin = new URL(request.url).origin
    const result = await renderOrder(id, { origin, force })
    if (!result || result.error === 'Order not found') {
      return handleCORS(NextResponse.json({ error: 'Order not found' }, { status: 404 }))
    }
    return handleCORS(NextResponse.json({
      ok: result.ok,
      status: result.status || (result.ok ? 'succeeded' : 'failed'),
      renderedCount: result.renderedCount,
      totalItems: result.totalItems,
      attempt: result.attempt,
      alreadySucceeded: result.alreadySucceeded || false,
      error: result.error,
    }))
  } catch (e) {
    console.error('[rerender] error:', e?.message)
    return handleCORS(NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 }))
  }
}
