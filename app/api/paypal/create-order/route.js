import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'
import { paypalCreateOrder } from '@/lib/api/paypal'
import { validateCart, computeTotals } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  try {
    const body = await request.json()

    // 1. Server-side cart validation (single source of truth)
    const cartRes = validateCart(body.items)
    if (!cartRes.ok) return handleCORS(NextResponse.json({ error: cartRes.error }, { status: 400 }))

    // 2. Validate shipping / pickup
    const s = body.shipping || {}
    const deliveryMethod = body?.deliveryMethod === 'pickup' ? 'pickup' : 'ship'

    // For BOTH methods we need a real name + email + phone (so we can contact the buyer).
    const alwaysRequired = ['fullName', 'email']
    for (const k of alwaysRequired) {
      if (!s[k] || String(s[k]).trim().length < 2) {
        return handleCORS(NextResponse.json({ error: `Missing/invalid shipping.${k}` }, { status: 400 }))
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
      return handleCORS(NextResponse.json({ error: 'Invalid email' }, { status: 400 }))
    }
    // For SHIP method we ALSO need the full address (line1/city/state/postal/country).
    if (deliveryMethod === 'ship') {
      const shipRequired = ['line1', 'city', 'state', 'postalCode', 'country']
      for (const k of shipRequired) {
        if (!s[k] || String(s[k]).trim().length < 2) {
          return handleCORS(NextResponse.json({ error: `Missing/invalid shipping.${k}` }, { status: 400 }))
        }
      }
    }
    // Pickup is always in Hawaii → apply HI tax even without a shipping address
    const stateForTax = deliveryMethod === 'pickup' ? 'HI' : s.state
    const rush = body?.rush === true
    const totals = computeTotals({ subtotal: cartRes.subtotal, shippingState: stateForTax, shippingCountry: s.country || 'US', deliveryMethod, rush })
    const internalOrderId = uuidv4()

    // 3. Create PayPal order with trusted total
    let paypalOrder
    try {
      paypalOrder = await paypalCreateOrder({
        amount: totals.total.toFixed(2),
        currency: 'USD',
        internalOrderId,
      })
    } catch (e) {
      console.error('PayPal create-order error:', e.message)
      return handleCORS(NextResponse.json({ error: e.message }, { status: 502 }))
    }

    // 4. Persist pending order + monotonic customer-facing order number (starts at 100)
    let orderNumber = null
    try {
      const database = await connectToMongo()
      const cnt = await database.collection('counters').findOneAndUpdate(
        { _id: 'order_number' },
        [{ $set: { seq: { $add: [{ $ifNull: ['$seq', 99] }, 1] } } }],
        { upsert: true, returnDocument: 'after' }
      )
      orderNumber = (cnt.value?.seq) ?? cnt.seq ?? 100
      await database.collection('orders').insertOne({
        id: internalOrderId,
        orderNumber,
        paypalOrderId: paypalOrder.id,
        status: 'PENDING',
        items: cartRes.items,
        subtotal: totals.subtotal,
        shipping_amount: totals.shipping,
        rushFee: totals.rushFee,
        rush: totals.rush,
        tax: totals.tax,
        taxRate: totals.taxRate,
        taxState: totals.taxState,
        total: totals.total,
        currency: 'USD',
        deliveryMethod,
        shipping: {
          fullName: s.fullName, email: s.email, phone: s.phone || null,
          line1: s.line1 || null, line2: s.line2 || null, city: s.city || null, state: s.state || null,
          postalCode: s.postalCode || null, country: s.country || null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (e) {
      console.error('[create-order] mongo insert failed:', e?.message)
      return handleCORS(NextResponse.json({
        error: 'Order database is temporarily unavailable. Please try again in a minute.',
        detail: 'db_unavailable',
      }, { status: 503 }))
    }

    return handleCORS(NextResponse.json({
      orderID: paypalOrder.id,
      internalOrderId,
      orderNumber,
      totals,
    }, { status: 201 }))
  } catch (e) {
    console.error('[create-order] top-level error:', e?.message)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
