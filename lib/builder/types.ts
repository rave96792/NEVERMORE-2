import type { SheetSizeId } from './constants'

export interface ArtworkItem {
  id: string
  artworkUrl: string
  originalName?: string
  naturalWidthPx: number
  naturalHeightPx: number
  xIn: number
  yIn: number
  widthIn: number
  heightIn: number
  rotationDeg: number
  zIndex: number
  aspectLocked: boolean
}

export interface LibraryImage {
  id: string
  artworkUrl: string
  originalName: string
  naturalWidthPx: number
  naturalHeightPx: number
}

export interface Layout {
  version: 1
  sheetSizeId: SheetSizeId
  items: ArtworkItem[]
  updatedAt: string
}

export interface SavedDesign {
  id: string
  name: string
  layout: Layout
  createdAt: string
  updatedAt: string
}

export type QualityBucket = 'GOOD' | 'WARN' | 'POOR'

export interface DpiReport {
  effectiveDpi: number
  bucket: QualityBucket
}
