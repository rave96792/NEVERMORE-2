'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadCloud, Zap, Layers, Check, Plus, Minus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCart } from '@/components/CartProvider'
import { toast } from 'sonner'

export default function GangSheetBuilder() {
  const { addItem } = useCart()
  const [catalog, setCatalog] = useState(null)
  const [sheetId, setSheetId] = useState('22x24')
  const [customLength, setCustomLength] = useState(24)
  const [addons, setAddons] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState(null)
  const [artwork, setArtwork] = useState(null) // { name, size, thumb }
  const [dragActive, setDragActive] = useState(false)
  const [adding, setAdding] = useState(false)
  const fileRef = useRef(null)

  // Load catalogue
  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setCatalog({ sheets: [], addons: [] }))
  }, [])

  // Server-authoritative quote (debounced)
  useEffect(() => {
    let cancelled = false
    setQuoting(true)
    setQuoteErr(null)
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheetId, customLength: Number(customLength), addons }),
        })
        const j = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setQuoteErr(j.error || 'Quote failed')
          setQuote(null)
        } else {
          setQuote(j.unitPrice)
        }
      } catch (e) {
        if (!cancelled) setQuoteErr('Network error')
      } finally {
        if (!cancelled) setQuoting(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [sheetId, customLength, addons])

  const total = useMemo(() => (quote != null ? Math.round(quote * quantity * 100) / 100 : null), [quote, quantity])

  const toggleAddon = (id) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  const onFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload an image (PNG/JPG/WEBP) or PDF')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large (max 25MB)')
      return
    }
    // Instant local thumb for image files
    let thumb = null
    if (file.type.startsWith('image/')) {
      try { thumb = await makeThumb(file, 320) } catch {}
    }
    // Start upload immediately; UI shows local thumb + spinner
    setArtwork({ name: file.name, size: file.size, thumb, url: null, uploading: true })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/uploads', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Upload failed')
      setArtwork({ name: file.name, size: file.size, thumb, url: j.artworkUrl, uploading: false })
    } catch (e) {
      toast.error(e.message || 'Upload failed')
      setArtwork(null)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) onFile(f)
  }

  const handleAdd = async () => {
    if (quote == null) return
    if (artwork?.uploading) {
      toast.error('Artwork still uploading — hang on a sec')
      return
    }
    setAdding(true)
    const sheetLabel = sheetId === 'custom' ? `22" × ${customLength}" (Custom)` : catalog?.sheets?.find((s) => s.id === sheetId)?.label || sheetId
    addItem({
      sheetId,
      sheetLabel,
      customLength: sheetId === 'custom' ? Number(customLength) : null,
      addons,
      quantity,
      unitPrice: quote,
      artworkName: artwork?.name || null,
      artworkThumb: artwork?.thumb || null,
      artworkUrl: artwork?.url || null,
    })
    setTimeout(() => {
      setAdding(false)
      toast.success('Added to cart', {
        description: `${quantity} × ${sheetLabel} · $${(quote * quantity).toFixed(2)}`,
      })
    }, 250)
  }

  const sheets = catalog?.sheets || []
  const addonList = catalog?.addons || []

  return (
    <section id="builder" className="relative w-full py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
            <Sparkles className="h-3.5 w-3.5" /> LIVE PRICING · SERVER VERIFIED
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Gang Sheet Builder
          </h2>
          <p className="max-w-xl text-neutral-400">
            Pack your artwork onto a 22" wide DTF sheet. Pick a size, drop your file, hit print. Ships in 48hrs.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Left: configuration */}
          <div className="space-y-8">
            {/* Size selector */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                <Layers className="h-3.5 w-3.5" /> 01 · Choose Sheet Size
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sheets.map((s) => {
                  const active = s.id === sheetId
                  return (
                    <button
                      key={s.id}
                      data-testid={`sheet-${s.id}`}
                      onClick={() => setSheetId(s.id)}
                      className={
                        'group relative rounded-lg border p-4 text-left transition ' +
                        (active
                          ? 'border-fuchsia-500 bg-fuchsia-500/10 shadow-[0_0_25px_rgba(217,70,239,0.25)]'
                          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10')
                      }
                    >
                      <div className="text-sm font-bold text-white">{s.label}</div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {s.id === 'custom' ? `$${(0.036).toFixed(3)}/sq in` : `$${s.price.toFixed(2)}`}
                      </div>
                      {active && (
                        <Check className="absolute right-2 top-2 h-4 w-4 text-fuchsia-400" />
                      )}
                    </button>
                  )
                })}
              </div>
              {sheetId === 'custom' && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-neutral-300">Length (in)</label>
                  <Input
                    type="number"
                    min={12}
                    max={240}
                    value={customLength}
                    onChange={(e) => setCustomLength(e.target.value)}
                    className="w-32 bg-white/5 border-white/10 text-white"
                    data-testid="custom-length"
                  />
                  <span className="text-xs text-neutral-500">12 – 240 inches</span>
                </div>
              )}
            </div>

            {/* Artwork upload */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                <UploadCloud className="h-3.5 w-3.5" /> 02 · Upload Artwork <span className="text-neutral-600">(optional for now)</span>
              </div>
              <label
                htmlFor="artwork-upload"
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ' +
                  (dragActive ? 'border-fuchsia-400 bg-fuchsia-500/10' : 'border-white/15 bg-white/[0.03] hover:bg-white/5')
                }
              >
                {artwork ? (
                  <div className="flex flex-col items-center gap-2">
                    {artwork.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artwork.thumb} alt={artwork.name} className="max-h-32 rounded" />
                    ) : (
                      <div className="h-16 w-16 rounded bg-white/10" />
                    )}
                    <div className="text-sm text-white">{artwork.name}</div>
                    <div className="text-xs text-neutral-500">
                      {(artwork.size/1024).toFixed(0)} KB ·{' '}
                      {artwork.uploading ? (
                        <span className="text-fuchsia-300">Uploading…</span>
                      ) : artwork.url ? (
                        <span className="text-emerald-400">Saved · click to replace</span>
                      ) : (
                        'Click to replace'
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="mb-3 h-8 w-8 text-neutral-400" />
                    <div className="text-sm text-white">Drop artwork here or click to browse</div>
                    <div className="mt-1 text-xs text-neutral-500">PNG, JPG, or PDF · 300 DPI recommended</div>
                  </>
                )}
                <input
                  id="artwork-upload"
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  data-testid="artwork-input"
                />
              </label>
            </div>

            {/* Addons */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                <Zap className="h-3.5 w-3.5" /> 03 · Add-Ons
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {addonList.map((a) => {
                  const active = addons.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      data-testid={`addon-${a.id}`}
                      onClick={() => toggleAddon(a.id)}
                      className={
                        'flex items-center justify-between rounded-lg border p-3 text-left transition ' +
                        (active ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10')
                      }
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{a.label}</div>
                        <div className="text-xs text-neutral-400">+${a.price.toFixed(2)}</div>
                      </div>
                      <div className={'h-4 w-4 rounded border ' + (active ? 'border-fuchsia-400 bg-fuchsia-500' : 'border-white/30')}>
                        {active && <Check className="h-4 w-4 text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: pricing card */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur">
              <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Your Order</div>
              <div className="mt-2 text-white text-lg font-semibold">
                {sheetId === 'custom' ? `22" × ${customLength}" Custom` : sheets.find((s) => s.id === sheetId)?.label}
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-xs text-neutral-400">Unit price</span>
                <span className="text-3xl font-black text-white">
                  {quoteErr ? '—' : quote != null ? `$${quote.toFixed(2)}` : '…'}
                </span>
                {quoting && <span className="text-xs text-neutral-500">syncing…</span>}
              </div>
              {quoteErr && <div className="mt-1 text-xs text-red-400">{quoteErr}</div>}

              <div className="mt-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">Quantity</div>
                <div className="inline-flex items-center rounded-md border border-white/10 bg-white/5">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 text-neutral-300 hover:text-white"
                    data-testid="qty-decr"
                  ><Minus className="h-4 w-4" /></button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                    className="w-14 bg-transparent text-center text-white outline-none"
                    data-testid="qty-input"
                  />
                  <button
                    onClick={() => setQuantity((q) => Math.min(500, q + 1))}
                    className="p-2 text-neutral-300 hover:text-white"
                    data-testid="qty-incr"
                  ><Plus className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-6 space-y-1 text-sm">
                <div className="flex justify-between text-neutral-300"><span>Subtotal</span><span>${total != null ? total.toFixed(2) : '—'}</span></div>
                <div className="flex justify-between text-neutral-500"><span>Shipping</span><span>calculated at checkout</span></div>
              </div>

              <Button
                onClick={handleAdd}
                disabled={quote == null || adding}
                data-testid="add-to-cart"
                className="mt-6 w-full h-12 text-sm font-bold uppercase tracking-widest bg-fuchsia-500 hover:bg-fuchsia-400 text-white shadow-[0_0_30px_rgba(217,70,239,0.4)] disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add to Cart'}
              </Button>
              <p className="mt-3 text-center text-xs text-neutral-500">Cart is saved to your browser — nothing to sign up for.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

async function makeThumb(file, maxSide = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
