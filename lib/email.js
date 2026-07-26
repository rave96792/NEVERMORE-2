// Server-only. Never import from client components.
import { Resend } from 'resend'

let client = null
function getClient() {
  if (client) return client
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not set')
  client = new Resend(key)
  return client
}

const FROM = process.env.MAIL_FROM || 'onboarding@resend.dev'
const SHOP_TO = process.env.MAIL_SHOP_TO
const BUYER_CONFIRM = String(process.env.MAIL_BUYER_CONFIRM || 'true').toLowerCase() === 'true'

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`
}

function renderItemsHtml(items) {
  // Small inline base64 transparency checkerboard so recipients can see through the composite
  const CHECKER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAG1BMVEXt7e3v7+/w8PDx8fH19fX39/f4+Pj7+/v9/f2SR93BAAAAKUlEQVQoz2NgQAX/GfAABkYGVIYqYWChzMTAyAAKMzEwMTHAAAsjBgAAj/QCcbLJ8fgAAAAASUVORK5CYII='
  return items
    .map((it) => {
      const composite = it.compositeUrl ? absUrl(it.compositeUrl) : (it.artworkUrl ? absUrl(it.artworkUrl) : null)
      const layoutSize = it.layout?.items?.length ? `${it.layout.items.length} artwork(s) placed` : ''
      return `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top;">
          ${composite
            ? `<div style="width:72px;height:72px;background-image:url(${CHECKER});background-repeat:repeat;border-radius:6px;overflow:hidden;border:1px solid #ddd">
                <img src="${escapeHtml(composite)}" alt="Transparent composite" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:contain" />
               </div>`
            : ''}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top;">
          <div style="font-weight:600;color:#111">${escapeHtml(it.sheetLabel)}</div>
          <div style="font-size:12px;color:#555">${escapeHtml(it.artworkName || layoutSize || '')}</div>
          ${composite
            ? `<div style="font-size:11px;margin-top:6px">
                 <a href="${escapeHtml(composite)}" style="color:#7c3aed;font-weight:600;text-decoration:none">↓ Download composite PNG</a>
                 <div style="color:#888;margin-top:2px">Transparent PNG · 300 DPI · print-ready</div>
               </div>`
            : ''}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;color:#555">${it.quantity}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;color:#111;font-weight:600">${money(it.unitPrice * it.quantity)}</td>
      </tr>`
    })
    .join('')
}

function orderHtml({ title, subtitle, order }) {
  const s = order.shipping || {}
  const rows = renderItemsHtml(order.items || [])
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a;color:#eee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#d946ef,#7c3aed);border-radius:12px;padding:20px;color:#fff">
      <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.85">Nevermore DTF</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(title)}</div>
      <div style="opacity:0.85;margin-top:6px">${escapeHtml(subtitle)}</div>
    </div>

    <div style="background:#fff;color:#111;border-radius:12px;margin-top:16px;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #eee">
        <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#666">Order</div>
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#111">${escapeHtml(order.id)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th></th>
            <th style="text-align:left;padding:8px 6px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.1em">Item</th>
            <th style="padding:8px 6px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.1em">Qty</th>
            <th style="text-align:right;padding:8px 6px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.1em">Line</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:12px 20px 4px;font-size:13px;color:#333">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Shipping</span><span>${order.shipping_amount ? money(order.shipping_amount) : 'FREE'}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Tax${order.taxState === 'HI' ? ' (HI 4.712%)' : ''}</span><span>${money(order.tax)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:1px solid #eee;margin-top:8px;padding-top:8px"><span>Total</span><span>${money(order.total)}</span></div>
      </div>
      <div style="padding:16px 20px;border-top:1px solid #eee">
        <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#666;margin-bottom:6px">Ship to</div>
        <div>${escapeHtml(s.fullName || '')}</div>
        <div style="color:#555">${escapeHtml(s.line1 || '')}${s.line2 ? ', ' + escapeHtml(s.line2) : ''}</div>
        <div style="color:#555">${escapeHtml(s.city || '')}, ${escapeHtml(s.state || '')} ${escapeHtml(s.postalCode || '')}</div>
        <div style="color:#555">${escapeHtml(s.country || '')}</div>
        <div style="color:#555;margin-top:6px">${escapeHtml(s.email || '')}</div>
      </div>
    </div>

    <div style="text-align:center;font-size:11px;color:#777;margin-top:16px">
      &copy; ${new Date().getFullYear()} Nevermore DTF &middot; direct-to-film transfers
    </div>
  </div>
  </body></html>`
}

export async function sendOrderEmails(order) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY missing; skipping email')
    return { ok: false, skipped: true }
  }

  const results = { shop: null, buyer: null }
  const resend = getClient()
  const orderTag = order.orderNumber ? `#${order.orderNumber}` : order.id.slice(0, 8)

  // 1. Shop submission email
  if (SHOP_TO) {
    try {
      const html = orderHtml({
        title: `New gang sheet submission ${orderTag}`,
        subtitle: `Order ${orderTag} · ${money(order.total)} · ${order.items?.length || 0} item(s)`,
        order,
      })
      const r = await resend.emails.send({
        from: FROM,
        to: SHOP_TO,
        subject: `NEW ORDER ${orderTag} · ${money(order.total)}`,
        html,
      })
      results.shop = { ok: !r.error, id: r.data?.id || null, error: r.error?.message || null }
    } catch (e) {
      results.shop = { ok: false, error: e?.message || 'send failed' }
    }
  }

  // 2. Buyer confirmation
  if (BUYER_CONFIRM && order.shipping?.email) {
    try {
      const html = orderHtml({
        title: `Order ${orderTag} confirmed`,
        subtitle: `Thanks ${order.shipping.fullName || ''} — your DTF transfers are queued for print. ETA 48hrs.`,
        order,
      })
      const r = await resend.emails.send({
        from: FROM,
        to: order.shipping.email,
        subject: `Nevermore DTF · order ${orderTag} confirmed`,
        html,
      })
      results.buyer = { ok: !r.error, id: r.data?.id || null, error: r.error?.message || null }
    } catch (e) {
      results.buyer = { ok: false, error: e?.message || 'send failed' }
    }
  }

  console.log('[email] sent', JSON.stringify(results))
  return { ok: true, results }
}

// Status transition emails (ORDERED already handled by sendOrderEmails on capture).
export async function sendStatusEmail(order, newStatus, extra = {}) {
  if (!process.env.RESEND_API_KEY) return { ok: false, skipped: true }
  const resend = getClient()
  const orderTag = order.orderNumber ? `#${order.orderNumber}` : order.id.slice(0, 8)

  const templates = {
    PROCESSING: {
      subject: `Nevermore DTF · order ${orderTag} is being printed`,
      title: `Your order ${orderTag} is now being printed`,
      subtitle: `Your DTF transfers are on the press. We'll email you again when they ship.`,
    },
    SHIPPED: {
      subject: `Nevermore DTF · order ${orderTag} has shipped`,
      title: `Your order ${orderTag} has shipped!`,
      subtitle: extra.trackingNumber
        ? `Tracking: ${extra.trackingNumber}${extra.carrier ? ' (' + extra.carrier + ')' : ''}`
        : 'It should reach you in 2–5 business days.',
    },
  }
  const tpl = templates[newStatus]
  if (!tpl) return { ok: false, error: 'Unknown status: ' + newStatus }

  // Send to buyer only (shop already tracks status in DB / can view /admin)
  const to = order.shipping?.email
  if (!to) return { ok: false, error: 'No buyer email' }
  try {
    const html = orderHtml({ title: tpl.title, subtitle: tpl.subtitle, order })
    const r = await resend.emails.send({ from: FROM, to, subject: tpl.subject, html })
    return { ok: !r.error, id: r.data?.id, error: r.error?.message }
  } catch (e) {
    return { ok: false, error: e?.message || 'send failed' }
  }
}
