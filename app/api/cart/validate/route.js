import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { validateCart, computeTotals } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  try {
    const body = await request.json()
    const result = validateCart(body.items)
    if (!result.ok) return handleCORS(NextResponse.json({ error: result.error }, { status: 400 }))
    const totals = computeTotals({
      subtotal: result.subtotal,
      shippingState: body?.shipping?.state,
      shippingCountry: body?.shipping?.country,
      deliveryMethod: body?.deliveryMethod,
    })
    return handleCORS(NextResponse.json({ ...result, ...totals }))
  } catch (e) {
    return handleCORS(NextResponse.json({ error: e.message || 'Bad request' }, { status: 400 }))
  }
}
