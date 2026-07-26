'use client'

import { useMemo, useState } from 'react'
import { ShoppingCart, Minus, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { SHEETS } from '@/lib/builder/constants'
import type { Layout } from '@/lib/builder/types'
import { itemDpi } from '@/lib/builder/dpi'
import { exportAndUpload, exportAndUploadServer } from '@/lib/builder/export'
import { toast } from 'sonner'
import { useCart } from '@/components/CartProvider'
import { useRouter } from 'next/navigation'

interface Props {
  layout: Layout
}

export default function CartBar({ layout }: Props) {
  const router = useRouter()
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  const sheet = SHEETS[layout.sheetSizeId]
  const unit = sheet.price
  const total = Math.round(unit * quantity * 100) / 100

  const warnings = useMemo(() => layout.items.filter((it) => itemDpi(it).bucket !== 'GOOD'), [layout.items])
  const anyPoor = layout.items.some((it) => itemDpi(it).bucket === 'POOR')

  const handleAdd = async () => {
    if (layout.items.length === 0) {
      toast.error('Add at least one artwork to the sheet')
      return
    }
    setAdding(true)
    try {
      // Prefer server-side sharp render (identical output on all devices). Fall back to
      // client canvas render if the server fails (5xx, timeout, etc.).
      let compositeUrl: string
      try {
        compositeUrl = await exportAndUploadServer(layout)
      } catch (serverErr: any) {
        console.warn('[composite] server render failed, falling back to client:', serverErr?.message)
        compositeUrl = await exportAndUpload(layout)
      }
      // Add to cart with the same shape existing cart expects
      addItem({
        sheetId: layout.sheetSizeId as any,
        sheetLabel: sheet.label,
        customLength: null,
        addons: [],
        quantity,
        unitPrice: unit,
        artworkName: `${layout.items.length} artwork${layout.items.length === 1 ? '' : 's'} · ${sheet.label}`,
        artworkThumb: null,
        artworkUrl: compositeUrl,
        layout: {
          ...layout,
          items: layout.items.map((it) => ({
            ...it,
            dpi: itemDpi(it).effectiveDpi,
            qualityBucket: itemDpi(it).bucket,
          })),
        },
        compositeUrl,
        qualityWarnings: warnings.length,
      } as any)
      toast.success('Added to cart', { description: `${quantity}× ${sheet.label} · $${total.toFixed(2)}` })
      router.push('/cart')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Add to cart failed')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-white/10 bg-black/60 backdrop-blur px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-400">{sheet.label} · {layout.items.length} artwork{layout.items.length === 1 ? '' : 's'}</div>
        {warnings.length > 0 && (
          <div className={'mt-1 inline-flex items-center gap-1 text-[11px] ' + (anyPoor ? 'text-red-400' : 'text-yellow-400')} data-testid="b-warn">
            <AlertTriangle className="h-3 w-3" />
            {warnings.length} artwork{warnings.length === 1 ? '' : 's'} below 300 DPI
          </div>
        )}
      </div>
      <div className="inline-flex items-center rounded-md border border-white/10 bg-white/5 self-start sm:self-auto">
        <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-2 text-neutral-300 hover:text-white"><Minus className="h-4 w-4" /></button>
        <input
          type="number"
          min={1}
          max={500}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
          className="w-14 bg-transparent text-center text-white outline-none"
          data-testid="b-qty"
        />
        <button onClick={() => setQuantity((q) => Math.min(500, q + 1))} className="p-2 text-neutral-300 hover:text-white"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Total</div>
        <div className="text-2xl font-black text-white" data-testid="b-total">${total.toFixed(2)}</div>
      </div>
      <button
        onClick={handleAdd}
        disabled={adding || layout.items.length === 0}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-bold uppercase tracking-widest px-6 py-3 shadow-[0_0_30px_rgba(217,70,239,0.4)] disabled:opacity-50"
        data-testid="b-add-cart"
      >
        {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</> : <><ShoppingCart className="h-4 w-4" /> Add to Cart</>}
      </button>
    </div>
  )
}
