import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'
import { paypalCaptureOrder } from '@/lib/api/paypal'
import { sendOrderEmails } from '@/lib/email'
import { renderOrder } from '@/lib/builder/renderOrder'

export const runtime = 'nodejs'
export const maxDuration = 60 // Vercel serverless timeout — allow sharp room to finish

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

    // ⚑ COMMIT PAYMENT SUCCESS FIRST — this is the point of no return for the order.
    // If everything below throws, the order stays PAID and we just have to re-render later.
    await database.collection('orders').updateOne(
      { paypalOrderId },
      { $set: {
        status: capture.status === 'COMPLETED' ? 'PAID' : capture.status,
        captureId: capture.captureId,
        paypalStatus: capture.status,
        capturedAt: new Date(),
        updatedAt: new Date(),
        renderStatus: 'pending', // sharp will attempt below
      }}
    )

    // 🔨 Sharp authoritative print-file render — inline but wrapped in try/catch so
    // ANY failure below still returns success to PayPal (order is already PAID).
    let renderResult = { ok: false }
    try {
      const origin = new URL(request.url).origin
      renderResult = await renderOrder(orderDoc.id, { origin })
    } catch (e) {
      console.error('[capture-order] sharp render failed but payment is safe:', e?.message)
      try {
        await database.collection('orders').updateOne(
          { id: orderDoc.id },
          { $set: { renderStatus: 'failed', renderError: e?.message || 'render exception', updatedAt: new Date() } }
        )
      } catch {}
    }

    // 📧 Fire order emails from the FRESHEST order doc (post-render). Never fatal.
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
      render: {
        status: renderResult?.status || (renderResult?.ok ? 'succeeded' : 'failed'),
        rendered: renderResult?.renderedCount || 0,
        totalItems: renderResult?.totalItems || 0,
        attempt: renderResult?.attempt || 0,
      },
    }))
  } catch (e) {
    console.error('[capture-order] top-level error:', e?.message)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
