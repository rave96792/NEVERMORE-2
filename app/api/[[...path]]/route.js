import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { promises as fs, createReadStream } from 'fs'
import path from 'path'
import { SHEETS, ADDONS, CUSTOM_PER_SQIN, CUSTOM_MIN_LENGTH, CUSTOM_MAX_LENGTH, computeUnitPrice, validateCart, computeTotals } from '@/lib/pricing'
import { sendOrderEmails } from '@/lib/email'

export const runtime = 'nodejs'

// Use absolute path — process.cwd() can be unreliable when Next.js module-loads this file
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/data/uploads'
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }

let client
let db
async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// ============ PayPal helpers (server-only, secret never leaves here) ============
const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

async function paypalToken() {
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

async function paypalCreateOrder({ amount, currency = 'USD', internalOrderId }) {
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

async function paypalCaptureOrder(paypalOrderId) {
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

// ============ Route handler ============
async function handleRoute(request, { params }) {
  const resolved = await params
  const pathSegments = resolved?.path || []
  const route = `/${pathSegments.join('/')}`
  const method = request.method

  try {
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'Nevermore DTF API' }))
    }

    if (route === '/pricing' && method === 'GET') {
      return handleCORS(NextResponse.json({
        sheets: Object.values(SHEETS),
        addons: Object.values(ADDONS),
        customPerSqIn: CUSTOM_PER_SQIN,
        customMinLength: CUSTOM_MIN_LENGTH,
        customMaxLength: CUSTOM_MAX_LENGTH,
      }))
    }

    if (route === '/pricing/quote' && method === 'POST') {
      const body = await request.json()
      try {
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

    if (route === '/cart/validate' && method === 'POST') {
      const body = await request.json()
      const result = validateCart(body.items)
      if (!result.ok) return handleCORS(NextResponse.json({ error: result.error }, { status: 400 }))
      const shippingState = body?.shipping?.state
      const totals = computeTotals({ subtotal: result.subtotal, shippingState })
      return handleCORS(NextResponse.json({ ...result, ...totals }))
    }

    // ============ PayPal ============
    if (route === '/paypal/create-order' && method === 'POST') {
      const body = await request.json()
      // 1. Validate cart server-side (single source of truth)
      const cartRes = validateCart(body.items)
      if (!cartRes.ok) return handleCORS(NextResponse.json({ error: cartRes.error }, { status: 400 }))
      // 2. Validate shipping
      const s = body.shipping || {}
      const required = ['fullName', 'email', 'line1', 'city', 'state', 'postalCode', 'country']
      for (const k of required) {
        if (!s[k] || String(s[k]).trim().length < 2) {
          return handleCORS(NextResponse.json({ error: `Missing/invalid shipping.${k}` }, { status: 400 }))
        }
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
        return handleCORS(NextResponse.json({ error: 'Invalid email' }, { status: 400 }))
      }
      const totals = computeTotals({ subtotal: cartRes.subtotal, shippingState: s.state })
      const internalOrderId = uuidv4()

      // 3. Create PayPal order with the trusted total
      let paypalOrder
      try {
        paypalOrder = await paypalCreateOrder({
          amount: totals.total.toFixed(2),
          currency: 'USD',
          internalOrderId,
        })
      } catch (e) {
        console.error('PayPal create-order error:', e.message)
        return handleCORS(NextResponse.json({ error: e.message }, { status: 502 }))
      }

      // 4. Persist a pending order
      const database = await connectToMongo()
      await database.collection('orders').insertOne({
        id: internalOrderId,
        paypalOrderId: paypalOrder.id,
        status: 'PENDING',
        items: cartRes.items,
        subtotal: totals.subtotal,
        shipping_amount: totals.shipping,
        tax: totals.tax,
        taxRate: totals.taxRate,
        taxState: totals.taxState,
        total: totals.total,
        currency: 'USD',
        shipping: {
          fullName: s.fullName, email: s.email, phone: s.phone || null,
          line1: s.line1, line2: s.line2 || null, city: s.city, state: s.state,
          postalCode: s.postalCode, country: s.country,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      return handleCORS(NextResponse.json({
        orderID: paypalOrder.id,
        internalOrderId,
        totals,
      }, { status: 201 }))
    }

    if (route === '/paypal/capture-order' && method === 'POST') {
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
    }

    // POST /api/contact — contact form submissions from /contact
    if (route === '/contact' && method === 'POST') {
      const body = await request.json()
      const name = String(body.name || '').trim().slice(0, 120)
      const email = String(body.email || '').trim().slice(0, 200)
      const phone = String(body.phone || '').trim().slice(0, 60)
      const subject = String(body.subject || '').trim().slice(0, 200) || 'Contact form message'
      const message = String(body.message || '').trim().slice(0, 5000)
      if (name.length < 2) return handleCORS(NextResponse.json({ error: 'Name required' }, { status: 400 }))
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return handleCORS(NextResponse.json({ error: 'Valid email required' }, { status: 400 }))
      if (message.length < 10) return handleCORS(NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 }))

      // Persist to Mongo
      try {
        const database = await connectToMongo()
        await database.collection('contact_messages').insertOne({
          id: uuidv4(),
          name, email, phone: phone || null, subject, message,
          createdAt: new Date(),
        })
      } catch (e) {
        console.error('[contact] mongo insert failed:', e?.message)
      }

      // Fire email via Resend (non-fatal)
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)
          const from = process.env.MAIL_FROM || 'onboarding@resend.dev'
          const to = process.env.MAIL_SHOP_TO
          const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#eee;padding:24px">
            <div style="max-width:640px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#d946ef,#7c3aed);border-radius:12px;padding:20px;color:#fff">
                <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.85">Nevermore DTF</div>
                <div style="font-size:22px;font-weight:800;margin-top:4px">New contact form message</div>
                <div style="opacity:0.85;margin-top:6px">${esc(subject)}</div>
              </div>
              <div style="background:#fff;color:#111;border-radius:12px;margin-top:16px;padding:20px">
                <table style="width:100%;font-size:14px"><tbody>
                  <tr><td style="padding:6px 0;color:#666;width:100px">Name</td><td style="padding:6px 0;color:#111;font-weight:600">${esc(name)}</td></tr>
                  <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0;color:#111"><a href="mailto:${esc(email)}" style="color:#7c3aed">${esc(email)}</a></td></tr>
                  ${phone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0;color:#111">${esc(phone)}</td></tr>` : ''}
                </tbody></table>
                <div style="margin-top:14px;border-top:1px solid #eee;padding-top:14px">
                  <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#666;margin-bottom:6px">Message</div>
                  <div style="white-space:pre-wrap;color:#111;line-height:1.5">${esc(message)}</div>
                </div>
              </div>
            </div>
          </body></html>`
          if (to) {
            await resend.emails.send({
              from,
              to,
              replyTo: email, // hitting Reply in your inbox writes back to the sender
              subject: `CONTACT · ${subject} · from ${name}`,
              html,
            })
          }
        } catch (e) {
          console.error('[contact] email send failed:', e?.message)
        }
      }

      return handleCORS(NextResponse.json({ ok: true }))
    }
    // Generates a REAL transparent PNG on disk so the download link demonstrates alpha channel.
    // POST /api/email/test
    if (route === '/email/test' && method === 'POST') {
      const { makeTransparentDemoPng } = await import('@/lib/transparentPng')
      const png = makeTransparentDemoPng(640, 320)
      const filename = `${uuidv4()}.png`
      let compositeUrl
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        const blob = await put(`uploads/${filename}`, png, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
          contentType: 'image/png',
          addRandomSuffix: false,
        })
        compositeUrl = blob.url
      } else {
        await fs.mkdir(UPLOAD_DIR, { recursive: true })
        const dest = path.join(UPLOAD_DIR, filename)
        await fs.writeFile(dest, png)
        compositeUrl = `/api/uploads/${filename}`
      }

      const sample = {
        id: 'test-' + Date.now(),
        paypalOrderId: 'PAYPAL-TEST-XXXX',
        captureId: 'CAPTURE-TEST-YYYY',
        status: 'PAID',
        items: [{
          id: 'i1',
          sheetId: '14x24',
          sheetLabel: '14" × 24"',
          quantity: 2,
          unitPrice: 13,
          artworkName: 'sample gang sheet (transparent PNG demo)',
          artworkUrl: compositeUrl,
          compositeUrl,
          layout: { items: [{}, {}, {}] },
        }],
        subtotal: 26, shipping_amount: 0, tax: 1.23, taxRate: 0.04712, taxState: 'HI', total: 27.23,
        shipping: {
          fullName: 'Nevermore Test Buyer',
          email: process.env.MAIL_SHOP_TO || 'test@example.com',
          line1: '123 Test Ave', line2: null, city: 'Honolulu', state: 'HI', postalCode: '96815', country: 'US',
        },
      }
      const out = await sendOrderEmails(sample)
      return handleCORS(NextResponse.json({ ...out, sampleCompositeUrl: compositeUrl }))
    }

    // Public order lookup (for confirmation page)
    if (route.startsWith('/orders/') && method === 'GET') {
      const id = route.split('/')[2]
      if (!id) return handleCORS(NextResponse.json({ error: 'Missing id' }, { status: 400 }))
      const database = await connectToMongo()
      const doc = await database.collection('orders').findOne({ id })
      if (!doc) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const { _id, ...clean } = doc
      return handleCORS(NextResponse.json(clean))
    }

    // ============ Uploads (Vercel Blob when token set, else persistent disk) ============
    // POST /api/uploads   → save file, return { artworkUrl, filename, size, contentType }
    if (route === '/uploads' && method === 'POST') {
      const ct = request.headers.get('content-type') || ''
      if (!ct.includes('multipart/form-data')) {
        return handleCORS(NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }))
      }
      try {
        const form = await request.formData()
        const file = form.get('file')
        if (!file || typeof file === 'string' || !(file instanceof File)) {
          return handleCORS(NextResponse.json({ error: 'file field is required' }, { status: 400 }))
        }
        if (!ALLOWED_MIME.has(file.type)) {
          return handleCORS(NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 }))
        }
        if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
          return handleCORS(NextResponse.json({ error: `File must be 1 byte – ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` }, { status: 413 }))
        }
        const ext = EXT_BY_MIME[file.type] || 'bin'
        const filename = `${uuidv4()}.${ext}`

        // Prefer Vercel Blob when running on serverless (Vercel).
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { put } = await import('@vercel/blob')
          const blob = await put(`uploads/${filename}`, file, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
            contentType: file.type,
            addRandomSuffix: false,
          })
          return handleCORS(NextResponse.json({
            artworkUrl: blob.url, // absolute https URL served by Vercel Blob CDN
            filename,
            originalName: (file.name || filename).slice(0, 120),
            size: file.size,
            contentType: file.type,
            storage: 'blob',
          }))
        }

        // Local dev / persistent-disk fallback
        await fs.mkdir(UPLOAD_DIR, { recursive: true })
        const dest = path.join(UPLOAD_DIR, filename)
        const buf = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(dest, buf)
        return handleCORS(NextResponse.json({
          artworkUrl: `/api/uploads/${filename}`,
          filename,
          originalName: (file.name || filename).slice(0, 120),
          size: file.size,
          contentType: file.type,
          storage: 'disk',
        }))
      } catch (e) {
        console.error('Upload error:', e)
        return handleCORS(NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 }))
      }
    }

    // GET /api/uploads/:filename → stream file back
    if (route.startsWith('/uploads/') && method === 'GET') {
      const filename = route.split('/')[2]
      if (!filename || !/^[a-f0-9-]{6,}\.[a-z0-9]{2,5}$/i.test(filename)) {
        return handleCORS(NextResponse.json({ error: 'Bad filename' }, { status: 400 }))
      }
      const filePath = path.join(UPLOAD_DIR, filename)
      try {
        const buf = await fs.readFile(filePath)
        const ext = filename.split('.').pop().toLowerCase()
        const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' })[ext] || 'application/octet-stream'
        return handleCORS(new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Length': String(buf.length),
          },
        }))
      } catch {
        return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      }
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
