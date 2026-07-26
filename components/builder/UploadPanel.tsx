'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, Trash2, Images, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { LibraryImage } from '@/lib/builder/types'
import { toast } from 'sonner'

interface Props {
  library: LibraryImage[]
  onAddToLibrary: (files: FileList | File[]) => void
  onRemoveFromLibrary: (id: string) => void
  onPlaceOnSheet: (lib: LibraryImage) => void
}

export default function UploadPanel({ library, onAddToLibrary, onRemoveFromLibrary, onPlaceOnSheet }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(true)

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    onAddToLibrary(files)
  }, [onAddToLibrary])

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950">
      {/* Header — always visible; click to collapse/expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        data-testid="b-lib-toggle"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
        <span className="text-xs font-bold uppercase tracking-widest text-fuchsia-300 inline-flex items-center gap-1">
          <Images className="h-3.5 w-3.5" /> Artwork Library
        </span>
        <span className="text-[10px] text-neutral-500">{library.length} item{library.length === 1 ? '' : 's'}</span>

        {/* Inline row of icon thumbnails when collapsed, tail-aligned */}
        {!open && library.length > 0 && (
          <div className="ml-2 flex items-center gap-1 flex-1 overflow-x-auto">
            {library.slice(0, 10).map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.artworkUrl}
                alt=""
                className="h-6 w-6 rounded object-contain bg-white/5 border border-white/10 cursor-pointer flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onPlaceOnSheet(img); toast.success('Placed on sheet') }}
                draggable={false}
                title={img.originalName}
              />
            ))}
            {library.length > 10 && <span className="text-[10px] text-neutral-500 ml-1">+{library.length - 10}</span>}
          </div>
        )}

        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
          className="ml-auto inline-flex items-center gap-1 rounded bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-[11px] font-bold uppercase tracking-widest px-2.5 py-1.5"
          data-testid="b-upload-btn"
        >
          <UploadCloud className="h-3.5 w-3.5" /> Upload
        </span>
      </button>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
        data-testid="b-file-input"
      />

      {/* Body */}
      {open && (
        <div className="px-3 pb-3 border-t border-white/5 pt-3">
          {library.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.06] py-3 text-center transition"
            >
              <UploadCloud className="mx-auto h-4 w-4 text-neutral-400 mb-1" />
              <div className="text-xs text-white">Drop PNG · JPG · WEBP or click to browse</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Multi-select supported</div>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {library.map((img) => (
                <div
                  key={img.id}
                  className="group relative h-12 w-12 rounded overflow-hidden border border-white/10 bg-white/5 flex-shrink-0"
                  title={img.originalName}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.artworkUrl}
                    alt={img.originalName}
                    className="h-full w-full object-contain cursor-pointer"
                    onClick={() => { onPlaceOnSheet(img); toast.success('Placed on sheet') }}
                    draggable={false}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(img.id) }}
                    className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 rounded-bl bg-black/70 p-0.5 text-white"
                    title="Remove"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="h-12 w-12 rounded border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.06] flex items-center justify-center text-neutral-400 hover:text-white transition"
                title="Add more artwork"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
