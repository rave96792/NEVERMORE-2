// Single source of truth for the builder's numeric system.
// PRIMARY UNIT: inches. Pixels are derived at render time.

export const CANVAS_PPI = 30 // px/in on screen at zoom=1
export const EXPORT_PPI = 300 // px/in for print-ready composite
export const GRID_IN = 0.25 // quarter-inch grid
export const SNAP_IN = 0.125 // 1/8" snap when snapping enabled
export const BOUNDARY_MARGIN_IN = 0.125 // safe margin from sheet edges
export const MIN_ITEM_IN = 0.25 // min artwork side

export type SheetSizeId =
  | '14x12' | '14x24' | '14x36' | '14x48' | '14x60'
  | '14x72' | '14x84' | '14x96' | '14x120'

export interface SheetSize {
  id: SheetSizeId
  label: string
  widthIn: 14
  lengthIn: number
  price: number // USD
}

// Prices track roughly $0.036/sq-in with round-friendly numbers.
export const SHEETS: Record<SheetSizeId, SheetSize> = {
  '14x12':  { id: '14x12',  label: '14\" × 12\"',  widthIn: 14, lengthIn: 12,  price: 10.00 },
  '14x24':  { id: '14x24',  label: '14\" × 24\"',  widthIn: 14, lengthIn: 24,  price: 14.00 },
  '14x36':  { id: '14x36',  label: '14\" × 36\"',  widthIn: 14, lengthIn: 36,  price: 18.00 },
  '14x48':  { id: '14x48',  label: '14\" × 48\"',  widthIn: 14, lengthIn: 48,  price: 22.00 },
  '14x60':  { id: '14x60',  label: '14\" × 60\"',  widthIn: 14, lengthIn: 60,  price: 26.00 },
  '14x72':  { id: '14x72',  label: '14\" × 72\"',  widthIn: 14, lengthIn: 72,  price: 30.00 },
  '14x84':  { id: '14x84',  label: '14\" × 84\"',  widthIn: 14, lengthIn: 84,  price: 34.00 },
  '14x96':  { id: '14x96',  label: '14\" × 96\"',  widthIn: 14, lengthIn: 96,  price: 37.00 },
  '14x120': { id: '14x120', label: '14\" × 120\"', widthIn: 14, lengthIn: 120, price: 40.00 },
}

export const SHEET_LIST: SheetSize[] = Object.values(SHEETS)
