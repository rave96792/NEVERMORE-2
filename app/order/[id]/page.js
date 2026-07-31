'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { CheckCircle2, Clock, XCircle, Package, RefreshCw, AlertTriangle } from 'lucide-react'

export default function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rerendering, setRerendering] = useState(false)
  const [rerenderMsg, setRerenderMsg] = useState(null)

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      const r = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) setErr(j.error || 'Not found')
      else { setOrder(j); setErr(null) }
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  // Auto-poll every 5s while render is in-progress or pending_retry (server may still be working)
  useEffect(() => {
    if (!order) return
    const s = order.renderStatus
    if (s !== 'rendering' && s !== 'pending' && s !== 'pending_retry') return
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [order, refresh])

  const StatusBadge = ({ s }) => {
    if (s === 'PAID') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
    if (s === 'FAILED') return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-300"><XCircle className="h-3.5 w-3.5" /> Failed</span>
    return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 border border-yellow-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-yellow-300"><Clock className="h-3.5 w-3.5" /> {s || 'Pending'}</span>
  }

  const RenderStatusBadge = ({ order }) => {
    const s = order?.renderStatus
    if (!s) return null
    const items = order.items || []
    const usedEmergency = items.some((it) => it?.printFileSource === 'client-emergency')
    if (s === 'succeeded') return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Print file ready
      </div>
    )
    if (s === 'rendering' || s === 'pending' || s === 'pending_retry') return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-fuchsia-300">
        <RefreshCw className="h-3 w-3 animate-spin" /> Preparing print file…
      </div>
    )
    if (s === 'failed') return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-red-300">
        <AlertTriangle className="h-3 w-3" /> Render failed{usedEmergency ? ' · using emergency fallback' : ''}
      </div>
    )
    return null
  }

  const handleRerender = async () => {
    const token = window.prompt('Admin token to re-render this order:')
    if (!token) return
    setRerendering(true)
    setRerenderMsg(null)
    try {
      const r = await fetch(`/api/orders/${id}/rerender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ force: true }),
      })
      const j = await r.json()
      if (!r.ok) setRerenderMsg(`❌ ${j.error || 'Failed'}`)
      else setRerenderMsg(`✅ ${j.renderedCount}/${j.totalItems} rendered · attempt ${j.attempt} · ${j.status}`)
      await refresh()
    } catch (e) {
      setRerenderMsg(`❌ ${e?.message || 'Network error'}`)
    } finally {
      setRerendering(false)
    }
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
                <div className="flex items-center gap-2 flex-wrap">
                  <RenderStatusBadge order={order} />
                  <StatusBadge s={order.status} />
                </div>
              </div>

              {/* Render status detail row — only visible when there's something to show */}
              {order.renderStatus && order.renderStatus !== 'succeeded' && (
                <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-neutral-300">
                  {order.renderStatus === 'rendering' || order.renderStatus === 'pending' ? (
                    <span className="text-fuchsia-300">Preparing your print-ready file (300 DPI transparent PNG). This normally finishes in a few seconds.</span>
                  ) : order.renderStatus === 'pending_retry' ? (
                    <span className="text-yellow-300">Print file didn't render on the first try — will retry automatically.</span>
                  ) : (
                    <>
                      <span className="text-red-300">Print file render failed after {order.renderAttempts || '?'} attempt(s). Your order is safe and paid — we're using the emergency in-browser render as a placeholder.</span>
                      <button
                        onClick={handleRerender}
                        disabled={rerendering}
                        className="mt-2 inline-flex items-center gap-1 rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-1 text-[11px] text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-40"
                        data-testid="btn-rerender"
                      >
                        <RefreshCw className={`h-3 w-3 ${rerendering ? 'animate-spin' : ''}`} /> Regenerate print file
                      </button>
                    </>
                  )}
                  {rerenderMsg && <div className="mt-2 text-neutral-300">{rerenderMsg}</div>}
                </div>
              )}

              <div className="mt-6 grid gap-6 sm:grid-cols-2 text-sm">
                <div>
                  {order.deliveryMethod === 'pickup' ? (
                    <>
                      <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Free local pickup</div>
                      <div className="text-white">{order.shipping?.fullName}</div>
                      <div className="text-neutral-400">{order.shipping?.email}{order.shipping?.phone ? ` · ${order.shipping.phone}` : ''}</div>
                      <div className="mt-2 text-neutral-400 text-sm">Nevermore DTF · Honolulu, HI</div>
                      <div className="mt-1 text-neutral-500 text-xs">We'll email you when your order is ready.</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Ship to</div>
                      <div className="text-white">{order.shipping?.fullName}</div>
                      <div className="text-neutral-400">{order.shipping?.line1}{order.shipping?.line2 ? `, ${order.shipping.line2}` : ''}</div>
                      <div className="text-neutral-400">{order.shipping?.city}, {order.shipping?.state} {order.shipping?.postalCode}</div>
                      <div className="text-neutral-400">{order.shipping?.country}</div>
                      <div className="mt-2 text-neutral-500 text-xs">{order.shipping?.email}</div>
                    </>
                  )}
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
                <div className="flex justify-between text-neutral-400"><span>{order.deliveryMethod === 'pickup' ? 'Pickup' : 'Shipping'}</span><span>{order.shipping_amount === 0 || order.deliveryMethod === 'pickup' ? 'FREE' : `$${order.shipping_amount?.toFixed(2)}`}</span></div>
                {order.rush && <div className="flex justify-between text-amber-300"><span>Rush production</span><span>+${(order.rushFee ?? 30).toFixed(2)}</span></div>}
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
