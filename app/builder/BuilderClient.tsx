'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SizePicker from '@/components/builder/SizePicker'
import Sidebar from '@/components/builder/Sidebar'
import Toolbar from '@/components/builder/Toolbar'
import CartBar from '@/components/builder/CartBar'
import DesignManager from '@/components/builder/DesignManager'
import UploadPanel from '@/components/builder/UploadPanel'
import { useLayoutStore, emptyLayout, cryptoId } from '@/lib/builder/useLayoutStore'
import { useAutoSave, loadAutoSaved } from '@/lib/builder/useAutoSave'
import type { ArtworkItem, LibraryImage } from '@/lib/builder/types'
import { SHEETS, CANVAS_PPI } from '@/lib/builder/constants'
import { toast } from 'sonner'
import { alignToSheet, distributeEvenGap, type AlignAxis, type DistributeAxis } from '@/lib/builder/align'

// Konva must load client-side only
const Workspace = dynamic(() => import('@/components/builder/Workspace'), { ssr: false })

const LIB_KEY = 'nvm_builder_library_v1'

function loadLibrary(): LibraryImage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LIB_KEY)
    if (!raw) return []
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}
function persistLibrary(lib: LibraryImage[]) {
  try { window.localStorage.setItem(LIB_KEY, JSON.stringify(lib)) } catch {}
}

export default function BuilderClient() {
  // Hydration guard for localStorage
  const [hydrated, setHydrated] = useState(false)
  const { state, setLayout, setSheet, addItem, updateItem, setItems, removeItem, duplicateItem, reorder, select, clear, undo, redo, canUndo, canRedo } =
    useLayoutStore(emptyLayout('14x24'))

  const [library, setLibrary] = useState<LibraryImage[]>([])
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [snap, setSnap] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

  // Hydrate
  useEffect(() => {
    const saved = loadAutoSaved()
    if (saved) setLayout(saved)
    setLibrary(loadLibrary())
    setHydrated(true)
  }, [setLayout])

  useAutoSave(state.layout, hydrated)

  useEffect(() => { if (hydrated) persistLibrary(library) }, [library, hydrated])

  // Upload files -> /api/uploads -> add to library
  const addToLibrary = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 20)
    for (const file of arr) {
      if (file.type !== 'image/png') {
        toast.error(`${file.name}: PNG only`); continue
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: must be under 25 MB`); continue
      }
      try {
        const fd = new FormData(); fd.append('file', file)
        const r = await fetch('/api/uploads', { method: 'POST', body: fd })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Upload failed')
        // Read natural dimensions
        const dims = await readImageDims(j.artworkUrl)
        setLibrary((prev) => [{ id: cryptoId(), artworkUrl: j.artworkUrl, originalName: file.name, naturalWidthPx: dims.w, naturalHeightPx: dims.h }, ...prev])
      } catch (e: any) {
        toast.error(e?.message || 'Upload failed')
      }
    }
  }, [])

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const placeOnSheet = useCallback((lib: LibraryImage) => {
    const sheet = SHEETS[state.layout.sheetSizeId]
    // Default: fit within a 6" box, preserve aspect ratio, center on sheet
    const ar = lib.naturalWidthPx / Math.max(1, lib.naturalHeightPx)
    const maxW = Math.min(6, sheet.widthIn - 1)
    const maxH = Math.min(6, sheet.lengthIn - 1)
    let widthIn = maxW, heightIn = maxW / ar
    if (heightIn > maxH) { heightIn = maxH; widthIn = maxH * ar }
    const item: ArtworkItem = {
      id: cryptoId(),
      artworkUrl: lib.artworkUrl,
      originalName: lib.originalName,
      naturalWidthPx: lib.naturalWidthPx,
      naturalHeightPx: lib.naturalHeightPx,
      xIn: (sheet.widthIn - widthIn) / 2,
      yIn: (sheet.lengthIn - heightIn) / 2,
      widthIn,
      heightIn,
      rotationDeg: 0,
      zIndex: state.layout.items.length,
      aspectLocked: true,
    }
    addItem(item)
  }, [addItem, state.layout.sheetSizeId, state.layout.items.length])

  const handleClear = () => {
    if (state.layout.items.length === 0) return
    if (window.confirm('Remove all artwork from this sheet?')) clear()
  }

  // Alignment: single-selection → align that item vs sheet;
  //            no selection → align ALL items vs sheet.
  const handleAlign = useCallback((axis: AlignAxis) => {
    const items = state.layout.items
    if (items.length === 0) return
    const target = state.selectedId ? items.filter((it) => it.id === state.selectedId) : items
    const aligned = alignToSheet(target, axis, state.layout.sheetSizeId)
    const alignedById = new Map(aligned.map((it) => [it.id, it]))
    const next = items.map((it) => alignedById.get(it.id) || it)
    setItems(next)
  }, [state.layout.items, state.layout.sheetSizeId, state.selectedId, setItems])

  const handleDistribute = useCallback((axis: DistributeAxis) => {
    const items = state.layout.items
    if (items.length < 3) { toast.error('Need at least 3 items to distribute'); return }
    const next = distributeEvenGap(items, axis)
    setItems(next)
    toast.success(axis === 'hgap' ? 'Distributed horizontally' : 'Distributed vertically')
  }, [state.layout.items, setItems])

  // Compute fit zoom given container size (leave room for rulers)
  const fitZoom = useMemo(() => {
    const sheet = SHEETS[state.layout.sheetSizeId]
    const wPx = sheet.widthIn * CANVAS_PPI
    const hPx = sheet.lengthIn * CANVAS_PPI
    if (canvasSize.w < 100 || canvasSize.h < 100) return 1
    const RULER_GUTTER = 60
    const fx = (canvasSize.w - RULER_GUTTER) / wPx
    const fy = (canvasSize.h - RULER_GUTTER) / hPx
    return Math.max(0.1, Math.min(fx, fy))
  }, [canvasSize, state.layout.sheetSizeId])

  // Default 100% zoom; NEVER auto-fit — user controls zoom explicitly via toolbar.
  const lastSheet = useRef(state.layout.sheetSizeId)
  useEffect(() => {
    if (lastSheet.current !== state.layout.sheetSizeId) {
      lastSheet.current = state.layout.sheetSizeId
      // Intentionally do NOT change zoom when sheet size changes.
    }
  }, [state.layout.sheetSizeId])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) { e.preventDefault(); removeItem(state.selectedId) }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd' && state.selectedId) { e.preventDefault(); duplicateItem(state.selectedId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selectedId, undo, redo, removeItem, duplicateItem])

  const selectedItem = state.layout.items.find((it) => it.id === state.selectedId) || null
  const sheet = SHEETS[state.layout.sheetSizeId]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      <div className="container mx-auto px-3 sm:px-4 pt-4 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-xs text-neutral-400 hover:text-white">← Home</Link>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight">Gang Sheet Builder</h1>
          <span className="text-[11px] text-neutral-500">14″ wide · {sheet.lengthIn}″ long · ${sheet.price.toFixed(2)}</span>
          <div className="ml-auto flex items-center gap-2">
            <DesignManager layout={state.layout} onLoad={setLayout} />
          </div>
        </div>
        <div className="mt-3">
          <SizePicker value={state.layout.sheetSizeId} onChange={setSheet} />
        </div>
        <div className="mt-3">
          <UploadPanel
            library={library}
            onAddToLibrary={addToLibrary}
            onRemoveFromLibrary={removeFromLibrary}
            onPlaceOnSheet={placeOnSheet}
          />
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 flex-1 pt-3 pb-4">
        <div className="rounded-xl overflow-hidden border border-white/10 bg-neutral-950 flex flex-col" style={{ minHeight: '70vh' }}>
          <Toolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))}
            onZoomOut={() => setZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 100) / 100))}
            onFit={() => setZoom(fitZoom)}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((v) => !v)}
            snap={snap}
            onToggleSnap={() => setSnap((v) => !v)}
            onClear={handleClear}
            onAlign={handleAlign}
            onDistribute={handleDistribute}
            itemCount={state.layout.items.length}
            hasSelection={!!state.selectedId}
          />
          <div className="flex flex-col lg:flex-row flex-1 min-h-[60vh]">
            <div className="flex-1 relative min-h-[50vh]">
              <Workspace
                layout={state.layout}
                selectedId={state.selectedId}
                zoom={zoom}
                showGrid={showGrid}
                snap={snap}
                onSelect={select}
                onUpdate={updateItem}
                onCanvasSize={(w, h) => setCanvasSize({ w, h })}
              />
            </div>
            <Sidebar
              layout={state.layout}
              selectedItem={selectedItem}
              onUpdate={updateItem}
              onRemove={removeItem}
              onDuplicate={duplicateItem}
              onReorder={reorder}
            />
          </div>
          <CartBar layout={state.layout} />
        </div>
      </div>
    </div>
  )
}

async function readImageDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}
