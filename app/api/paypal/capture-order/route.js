import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'
import { paypalCaptureOrder } from '@/lib/api/paypal'
import { sendOrderEmails } from '@/lib/email'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  try {
    const body = await request.json()
    const paypalOrderId = String(body.orderID || '').trim()
    if (!paypalOrderId) return handleCORS(NextResponse.json({ error: 'Missing orderID' }, { status: 400 }))

    const database = await connectToMongo()
    const orderDoc = await database.collection('orders').findOne({ paypalOrderId })
    if (!orderDoc) return handleCORS(NextResponse.json({ error: 'Order not found' }, { status: 404 }))

    let capture
    try {
      capture = await paypalCaptureOrder(paypalOrderId)
    } catch (e) {
      console.error('PayPal capture error:', e.message)
      await database.collection('orders').updateOne(
        { paypalOrderId },
        { $set: { status: 'FAILED', error: e.message, updatedAt: new Date() } }
      )
      return handleCORS(NextResponse.json({ error: e.message }, { status: 502 }))
    }

    await database.collection('orders').updateOne(
      { paypalOrderId },
      { $set: {
        status: capture.status === 'COMPLETED' ? 'PAID' : capture.status,
        captureId: capture.captureId,
        paypalStatus: capture.status,
        capturedAt: new Date(),
        updatedAt: new Date(),
      }}
    )

    // Fire order emails (non-fatal — never block the checkout response on email)
    try {
      const fresh = await database.collection('orders').findOne({ paypalOrderId })
      if (fresh) {
        const { _id, ...clean } = fresh
        sendOrderEmails(clean).catch((e) => console.error('[email] send failed:', e?.message))
      }
    } catch (e) {
      console.error('[email] lookup failed:', e?.message)
    }

    return handleCORS(NextResponse.json({
      orderID: paypalOrderId,
      internalOrderId: orderDoc.id,
      captureId: capture.captureId,
      status: capture.status,
    }))
  } catch (e) {
    console.error('[capture-order] top-level error:', e?.message)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
