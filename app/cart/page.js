'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useCart } from '@/components/CartProvider'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Minus, ShoppingBag, ShieldCheck, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function CartPage() {
  const { items, hydrated, subtotal, updateQuantity, removeItem } = useCart()
  const [serverTotal, setServerTotal] = useState(null)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState(null)

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      setServerTotal(null)
      return
    }
    let cancelled = false
    setValidating(true)
    setValidationError(null)
    ;(async () => {
      try {
        const r = await fetch('/api/cart/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
        const j = await r.json()
        if (cancelled) return
        if (!r.ok) setValidationError(j.error || 'Validation failed')
        else setServerTotal(j)
      } catch (e) {
        if (!cancelled) setValidationError('Network error')
      } finally {
        if (!cancelled) setValidating(false)
      }
    })()
    return () => { cancelled = true }
  }, [items, hydrated])

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="container mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Your Cart</h1>
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">← Continue building</Link>
        </div>

        {!hydrated ? null : items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <ShoppingBag className="h-10 w-10 text-neutral-500" />
            <div className="text-xl font-semibold">Your cart is empty</div>
            <div className="text-sm text-neutral-400">Head back to the builder and design your first gang sheet.</div>
            <Link
              href="/#builder"
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-fuchsia-500 px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-fuchsia-400 transition"
            >
              Build a Gang Sheet <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <ul className="space-y-4" data-testid="cart-items">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  data-testid={`cart-item-${item.id}`}
                >
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-white/5 flex items-center justify-center">
                    {item.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.artworkUrl} alt={item.artworkName || ''} className="h-full w-full object-contain" />
                    ) : item.artworkThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.artworkThumb} alt={item.artworkName || ''} className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-2xl font-black text-neutral-600">DTF</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{item.sheetLabel}</div>
                    <div className="mt-1 text-xs text-neutral-400 truncate">
                      {item.artworkName || 'No artwork uploaded yet'}
                    </div>
                    {item.addons?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.addons.map((a) => (
                          <span key={a} className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-fuchsia-300">{a}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-sm text-neutral-300">${item.unitPrice.toFixed(2)} <span className="text-neutral-500">/ sheet</span></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center rounded-md border border-white/10 bg-white/5">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 text-neutral-300 hover:text-white" data-testid={`decr-${item.id}`}><Minus className="h-4 w-4" /></button>
                      <input
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, e.target.value)}
                        className="w-12 bg-transparent text-center outline-none"
                        data-testid={`qty-${item.id}`}
                      />
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 text-neutral-300 hover:text-white" data-testid={`incr-${item.id}`}><Plus className="h-4 w-4" /></button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="rounded-md border border-white/10 bg-white/5 p-2 text-neutral-400 hover:text-red-400 hover:border-red-500/50 transition"
                      aria-label="Remove"
                      data-testid={`remove-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="w-full sm:w-24 text-right font-bold text-white">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </li>
              ))}
            </ul>

            {/* Summary */}
            <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Order Summary</div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-neutral-300">
                  <span>Subtotal (client)</span><span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-fuchsia-400" /> Verified total</span>
                  <span data-testid="server-total">
                    {validating ? '…' : serverTotal ? `$${serverTotal.total.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Shipping</span><span>calculated next step</span>
                </div>
              </div>
              {validationError && (
                <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{validationError}</div>
              )}
              <div className="mt-6 flex items-baseline justify-between border-t border-white/10 pt-4">
                <span className="text-neutral-400">Total</span>
                <span className="text-3xl font-black text-white">${(serverTotal?.total ?? subtotal).toFixed(2)}</span>
              </div>
              <Link
                href="/checkout"
                data-testid="checkout-btn"
                className="mt-6 flex w-full items-center justify-center h-12 rounded-md text-sm font-bold uppercase tracking-widest bg-fuchsia-500 hover:bg-fuchsia-400 text-white shadow-[0_0_30px_rgba(217,70,239,0.4)] transition"
              >
                Checkout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <p className="mt-3 text-center text-xs text-neutral-500">Secure PayPal checkout · your cart is saved.</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
