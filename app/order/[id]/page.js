'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { CheckCircle2, Clock, XCircle, Package } from 'lucide-react'

export default function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/orders/${id}`)
        const j = await r.json()
        if (cancelled) return
        if (!r.ok) setErr(j.error || 'Not found')
        else setOrder(j)
      } catch { if (!cancelled) setErr('Network error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  const StatusBadge = ({ s }) => {
    if (s === 'PAID') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
    if (s === 'FAILED') return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-300"><XCircle className="h-3.5 w-3.5" /> Failed</span>
    return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 border border-yellow-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-yellow-300"><Clock className="h-3.5 w-3.5" /> {s || 'Pending'}</span>
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="container mx-auto px-4 py-10 sm:py-16">
        {loading ? (
          <div className="text-neutral-400">Loading order…</div>
        ) : err ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">{err}</div>
        ) : order && (
          <div className="max-w-3xl mx-auto">
            {order.status === 'PAID' && (
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/50 flex items-center justify-center shadow-[0_0_40px_rgba(217,70,239,0.4)]">
                  <CheckCircle2 className="h-8 w-8 text-fuchsia-300" />
                </div>
                <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight">Order confirmed</h1>
                <p className="mt-2 text-neutral-400">Nice. Your DTF transfers are queued for print.</p>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-neutral-500">Order</div>
                  <div className="font-mono text-sm text-white" data-testid="order-id">{order.id}</div>
                </div>
                <StatusBadge s={order.status} />
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Ship to</div>
                  <div className="text-white">{order.shipping?.fullName}</div>
                  <div className="text-neutral-400">{order.shipping?.line1}{order.shipping?.line2 ? `, ${order.shipping.line2}` : ''}</div>
                  <div className="text-neutral-400">{order.shipping?.city}, {order.shipping?.state} {order.shipping?.postalCode}</div>
                  <div className="text-neutral-400">{order.shipping?.country}</div>
                  <div className="mt-2 text-neutral-500 text-xs">{order.shipping?.email}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Payment</div>
                  <div className="text-neutral-400">PayPal Order: <span className="font-mono text-neutral-200">{order.paypalOrderId}</span></div>
                  {order.captureId && <div className="text-neutral-400">Capture: <span className="font-mono text-neutral-200">{order.captureId}</span></div>}
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2"><Package className="h-3.5 w-3.5" /> Items</div>
                <ul className="space-y-3">
                  {order.items?.map((it) => (
                    <li key={it.id} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded bg-white/5 flex items-center justify-center overflow-hidden">
                        {it.artworkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.artworkUrl} alt="" className="h-full w-full object-contain" />
                        ) : it.artworkThumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.artworkThumb} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-black text-neutral-600">DTF</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white truncate">{it.quantity}× {it.sheetLabel}</div>
                        <div className="text-xs text-neutral-500 truncate">{it.artworkName || 'artwork pending'}</div>
                      </div>
                      <div className="text-sm text-neutral-200">${(it.unitPrice * it.quantity).toFixed(2)}</div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 border-t border-white/10 pt-6 text-sm space-y-1">
                <div className="flex justify-between text-neutral-400"><span>Subtotal</span><span>${order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between text-neutral-400"><span>Shipping</span><span>{order.shipping_amount === 0 ? 'FREE' : `$${order.shipping_amount?.toFixed(2)}`}</span></div>
                <div className="flex justify-between text-neutral-400"><span>Tax {order.taxState === 'HI' ? '(HI 4.712%)' : ''}</span><span>${order.tax?.toFixed(2)}</span></div>
                <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-3">
                  <span className="text-neutral-300">Total</span>
                  <span className="text-2xl font-black text-white">${order.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Link href="/" className="inline-block rounded-md border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition">Back to home</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
