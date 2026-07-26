'use client'

import { useEffect, useRef } from 'react'
import type { Layout } from './types'

const KEY = 'nvm_builder_current_v1'

export function loadAutoSaved(): Layout | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.version === 1 && parsed.sheetSizeId && Array.isArray(parsed.items)) {
      return parsed as Layout
    }
  } catch {}
  return null
}

export function useAutoSave(layout: Layout, enabled = true, delay = 400) {
  const timer = useRef<any>(null)
  useEffect(() => {
    if (!enabled) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(layout))
      } catch {}
    }, delay)
    return () => timer.current && clearTimeout(timer.current)
  }, [layout, enabled, delay])
}

// --- Named designs library ---
const DESIGNS_KEY = 'nvm_builder_designs_v1'

export interface StoredDesign {
  id: string
  name: string
  layout: Layout
  createdAt: string
  updatedAt: string
}

export function loadDesigns(): StoredDesign[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DESIGNS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDesigns(list: StoredDesign[]): void {
  try {
    window.localStorage.setItem(DESIGNS_KEY, JSON.stringify(list))
  } catch {}
}
