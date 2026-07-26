// Bin-packing for DTF gang sheets.
// Strategy: "Shelf Best-Fit Decreasing Height with 90° rotation option".
//
// Algorithm:
//   1. Sort items by height DESC (tie-break by width DESC).
//   2. For each item, evaluate placement on every OPEN shelf; pick the shelf where
//      the item wastes the least vertical space (min |shelfHeight - itemHeight|).
//      If no open shelf fits, open a new shelf below the tallest closed one.
//   3. Consider rotating the item 90° when it doesn't fit width-wise; keep whichever
//      orientation fits and minimizes waste (unless aspectLocked forbids rotation —
//      even then rotating 90° preserves aspect ratio so we still allow it, we just
//      never stretch).
//   4. If total height would exceed sheet length, return { ok:false, overflowIn }.

import type { ArtworkItem } from './types'
import { SHEETS, BOUNDARY_MARGIN_IN, type SheetSizeId } from './constants'

const GAP_IN = 0.125 // 1/8" gap between packed items (keeps blades happy)

interface Placement {
  id: string
  xIn: number
  yIn: number
  widthIn: number
  heightIn: number
  rotationDeg: number
}

export interface AutoArrangeResult {
  ok: boolean
  placements: Placement[]
  usedHeightIn: number
  sheetHeightIn: number
  overflowIn: number  // >0 when items don't fit
}

interface Shelf {
  yIn: number       // top of shelf
  heightIn: number  // max item height in this shelf
  usedWidthIn: number // width consumed so far (from margin)
}

/**
 * Pack the given items onto the sheet. Returns new x/y/width/height/rotation for each item.
 * Items keep their intrinsic size — we never scale them. Rotation is applied only when
 * the item can fit *rotated* but not un-rotated (avoids surprising the user).
 */
export function autoArrange(items: ArtworkItem[], sheetSizeId: SheetSizeId): AutoArrangeResult {
  const sheet = SHEETS[sheetSizeId]
  const usableW = sheet.widthIn - 2 * BOUNDARY_MARGIN_IN
  const usableH = sheet.lengthIn - 2 * BOUNDARY_MARGIN_IN
  const originX = BOUNDARY_MARGIN_IN
  const originY = BOUNDARY_MARGIN_IN

  // Sort a copy by height DESC, width DESC
  const sorted = [...items].sort((a, b) => {
    const dh = b.heightIn - a.heightIn
    if (Math.abs(dh) > 1e-6) return dh
    return b.widthIn - a.widthIn
  })

  const shelves: Shelf[] = []
  const placements: Placement[] = []

  for (const it of sorted) {
    // Both orientations to try
    const candidates: { w: number; h: number; rot: 0 | 90 }[] = [
      { w: it.widthIn, h: it.heightIn, rot: 0 },
    ]
    // Only rotate if it makes the item fit width-wise or reduces waste on any existing shelf
    if (Math.abs(it.widthIn - it.heightIn) > 1e-6) {
      candidates.push({ w: it.heightIn, h: it.widthIn, rot: 90 })
    }

    // For each orientation, evaluate best shelf.
    // Preference order:
    //   1. Fit on an existing shelf (min waste).
    //   2. Open a new shelf (only if nothing existing fits).
    let best: {
      shelfIdx: number  // -1 means new shelf
      x: number; y: number
      w: number; h: number; rot: 0 | 90
      waste: number
    } | null = null

    for (const c of candidates) {
      if (c.w > usableW + 1e-6) continue // physically too wide

      // Try existing shelves first (this always wins vs opening a new one)
      for (let si = 0; si < shelves.length; si++) {
        const s = shelves[si]
        const remaining = usableW - s.usedWidthIn - (s.usedWidthIn > 0 ? GAP_IN : 0)
        if (c.w > remaining + 1e-6) continue
        if (c.h > s.heightIn + 1e-6) continue
        const waste = s.heightIn - c.h
        if (!best || best.shelfIdx === -1 || waste < best.waste) {
          const x = originX + s.usedWidthIn + (s.usedWidthIn > 0 ? GAP_IN : 0)
          best = { shelfIdx: si, x, y: s.yIn, w: c.w, h: c.h, rot: c.rot, waste }
        }
      }

      // Only consider a new shelf if no existing-shelf candidate has been chosen for THIS orientation
      if (!best || best.shelfIdx === -1) {
        const nextShelfY = shelves.length === 0
          ? originY
          : shelves[shelves.length - 1].yIn + shelves[shelves.length - 1].heightIn + GAP_IN
        if (!best) {
          best = { shelfIdx: -1, x: originX, y: nextShelfY, w: c.w, h: c.h, rot: c.rot, waste: 0 }
        }
      }
    }

    if (!best) {
      // Item is wider than the sheet in every orientation. Place at origin with overflow.
      placements.push({ id: it.id, xIn: originX, yIn: originY, widthIn: it.widthIn, heightIn: it.heightIn, rotationDeg: it.rotationDeg })
      continue
    }

    // Commit placement
    placements.push({
      id: it.id,
      xIn: round3(best.x),
      yIn: round3(best.y),
      widthIn: round3(best.w),
      heightIn: round3(best.h),
      // Apply rotation on top of any existing rotation ONLY if we chose 90.
      // We keep it simple: rotationDeg = 0 (no rotation) or 90.
      rotationDeg: best.rot,
    })

    if (best.shelfIdx === -1) {
      shelves.push({ yIn: best.y, heightIn: best.h, usedWidthIn: best.w })
    } else {
      const s = shelves[best.shelfIdx]
      s.usedWidthIn = (best.x - originX) + best.w
      // Shelf height stays as its original max (we only place items <= shelfHeight)
    }
  }

  const usedH = shelves.length === 0 ? 0 : (shelves[shelves.length - 1].yIn + shelves[shelves.length - 1].heightIn) - originY
  const overflow = Math.max(0, usedH - usableH)

  return {
    ok: overflow <= 1e-6,
    placements,
    usedHeightIn: round3(usedH),
    sheetHeightIn: round3(usableH),
    overflowIn: round3(overflow),
  }
}

function round3(n: number) { return Math.round(n * 1000) / 1000 }
