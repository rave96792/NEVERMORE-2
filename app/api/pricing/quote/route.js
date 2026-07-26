import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { computeUnitPrice } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  try {
    const body = await request.json()
    const unitPrice = computeUnitPrice({
      sheetId: body.sheetId,
      customLength: body.customLength,
      addons: Array.isArray(body.addons) ? body.addons : [],
    })
    return handleCORS(NextResponse.json({ unitPrice }))
  } catch (e) {
    return handleCORS(NextResponse.json({ error: e.message }, { status: 400 }))
  }
}
