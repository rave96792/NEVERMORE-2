// Pure alignment / distribution helpers. Operates on ArtworkItem arrays in inch coordinates.
// No React, no Konva — safe to unit-test.

import type { ArtworkItem } from './types'
import { SHEETS, BOUNDARY_MARGIN_IN, type SheetSizeId } from './constants'

export type AlignAxis =
  | 'left' | 'hcenter' | 'right'
  | 'top' | 'vcenter' | 'bottom'

export type DistributeAxis = 'hgap' | 'vgap'

function round3(n: number) { return Math.round(n * 1000) / 1000 }

/**
 * Align the given items to the sheet's inner (safe-margin) bounds.
 * If items has 0 or 1 elements, still applies the single-item alignment to sheet.
 */
export function alignToSheet(items: ArtworkItem[], axis: AlignAxis, sheetSizeId: SheetSizeId): ArtworkItem[] {
  const sheet = SHEETS[sheetSizeId]
  const m = BOUNDARY_MARGIN_IN
  const innerLeft = m
  const innerRight = sheet.widthIn - m
  const innerTop = m
  const innerBottom = sheet.lengthIn - m

  return items.map((it) => {
    let x = it.xIn
    let y = it.yIn
    switch (axis) {
      case 'left':    x = innerLeft; break
      case 'right':   x = innerRight - it.widthIn; break
      case 'hcenter': x = (sheet.widthIn - it.widthIn) / 2; break
      case 'top':     y = innerTop; break
      case 'bottom':  y = innerBottom - it.heightIn; break
      case 'vcenter': y = (sheet.lengthIn - it.heightIn) / 2; break
    }
    return { ...it, xIn: round3(x), yIn: round3(y) }
  })
}

/**
 * Distribute items so that the GAPS between them (along the chosen axis) are equal.
 * Requires at least 3 items to be meaningful — for <3 the input is returned unchanged.
 * The two extreme items stay pinned; the middle ones are spread evenly.
 */
export function distributeEvenGap(items: ArtworkItem[], axis: DistributeAxis): ArtworkItem[] {
  if (items.length < 3) return items
  const isH = axis === 'hgap'
  const sorted = [...items].sort((a, b) => (isH ? a.xIn - b.xIn : a.yIn - b.yIn))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const firstEnd = isH ? first.xIn + first.widthIn : first.yIn + first.heightIn
  const lastStart = isH ? last.xIn : last.yIn
  const totalSpan = lastStart - firstEnd
  const innerCount = sorted.length - 2

  // sum of inner widths/heights
  let innerSize = 0
  for (let i = 1; i < sorted.length - 1; i++) innerSize += isH ? sorted[i].widthIn : sorted[i].heightIn
  const totalGap = totalSpan - innerSize
  if (totalGap <= 0) return items // overlapping — refuse to make it worse
  const gap = totalGap / (innerCount + 1)

  let cursor = firstEnd + gap
  const updates = new Map<string, Partial<ArtworkItem>>()
  for (let i = 1; i < sorted.length - 1; i++) {
    const it = sorted[i]
    if (isH) updates.set(it.id, { xIn: round3(cursor) })
    else     updates.set(it.id, { yIn: round3(cursor) })
    cursor += (isH ? it.widthIn : it.heightIn) + gap
  }
  return items.map((it) => (updates.has(it.id) ? { ...it, ...updates.get(it.id)! } : it))
}

// -------------- LIVE SNAP GUIDES (for drag) --------------

export interface SnapGuide {
  orientation: 'v' | 'h'  // vertical line for x-axis alignment, horizontal for y-axis
  atIn: number            // inch coordinate on the perpendicular axis
}

export interface SnapResult {
  xIn: number
  yIn: number
  guides: SnapGuide[]
}

/**
 * Compute the snapped x/y for the currently-dragged item and which guide lines to draw.
 * Snap thresholds are provided in inches (typically 4px / CANVAS_PPI ≈ 0.13").
 * Compares against the sheet's left/hcenter/right & top/vcenter/bottom AND each OTHER item's
 * left/hcenter/right and top/vcenter/bottom.
 */
export function computeSnapGuides(params: {
  drag: { xIn: number; yIn: number; widthIn: number; heightIn: number; id: string }
  others: ArtworkItem[]
  sheetSizeId: SheetSizeId
  tolIn: number  // e.g. 4/30 for 4px at CANVAS_PPI=30
}): SnapResult {
  const { drag, others, sheetSizeId, tolIn } = params
  const sheet = SHEETS[sheetSizeId]

  // Candidate x guides (vertical lines)
  const xCand: number[] = [0, sheet.widthIn / 2, sheet.widthIn]
  // Candidate y guides
  const yCand: number[] = [0, sheet.lengthIn / 2, sheet.lengthIn]

  for (const o of others) {
    if (o.id === drag.id) continue
    xCand.push(o.xIn, o.xIn + o.widthIn / 2, o.xIn + o.widthIn)
    yCand.push(o.yIn, o.yIn + o.heightIn / 2, o.yIn + o.heightIn)
  }

  const dragEdges = {
    left: drag.xIn,
    hc: drag.xIn + drag.widthIn / 2,
    right: drag.xIn + drag.widthIn,
    top: drag.yIn,
    vc: drag.yIn + drag.heightIn / 2,
    bottom: drag.yIn + drag.heightIn,
  }

  let snappedX = drag.xIn
  let snappedY = drag.yIn
  const guides: SnapGuide[] = []

  // X-axis: check each of left/hc/right against each xCand
  let bestX: { target: number; delta: number; edge: 'left' | 'hc' | 'right' } | null = null
  for (const t of xCand) {
    for (const edge of ['left', 'hc', 'right'] as const) {
      const d = t - dragEdges[edge]
      const ad = Math.abs(d)
      if (ad <= tolIn && (bestX == null || ad < Math.abs(bestX.delta))) {
        bestX = { target: t, delta: d, edge }
      }
    }
  }
  if (bestX) {
    snappedX = drag.xIn + bestX.delta
    guides.push({ orientation: 'v', atIn: bestX.target })
  }

  let bestY: { target: number; delta: number; edge: 'top' | 'vc' | 'bottom' } | null = null
  for (const t of yCand) {
    for (const edge of ['top', 'vc', 'bottom'] as const) {
      const d = t - dragEdges[edge]
      const ad = Math.abs(d)
      if (ad <= tolIn && (bestY == null || ad < Math.abs(bestY.delta))) {
        bestY = { target: t, delta: d, edge }
      }
    }
  }
  if (bestY) {
    snappedY = drag.yIn + bestY.delta
    guides.push({ orientation: 'h', atIn: bestY.target })
  }

  return { xIn: snappedX, yIn: snappedY, guides }
}
