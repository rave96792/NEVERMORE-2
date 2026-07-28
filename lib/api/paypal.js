// Public client_id fallback — PayPal client IDs are public by design (they're embedded
// in every checkout page). Safe to commit. Prefer env if set (allows sandbox/test overrides).
// The SECRET must remain in Vercel env vars — never commit it.
const LIVE_CLIENT_ID_FALLBACK = 'BAApcJIfSxLNqdvkKm0KwdR8KV7IKZyeL4NNz0J4XJxZvf5XMhLo0PfWcNWyC9A_8XOnuoZKsYPJOeOCnE'

const hasClientIdEnv = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_ID.trim())
export const PAYPAL_CLIENT_ID = hasClientIdEnv ? process.env.PAYPAL_CLIENT_ID : LIVE_CLIENT_ID_FALLBACK

// Choose base URL:
//   - If we're using the hard-coded LIVE fallback (i.e. no client_id env var), FORCE live base
//     (using a live client_id against sandbox always 401s).
//   - Otherwise honor PAYPAL_ENV. Default to live when unspecified.
//   - Explicit opt-in for sandbox via PAYPAL_ENV=sandbox|test|dev|development (case-insensitive).
const envRaw = String(process.env.PAYPAL_ENV || '').trim().toLowerCase()
const isSandbox = hasClientIdEnv && (envRaw === 'sandbox' || envRaw === 'test' || envRaw === 'dev' || envRaw === 'development')
export const PAYPAL_BASE = isSandbox
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com'

export async function paypalToken() {
  const id = process.env.PAYPAL_CLIENT_ID || LIVE_CLIENT_ID_FALLBACK
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
