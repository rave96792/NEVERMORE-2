import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function GET() {
  return handleCORS(NextResponse.json({ message: 'Nevermore DTF API' }))
}
