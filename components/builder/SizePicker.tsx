'use client'

import { SHEETS, SHEET_LIST, type SheetSizeId } from '@/lib/builder/constants'
import { Check } from 'lucide-react'

interface Props {
  value: SheetSizeId
  onChange: (id: SheetSizeId) => void
}

export default function SizePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SHEET_LIST.map((s) => {
        const active = s.id === value
        return (
          <button
            key={s.id}
            type="button"
            data-testid={`b-sheet-${s.id}`}
            onClick={() => onChange(s.id)}
            className={
              'group relative rounded-lg border p-3 text-left transition ' +
              (active
                ? 'border-fuchsia-500 bg-fuchsia-500/10 shadow-[0_0_20px_rgba(217,70,239,0.25)]'
                : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10')
            }
          >
            <div className="text-xs font-bold text-white">{s.label}</div>
            <div className="mt-0.5 text-[10px] text-neutral-400">${s.price.toFixed(2)}</div>
            {active && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-fuchsia-400" />}
          </button>
        )
      })}
    </div>
  )
}

// keep referenced
void SHEETS
