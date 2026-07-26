import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'
import { sendStatusEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request, { params }) {
  const { id } = await params
  try {
    const body = await request.json()
    const token = String(body.adminToken || request.headers.get('x-admin-token') || '')
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    const newStatus = String(body.status || '').toUpperCase()
    if (!['PROCESSING', 'SHIPPED'].includes(newStatus)) {
      return handleCORS(NextResponse.json({ error: 'status must be PROCESSING or SHIPPED' }, { status: 400 }))
    }
    const database = await connectToMongo()
    const doc = await database.collection('orders').findOne({ id })
    if (!doc) return handleCORS(NextResponse.json({ error: 'Order not found' }, { status: 404 }))

    const update = { status: newStatus, updatedAt: new Date() }
    if (newStatus === 'SHIPPED') {
      if (body.trackingNumber) update.trackingNumber = String(body.trackingNumber).slice(0, 120)
      if (body.carrier) update.carrier = String(body.carrier).slice(0, 40)
    }
    await database.collection('orders').updateOne({ id }, { $set: update })
    const fresh = { ...doc, ...update }
    const email = await sendStatusEmail(fresh, newStatus, {
      trackingNumber: update.trackingNumber, carrier: update.carrier,
    })
    return handleCORS(NextResponse.json({ ok: true, status: newStatus, email }))
  } catch (e) {
    console.error('[orders/:id/status] error:', e?.message)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
