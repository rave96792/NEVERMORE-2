import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { SHEETS, ADDONS, CUSTOM_PER_SQIN, CUSTOM_MIN_LENGTH, CUSTOM_MAX_LENGTH } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function GET() {
  return handleCORS(NextResponse.json({
    sheets: Object.values(SHEETS),
    addons: Object.values(ADDONS),
    customPerSqIn: CUSTOM_PER_SQIN,
    customMinLength: CUSTOM_MIN_LENGTH,
    customMaxLength: CUSTOM_MAX_LENGTH,
  }))
}
