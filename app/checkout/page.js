'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useCart } from '@/components/CartProvider'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']

export default function CheckoutPage() {
  const router = useRouter()
  const { items, hydrated, clear } = useCart()
  const [deliveryMethod, setDeliveryMethod] = useState('ship') // 'ship' | 'pickup'
  const [rush, setRush] = useState(false)
  const [shipping, setShipping] = useState({
    fullName: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US',
  })
  const [totals, setTotals] = useState(null)
  const [validating, setValidating] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!hydrated) return
    if (items.length === 0) return
    let cancelled = false
    setValidating(true)
    ;(async () => {
      try {
        const r = await fetch('/api/cart/validate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            shipping: { state: shipping.state, country: shipping.country },
            deliveryMethod,
            rush,
          }),
        })
        const j = await r.json()
        if (cancelled) return
        if (!r.ok) setErr(j.error || 'Failed')
        else { setTotals(j); setErr(null) }
      } catch { if (!cancelled) setErr('Network error') }
      finally { if (!cancelled) setValidating(false) }
    })()
    return () => { cancelled = true }
  }, [items, hydrated, shipping.state, shipping.country, deliveryMethod, rush])

  const isValid = useMemo(() => {
    const s = shipping
    const baseOk = !!(s.fullName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
    if (deliveryMethod === 'pickup') return baseOk && !!s.phone // phone required for pickup coordination
    return baseOk && !!(s.line1 && s.city && s.state && s.postalCode && s.country)
  }, [shipping, deliveryMethod])

  const set = (k) => (e) => setShipping((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="container mx-auto px-4 py-10 sm:py-16">
        <Link href="/cart" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to cart</Link>
        <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">Checkout</h1>

        {hydrated && items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <div className="text-lg">Your cart is empty.</div>
            <Link href="/#builder" className="mt-4 inline-block rounded-md bg-fuchsia-500 px-5 py-2 text-sm font-bold uppercase tracking-widest">Build a Gang Sheet</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-8">
              {/* Contact */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">01 · Contact</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-neutral-300">Full name</Label>
                    <Input data-testid="in-fullName" value={shipping.fullName} onChange={set('fullName')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">Email</Label>
                    <Input data-testid="in-email" type="email" value={shipping.email} onChange={set('email')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-neutral-300">Phone {deliveryMethod === 'pickup' ? <span className="text-emerald-300">(required for pickup)</span> : '(optional)'}</Label>
                    <Input data-testid="in-phone" value={shipping.phone} onChange={set('phone')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                </div>
              </section>

              {/* Delivery method */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">02 · Delivery</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="delivery-ship"
                    onClick={() => setDeliveryMethod('ship')}
                    className={`rounded-xl border p-4 text-left transition ${deliveryMethod === 'ship' ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}
                  >
                    <div className="text-sm font-bold">Ship to me</div>
                    <div className="mt-1 text-xs text-neutral-400">$5 flat to Hawaii · $12 flat to the rest of the US</div>
                  </button>
                  <button
                    type="button"
                    data-testid="delivery-pickup"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`rounded-xl border p-4 text-left transition ${deliveryMethod === 'pickup' ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">Free local pickup <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">FREE</span></div>
                    <div className="mt-1 text-xs text-neutral-400">Honolulu, HI — we'll email you when your order is ready. Phone required.</div>
                  </button>
                </div>
              </section>

              {/* Shipping address (only when Ship is chosen) */}
              {deliveryMethod === 'ship' && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">03 · Shipping address</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-neutral-300">Street address</Label>
                    <Input data-testid="in-line1" value={shipping.line1} onChange={set('line1')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-neutral-300">Apt, suite, etc. (optional)</Label>
                    <Input value={shipping.line2} onChange={set('line2')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">City</Label>
                    <Input data-testid="in-city" value={shipping.city} onChange={set('city')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">State</Label>
                    <select data-testid="in-state" value={shipping.state} onChange={set('state')} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                      <option value="" className="bg-neutral-900">Choose…</option>
                      {US_STATES.map((s) => <option key={s} value={s} className="bg-neutral-900">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">ZIP</Label>
                    <Input data-testid="in-zip" value={shipping.postalCode} onChange={set('postalCode')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">Country</Label>
                    <Input value={shipping.country} onChange={set('country')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                </div>
              </section>
              )}

              {/* Rush option — appears BEFORE delivery so buyers see the option first */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">04 · Production speed</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="rush-standard"
                    onClick={() => setRush(false)}
                    className={`rounded-xl border p-4 text-left transition ${!rush ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}
                  >
                    <div className="text-sm font-bold">Standard production</div>
                    <div className="mt-1 text-xs text-neutral-400">Ready in 3–5 business days · no extra charge</div>
                  </button>
                  <button
                    type="button"
                    data-testid="rush-fast"
                    onClick={() => setRush(true)}
                    className={`rounded-xl border p-4 text-left transition ${rush ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">Rush production <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">+$30</span></div>
                    <div className="mt-1 text-xs text-neutral-400">Bumped to the front of the queue · ready in 1 business day</div>
                  </button>
                </div>
              </section>

              {/* Pickup details (only when Pickup is chosen) */}
              {deliveryMethod === 'pickup' && (
                <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-300">03 · Pickup details</h2>
                  <div className="mt-3 text-sm text-emerald-100/90">
                    We'll email <strong>{shipping.email || 'you'}</strong> as soon as your gang sheet is ready.
                    Bring a printed or on-screen copy of your order # for a quick handoff.
                  </div>
                  <div className="mt-4 rounded-lg bg-black/40 p-4 text-xs text-neutral-300">
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500">Pickup location</div>
                    <div className="mt-1 text-neutral-100 font-semibold">Nevermore DTF · Honolulu, HI</div>
                    <div className="text-neutral-400">Exact address + pickup window will be sent in your confirmation email.</div>
                  </div>
                  <div className="mt-3 text-[11px] text-emerald-300/80">Hawaii GET (4.712%) still applies on pickup orders.</div>
                </section>
              )}
            </div>

            {/* Summary + PayPal */}
            <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Order Summary</div>
              <ul className="mt-4 space-y-2 text-sm max-h-56 overflow-auto pr-1">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span className="text-neutral-300 truncate">{it.quantity}× {it.sheetLabel}</span>
                    <span className="text-neutral-200">${(it.unitPrice * it.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-1 text-sm border-t border-white/10 pt-4">
                <div className="flex justify-between text-neutral-300"><span>Subtotal</span><span>${totals ? totals.subtotal.toFixed(2) : '…'}</span></div>
                <div className="flex justify-between text-neutral-300">
                  <span>{deliveryMethod === 'pickup' ? 'Pickup' : 'Shipping'}</span>
                  <span>{deliveryMethod === 'pickup' ? <span className="text-emerald-300 font-semibold">FREE</span> : (totals ? `$${totals.shipping.toFixed(2)}` : '…')}</span>
                </div>
                {rush && (
                  <div className="flex justify-between text-amber-300">
                    <span>Rush production</span>
                    <span>+$30.00</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-300">
                  <span>Tax {totals?.taxState === 'HI' ? '(HI 4.712%)' : ''}</span>
                  <span>${totals ? totals.tax.toFixed(2) : '0.00'}</span>
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
                <span className="text-neutral-400">Total</span>
                <span className="text-3xl font-black text-white" data-testid="checkout-total">${totals ? totals.total.toFixed(2) : '…'}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500"><ShieldCheck className="h-3 w-3 text-fuchsia-400" /> Prices re-verified server-side before charge.</div>

              <div className="mt-6">
                {!isValid && (
                  <div className="mb-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-300">
                    {deliveryMethod === 'pickup'
                      ? 'Enter name, email, and phone to enable PayPal.'
                      : 'Fill in contact + shipping to enable PayPal.'}
                  </div>
                )}
                <div className={isValid ? '' : 'pointer-events-none opacity-40'} data-testid="paypal-slot">
                  <PayPalScriptProvider options={{
                    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAApcJIfSxLNqdvkKm0KwdR8KV7IKZyeL4NNz0J4XJxZvf5XMhLo0PfWcNWyC9A_8XOnuoZKsYPJOeOCnE',
                    currency: 'USD',
                    intent: 'capture',
                  }}>
                    <PayPalButtons
                      forceReRender={[totals?.total || 0, shipping.state, JSON.stringify(items.map((i) => i.id + ':' + i.quantity))]}
                      style={{ layout: 'vertical', shape: 'rect', label: 'paypal', color: 'gold' }}
                      disabled={!isValid || !totals}
                      createOrder={async () => {
                        setErr(null)
                        const r = await fetch('/api/paypal/create-order', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ items, shipping, deliveryMethod, rush }),
                        })
                        const j = await r.json()
                        if (!r.ok) { toast.error(j.error || 'Failed to start checkout'); throw new Error(j.error) }
                        window.__nvm_last_internal = j.internalOrderId
                        return j.orderID
                      }}
                      onApprove={async (data) => {
                        const r = await fetch('/api/paypal/capture-order', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderID: data.orderID }),
                        })
                        const j = await r.json()
                        if (!r.ok) { toast.error(j.error || 'Capture failed'); throw new Error(j.error) }
                        toast.success('Payment received')
                        clear()
                        router.push(`/order/${j.internalOrderId}`)
                      }}
                      onError={(e) => { console.error('PayPal SDK error:', e); toast.error(`PayPal error: ${e?.message || 'SDK failed to load. If on iOS Safari, try disabling "Advanced Privacy Protection" for this site.'}`) }}
                      onCancel={() => toast('Payment cancelled')}
                    />
                  </PayPalScriptProvider>
                </div>
                {err && <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{err}</div>}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
