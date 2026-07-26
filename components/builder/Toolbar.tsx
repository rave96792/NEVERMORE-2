'use client'

import { Undo2, Redo2, Maximize2, ZoomIn, ZoomOut, Grid3x3, Magnet, Trash } from 'lucide-react'

interface Props {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  showGrid: boolean
  onToggleGrid: () => void
  snap: boolean
  onToggleSnap: () => void
  onClear: () => void
}

export default function Toolbar(p: Props) {
  const btn = 'inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition'
  const active = 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300'
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/60 backdrop-blur px-3 py-2">
      <button className={btn} onClick={p.onUndo} disabled={!p.canUndo} title="Undo"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
      <button className={btn} onClick={p.onRedo} disabled={!p.canRedo} title="Redo"><Redo2 className="h-3.5 w-3.5" /> Redo</button>
      <div className="w-px h-4 bg-white/10 mx-1" />
      <button className={btn} onClick={p.onZoomOut} title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
      <span className="text-[11px] text-neutral-400 w-12 text-center" data-testid="b-zoom">{Math.round(p.zoom * 100)}%</span>
      <button className={btn} onClick={p.onZoomIn} title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={p.onFit} title="Fit sheet"><Maximize2 className="h-3.5 w-3.5" /> Fit</button>
      <div className="w-px h-4 bg-white/10 mx-1" />
      <button className={btn + ' ' + (p.showGrid ? active : '')} onClick={p.onToggleGrid} title="Grid"><Grid3x3 className="h-3.5 w-3.5" /> Grid</button>
      <button className={btn + ' ' + (p.snap ? active : '')} onClick={p.onToggleSnap} title="Snap"><Magnet className="h-3.5 w-3.5" /> Snap</button>
      <div className="ml-auto">
        <button className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/20" onClick={p.onClear}>
          <Trash className="h-3.5 w-3.5" /> Clear sheet
        </button>
      </div>
    </div>
  )
}
