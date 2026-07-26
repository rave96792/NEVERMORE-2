import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function GET(_request, { params }) {
  const { id } = await params
  if (!id) return handleCORS(NextResponse.json({ error: 'Missing id' }, { status: 400 }))
  try {
    const database = await connectToMongo()
    const doc = await database.collection('orders').findOne({ id })
    if (!doc) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { _id, ...clean } = doc
    return handleCORS(NextResponse.json(clean))
  } catch (e) {
    console.error('[orders/:id] error:', e?.message)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
