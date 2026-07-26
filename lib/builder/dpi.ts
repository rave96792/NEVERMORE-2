import type { ArtworkItem, DpiReport, QualityBucket } from './types'

export function qualityBucket(dpi: number): QualityBucket {
  if (dpi >= 300) return 'GOOD'
  if (dpi >= 150) return 'WARN'
  return 'POOR'
}

export function itemDpi(item: ArtworkItem): DpiReport {
  const dpiW = item.naturalWidthPx / Math.max(0.01, item.widthIn)
  const dpiH = item.naturalHeightPx / Math.max(0.01, item.heightIn)
  const dpi = Math.min(dpiW, dpiH)
  return { effectiveDpi: Math.round(dpi), bucket: qualityBucket(dpi) }
}

export function bucketLabel(b: QualityBucket): string {
  return b === 'GOOD' ? 'Print ready' : b === 'WARN' ? 'Low resolution' : 'Too low for print'
}

export function bucketColor(b: QualityBucket): string {
  return b === 'GOOD' ? 'text-emerald-400' : b === 'WARN' ? 'text-yellow-400' : 'text-red-400'
}
