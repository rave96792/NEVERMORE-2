'use client'

import { Trash2, Copy, MoveUp, MoveDown, ArrowUpToLine, ArrowDownToLine, Lock, Unlock, RotateCw, X } from 'lucide-react'
import type { ArtworkItem, Layout } from '@/lib/builder/types'
import { itemDpi, bucketColor, bucketLabel } from '@/lib/builder/dpi'
import { CANVAS_PPI } from '@/lib/builder/constants'

interface Props {
  layout: Layout
  selectedItem: ArtworkItem | null
  onUpdate: (id: string, patch: Partial<ArtworkItem>) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onReorder: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void
}

export default function Sidebar(props: Props) {
  const { layout, selectedItem, onUpdate, onRemove, onDuplicate, onReorder } = props

  return (
    <aside className="flex flex-col h-full overflow-y-auto border-l border-white/10 bg-neutral-950 w-full lg:w-80">
      {/* Selected item inspector */}
      <div className="p-4 flex-1">
        <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-300 mb-3">Selected</div>
        {!selectedItem ? (
          <div className="text-xs text-neutral-500">Click an item on the sheet to edit its size, rotation, and layer.</div>
        ) : (
          <SelectedInspector
            item={selectedItem}
            onUpdate={(patch) => onUpdate(selectedItem.id, patch)}
            onRemove={() => onRemove(selectedItem.id)}
            onDuplicate={() => onDuplicate(selectedItem.id)}
            onReorder={(dir) => onReorder(selectedItem.id, dir)}
          />
        )}
      </div>

      {/* Bottom: layers list */}
      <div className="p-4 border-t border-white/10">
        <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Layers ({layout.items.length})</div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {[...layout.items].sort((a, b) => b.zIndex - a.zIndex).map((it) => (
            <div
              key={it.id}
              className="group flex items-center gap-2 rounded bg-white/[0.03] hover:bg-white/[0.06] px-2 py-1 text-xs cursor-pointer"
              onClick={() => onUpdate(it.id, {} as any)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.artworkUrl} alt="" className="h-5 w-5 object-contain" />
              <span className="flex-1 truncate text-neutral-300">{it.originalName || 'artwork'}</span>
              <span className="text-neutral-500 text-[10px]">{it.widthIn.toFixed(1)}×{it.heightIn.toFixed(1)}"</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(it.id) }}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 rounded p-1 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition"
                title="Delete this artwork"
                aria-label="Delete"
                data-testid={`b-layer-del-${it.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function SelectedInspector({ item, onUpdate, onRemove, onDuplicate, onReorder }: {
  item: ArtworkItem
  onUpdate: (patch: Partial<ArtworkItem>) => void
  onRemove: () => void
  onDuplicate: () => void
  onReorder: (dir: 'front' | 'back' | 'forward' | 'backward') => void
}) {
  const ar = item.naturalWidthPx / Math.max(1, item.naturalHeightPx)
  const dpi = itemDpi(item)

  const setWidth = (v: number) => {
    const widthIn = Math.max(0.25, Math.round(v * 100) / 100)
    const heightIn = item.aspectLocked ? Math.round((widthIn / ar) * 100) / 100 : item.heightIn
    onUpdate({ widthIn, heightIn })
  }
  const setHeight = (v: number) => {
    const heightIn = Math.max(0.25, Math.round(v * 100) / 100)
    const widthIn = item.aspectLocked ? Math.round((heightIn * ar) * 100) / 100 : item.widthIn
    onUpdate({ widthIn, heightIn })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.artworkUrl} alt="" className="h-12 w-12 rounded object-contain bg-white/5 p-1" />
        <div className="min-w-0">
          <div className="text-xs text-white truncate">{item.originalName || 'artwork'}</div>
          <div className={'text-[10px] ' + bucketColor(dpi.bucket)} data-testid="b-dpi">
            {dpi.effectiveDpi} DPI · {bucketLabel(dpi.bucket)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <label className="block">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Width (in)</span>
          <input
            type="number"
            step={0.25}
            min={0.25}
            value={item.widthIn.toFixed(2)}
            onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none"
            data-testid="b-w-in"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Height (in)</span>
          <input
            type="number"
            step={0.25}
            min={0.25}
            value={item.heightIn.toFixed(2)}
            onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none"
            data-testid="b-h-in"
          />
        </label>
      </div>
      <button
        onClick={() => onUpdate({ aspectLocked: !item.aspectLocked })}
        className={'inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] ' + (item.aspectLocked ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/15 bg-white/5 text-neutral-300')}
        data-testid="b-aspect-lock"
      >
        {item.aspectLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        {item.aspectLocked ? 'Aspect locked' : 'Aspect free'}
      </button>

      <div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Rotation</span>
        <div className="mt-1 flex items-center gap-1">
          <button onClick={() => onUpdate({ rotationDeg: item.rotationDeg - 90 })} className="rounded border border-white/10 bg-white/5 p-1 text-neutral-300 hover:text-white" title="-90°">
            <RotateCw className="h-3.5 w-3.5 rotate-180" />
          </button>
          <input
            type="number"
            step={1}
            value={Math.round(item.rotationDeg)}
            onChange={(e) => onUpdate({ rotationDeg: parseFloat(e.target.value) || 0 })}
            className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none"
          />
          <button onClick={() => onUpdate({ rotationDeg: item.rotationDeg + 90 })} className="rounded border border-white/10 bg-white/5 p-1 text-neutral-300 hover:text-white" title="+90°">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <button title="To back" onClick={() => onReorder('back')} className="rounded border border-white/10 bg-white/5 p-2 text-neutral-300 hover:text-white">
          <ArrowDownToLine className="h-4 w-4 mx-auto" />
        </button>
        <button title="Backward" onClick={() => onReorder('backward')} className="rounded border border-white/10 bg-white/5 p-2 text-neutral-300 hover:text-white">
          <MoveDown className="h-4 w-4 mx-auto" />
        </button>
        <button title="Forward" onClick={() => onReorder('forward')} className="rounded border border-white/10 bg-white/5 p-2 text-neutral-300 hover:text-white">
          <MoveUp className="h-4 w-4 mx-auto" />
        </button>
        <button title="To front" onClick={() => onReorder('front')} className="rounded border border-white/10 bg-white/5 p-2 text-neutral-300 hover:text-white">
          <ArrowUpToLine className="h-4 w-4 mx-auto" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onDuplicate} className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white hover:bg-white/10">
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <button onClick={onRemove} className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/20">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  )
}

// silence unused import in strict TS
void CANVAS_PPI
