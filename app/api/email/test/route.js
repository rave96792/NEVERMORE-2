import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { storeUploadBuffer } from '@/lib/api/uploads'
import { sendOrderEmails } from '@/lib/email'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST() {
  try {
    const { makeTransparentDemoPng } = await import('@/lib/transparentPng')
    const png = makeTransparentDemoPng(640, 320)
    const stored = await storeUploadBuffer(png, 'image/png')
    const compositeUrl = stored.artworkUrl

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
  } catch (e) {
    console.error('[email/test] error:', e?.message)
    return handleCORS(NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 }))
  }
}
