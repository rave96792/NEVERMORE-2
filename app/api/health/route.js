import { NextResponse } from 'next/server'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'
import { paypalToken, PAYPAL_BASE } from '@/lib/api/paypal'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

// Redact a secret to first-4 + last-4 chars so we can visually confirm which
// credentials Vercel injected, without exposing the full value in logs.
function redact(s) {
  if (!s || typeof s !== 'string') return null
  if (s.length < 12) return '(too short)'
  return `${s.slice(0, 4)}…${s.slice(-4)} (len ${s.length})`
}

export async function GET() {
  const out = { ok: true, checks: {} }

  try {
    const db = await connectToMongo()
    await db.command({ ping: 1 })
    out.checks.mongo = { ok: true }
  } catch (e) {
    out.ok = false
    out.checks.mongo = { ok: false, error: (e && e.message) || String(e) }
  }

  try {
    const t = await paypalToken()
    out.checks.paypal = { ok: !!t, base: PAYPAL_BASE }
  } catch (e) {
    out.ok = false
    out.checks.paypal = { ok: false, base: PAYPAL_BASE, error: (e && e.message) || String(e) }
  }

  out.checks.env = {
    MONGO_URL: !!process.env.MONGO_URL,
    DB_NAME: !!process.env.DB_NAME,
    PAYPAL_CLIENT_ID: !!process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_ID_preview: redact(process.env.PAYPAL_CLIENT_ID),
    NEXT_PUBLIC_PAYPAL_CLIENT_ID_preview: redact(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID),
    PAYPAL_CLIENT_SECRET: !!process.env.PAYPAL_CLIENT_SECRET,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || null,
    PAYPAL_ENV: process.env.PAYPAL_ENV || null,
    ADMIN_TOKEN_set: !!process.env.ADMIN_TOKEN,
  }
  return handleCORS(NextResponse.json(out, { status: out.ok ? 200 : 503 }))
}
