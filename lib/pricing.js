// Server + client shared pricing. SINGLE source of truth.
// Server re-computes from these constants; anything the client sends is untrusted.
// Nevermore DTF gang sheets: 14" wide × N inches long.

export const SHEETS = {
  '14x12':  { id: '14x12',  label: '14" × 12"',  widthIn: 14, lengthIn: 12,  price: 10.00 },
  '14x24':  { id: '14x24',  label: '14" × 24"',  widthIn: 14, lengthIn: 24,  price: 14.00 },
  '14x36':  { id: '14x36',  label: '14" × 36"',  widthIn: 14, lengthIn: 36,  price: 18.00 },
  '14x48':  { id: '14x48',  label: '14" × 48"',  widthIn: 14, lengthIn: 48,  price: 22.00 },
  '14x60':  { id: '14x60',  label: '14" × 60"',  widthIn: 14, lengthIn: 60,  price: 26.00 },
  '14x72':  { id: '14x72',  label: '14" × 72"',  widthIn: 14, lengthIn: 72,  price: 30.00 },
  '14x84':  { id: '14x84',  label: '14" × 84"',  widthIn: 14, lengthIn: 84,  price: 34.00 },
  '14x96':  { id: '14x96',  label: '14" × 96"',  widthIn: 14, lengthIn: 96,  price: 37.00 },
  '14x120': { id: '14x120', label: '14" × 120"', widthIn: 14, lengthIn: 120, price: 40.00 },
}

// Legacy fields kept so the older `/api/pricing` shape stays backward-compatible.
export const CUSTOM_PER_SQIN = 0.036
export const CUSTOM_MIN_LENGTH = 12
export const CUSTOM_MAX_LENGTH = 240

// Add-ons live in the builder flow (turnaround upsell etc.). Empty for MVP of new builder.
export const ADDONS = {}

// Shipping: region-based. Rates picked to cover USPS mailer + handling for DTF sheets.
export const SHIPPING_RATES = {
  us_contiguous: 5.99, // 48 states + DC
  us_offshore:  12.99, // AK, HI, PR, VI, GU, AS, MP
  canada:       15.99,
  international: 24.99,
}
const US_OFFSHORE_STATES = new Set(['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP'])

export function computeShipping({ country, state }) {
  const c = String(country || '').toUpperCase().trim()
  const s = String(state || '').toUpperCase().trim()
  // Blank country ⇒ treat as US contiguous (fallback for legacy carts / pre-form state)
  if (c === '' || c === 'US' || c === 'USA' || c === 'UNITED STATES') {
    return US_OFFSHORE_STATES.has(s) ? SHIPPING_RATES.us_offshore : SHIPPING_RATES.us_contiguous
  }
  if (c === 'CA' || c === 'CAN' || c === 'CANADA') return SHIPPING_RATES.canada
  return SHIPPING_RATES.international
}

// Tax: Hawaii-only, 4.712%.
export const TAX_RATES = { HI: 0.04712 }

export function round2(n) { return Math.round(n * 100) / 100 }

export function computeUnitPrice({ sheetId, addons = [] }) {
  const sheet = SHEETS[sheetId]
  if (!sheet) throw new Error('Invalid sheet size')
  let base = sheet.price
  let addonTotal = 0
  for (const a of addons) {
    const add = ADDONS[a]
    if (!add) throw new Error(`Invalid addon: ${a}`)
    addonTotal += add.price
  }
  return round2(base + addonTotal)
}

export function validateAndPriceItem(item) {
  try {
    if (!item || typeof item !== 'object') throw new Error('Invalid item')
    const sheetId = String(item.sheetId || '')
    const sheet = SHEETS[sheetId]
    if (!sheet) throw new Error(`Invalid sheet size: ${sheetId}`)
    const addons = Array.isArray(item.addons) ? item.addons.filter((a) => typeof a === 'string' && ADDONS[a]) : []
    const quantity = Math.max(1, Math.min(500, parseInt(item.quantity, 10) || 1))
    const unitPrice = computeUnitPrice({ sheetId, addons })

    // Optional layout payload (opaque JSON, size-capped) — passes through to the order document.
    let layout = null
    if (item.layout && typeof item.layout === 'object') {
      try {
        const s = JSON.stringify(item.layout)
        if (s.length < 200_000) layout = JSON.parse(s)
      } catch {}
    }

    return {
      ok: true,
      item: {
        id: String(item.id || ''),
        sheetId,
        sheetLabel: sheet.label,
        customLength: null,
        addons,
        quantity,
        unitPrice,
        lineTotal: round2(unitPrice * quantity),
        artworkName: typeof item.artworkName === 'string' ? item.artworkName.slice(0, 120) : null,
        artworkThumb: typeof item.artworkThumb === 'string' && item.artworkThumb.startsWith('data:image/') && item.artworkThumb.length < 300_000 ? item.artworkThumb : null,
        artworkUrl: typeof item.artworkUrl === 'string' && (item.artworkUrl.startsWith('/api/uploads/') || item.artworkUrl.startsWith('http')) ? item.artworkUrl.slice(0, 500) : null,
        compositeUrl: typeof item.compositeUrl === 'string' && (item.compositeUrl.startsWith('/api/uploads/') || item.compositeUrl.startsWith('http')) ? item.compositeUrl.slice(0, 500) : null,
        qualityWarnings: Number.isFinite(item.qualityWarnings) ? Math.max(0, Math.min(50, item.qualityWarnings | 0)) : 0,
        layout,
      },
    }
  } catch (e) {
    return { ok: false, error: e.message || 'Invalid item' }
  }
}

export function validateCart(items) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Cart is empty' }
  const priced = []
  for (const it of items) {
    const res = validateAndPriceItem(it)
    if (!res.ok) return { ok: false, error: res.error }
    priced.push(res.item)
  }
  const subtotal = round2(priced.reduce((s, it) => s + it.lineTotal, 0))
  return { ok: true, items: priced, subtotal, total: subtotal }
}

export function computeTotals({ subtotal, shippingState, shippingCountry }) {
  const shipping = computeShipping({ country: shippingCountry, state: shippingState })
  const state = String(shippingState || '').toUpperCase().slice(0, 2)
  const rate = TAX_RATES[state] || 0
  const tax = round2((subtotal + shipping) * rate)
  const total = round2(subtotal + shipping + tax)
  return { subtotal: round2(subtotal), shipping: round2(shipping), tax, total, taxRate: rate, taxState: state || null }
}
