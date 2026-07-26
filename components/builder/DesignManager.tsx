'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, Save, Trash2, Copy, Pencil } from 'lucide-react'
import type { Layout } from '@/lib/builder/types'
import { loadDesigns, saveDesigns, type StoredDesign } from '@/lib/builder/useAutoSave'
import { toast } from 'sonner'

interface Props {
  layout: Layout
  onLoad: (l: Layout) => void
}

export default function DesignManager({ layout, onLoad }: Props) {
  const [open, setOpen] = useState(false)
  const [designs, setDesigns] = useState<StoredDesign[]>([])
  const [name, setName] = useState('')

  useEffect(() => { setDesigns(loadDesigns()) }, [open])

  const persist = (list: StoredDesign[]) => { setDesigns(list); saveDesigns(list) }

  const save = () => {
    const trimmed = name.trim() || `Design ${new Date().toLocaleDateString()}`
    const now = new Date().toISOString()
    const entry: StoredDesign = { id: cryptoId(), name: trimmed, layout, createdAt: now, updatedAt: now }
    persist([entry, ...designs])
    setName('')
    toast.success('Design saved')
  }

  const rename = (id: string) => {
    const newName = window.prompt('New name?')
    if (!newName) return
    persist(designs.map((d) => d.id === id ? { ...d, name: newName, updatedAt: new Date().toISOString() } : d))
  }

  const dup = (d: StoredDesign) => {
    const copy: StoredDesign = { ...d, id: cryptoId(), name: d.name + ' copy', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    persist([copy, ...designs])
    toast.success('Duplicated')
  }

  const del = (id: string) => {
    if (!window.confirm('Delete this saved design?')) return
    persist(designs.filter((d) => d.id !== id))
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/10">
        <FolderOpen className="h-3.5 w-3.5" /> Designs
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">My Designs</h3>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Save current layout as…"
                className="flex-1 rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              />
              <button onClick={save} className="inline-flex items-center gap-1 rounded bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-xs font-bold uppercase tracking-widest px-3 py-2">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
            <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-white/5">
              {designs.length === 0 && <div className="text-xs text-neutral-500 py-6 text-center">No saved designs yet.</div>}
              {designs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{d.name}</div>
                    <div className="text-[10px] text-neutral-500">{d.layout.sheetSizeId} · {d.layout.items.length} items · {new Date(d.updatedAt).toLocaleString()}</div>
                  </div>
                  <button onClick={() => { onLoad(d.layout); setOpen(false); toast.success(`Loaded "${d.name}"`) }} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white hover:bg-white/10">Open</button>
                  <button onClick={() => rename(d.id)} title="Rename" className="rounded border border-white/10 bg-white/5 p-1.5 text-neutral-300 hover:text-white"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => dup(d)} title="Duplicate" className="rounded border border-white/10 bg-white/5 p-1.5 text-neutral-300 hover:text-white"><Copy className="h-3 w-3" /></button>
                  <button onClick={() => del(d.id)} title="Delete" className="rounded border border-red-500/30 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
