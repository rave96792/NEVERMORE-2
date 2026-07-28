// Default to LIVE PayPal. Explicitly opt into sandbox by setting PAYPAL_ENV=sandbox.
// Accept "live", "LIVE", "production", "prod" (case-insensitive) as go-live.
const envRaw = String(process.env.PAYPAL_ENV || '').trim().toLowerCase()
const isSandbox = envRaw === 'sandbox' || envRaw === 'test' || envRaw === 'dev' || envRaw === 'development'
export const PAYPAL_BASE = isSandbox
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com'

export async function paypalToken() {
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) throw new Error('Missing PayPal credentials')
  const auth = Buffer.from(`${id}:${secret}`).toString('base64')
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error_description || 'PayPal auth failed')
  return j.access_token
}

export async function paypalCreateOrder({ amount, currency = 'USD', internalOrderId }) {
  const token = await paypalToken()
  const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': internalOrderId,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: internalOrderId,
        amount: { currency_code: currency, value: amount },
      }],
      application_context: {
        brand_name: 'Nevermore DTF',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.message || 'PayPal create-order failed')
  return j
}

export async function paypalCaptureOrder(paypalOrderId) {
  const token = await paypalToken()
  const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `cap_${paypalOrderId}`,
      Prefer: 'return=representation',
    },
    body: '{}',
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.message || j?.details?.[0]?.description || 'PayPal capture failed')
  const cap = j?.purchase_units?.[0]?.payments?.captures?.[0]
  return { paypalOrderId: j.id, captureId: cap?.id || null, status: j.status, raw: j }
}
