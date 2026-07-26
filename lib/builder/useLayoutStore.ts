'use client'

import { useCallback, useMemo, useReducer, useRef } from 'react'
import type { ArtworkItem, Layout } from './types'
import { SHEETS, type SheetSizeId, BOUNDARY_MARGIN_IN, MIN_ITEM_IN } from './constants'

type State = {
  layout: Layout
  selectedId: string | null
  history: Layout[]
  future: Layout[]
}

type Action =
  | { type: 'SET_LAYOUT'; layout: Layout }
  | { type: 'SET_SHEET'; sheetSizeId: SheetSizeId }
  | { type: 'ADD_ITEM'; item: ArtworkItem }
  | { type: 'UPDATE_ITEM'; id: string; patch: Partial<ArtworkItem> }
  | { type: 'SET_ITEMS'; items: ArtworkItem[] }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'DUPLICATE_ITEM'; id: string }
  | { type: 'REORDER'; id: string; dir: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'SELECT'; id: string | null }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

function clampItem(item: ArtworkItem, sheetSizeId: SheetSizeId): ArtworkItem {
  const s = SHEETS[sheetSizeId]
  const minW = MIN_ITEM_IN
  const maxW = s.widthIn - 2 * BOUNDARY_MARGIN_IN
  const maxH = s.lengthIn - 2 * BOUNDARY_MARGIN_IN
  let widthIn = Math.max(minW, Math.min(item.widthIn, maxW))
  let heightIn = Math.max(minW, Math.min(item.heightIn, maxH))
  const xIn = Math.max(BOUNDARY_MARGIN_IN, Math.min(item.xIn, s.widthIn - BOUNDARY_MARGIN_IN - widthIn))
  const yIn = Math.max(BOUNDARY_MARGIN_IN, Math.min(item.yIn, s.lengthIn - BOUNDARY_MARGIN_IN - heightIn))
  return { ...item, widthIn, heightIn, xIn, yIn }
}

function commit(prev: Layout, next: Layout['items'], sheetSizeId?: SheetSizeId): Layout {
  const id: SheetSizeId = sheetSizeId || prev.sheetSizeId
  return {
    version: 1,
    sheetSizeId: id,
    items: next.map((it) => clampItem(it, id)).map((it, i, arr) => ({ ...it, zIndex: it.zIndex ?? i })),
    updatedAt: new Date().toISOString(),
  }
}

function reducer(state: State, action: Action): State {
  const push = (next: Layout): State => ({
    ...state,
    layout: next,
    history: [...state.history, state.layout].slice(-50),
    future: [],
  })

  switch (action.type) {
    case 'SET_LAYOUT':
      return { ...state, layout: action.layout, history: [], future: [] }
    case 'SET_SHEET': {
      if (action.sheetSizeId === state.layout.sheetSizeId) return state
      const next = commit(state.layout, state.layout.items, action.sheetSizeId)
      return push(next)
    }
    case 'ADD_ITEM': {
      const nextItems = [...state.layout.items, { ...action.item, zIndex: state.layout.items.length }]
      return { ...push(commit(state.layout, nextItems)), selectedId: action.item.id }
    }
    case 'UPDATE_ITEM': {
      const nextItems = state.layout.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it))
      return push(commit(state.layout, nextItems))
    }
    case 'SET_ITEMS': {
      return push(commit(state.layout, action.items))
    }
    case 'REMOVE_ITEM': {
      const nextItems = state.layout.items.filter((it) => it.id !== action.id)
      return { ...push(commit(state.layout, nextItems)), selectedId: null }
    }
    case 'DUPLICATE_ITEM': {
      const src = state.layout.items.find((it) => it.id === action.id)
      if (!src) return state
      const copy: ArtworkItem = {
        ...src,
        id: cryptoId(),
        xIn: src.xIn + 0.5,
        yIn: src.yIn + 0.5,
        zIndex: state.layout.items.length,
      }
      return { ...push(commit(state.layout, [...state.layout.items, copy])), selectedId: copy.id }
    }
    case 'REORDER': {
      const items = [...state.layout.items].sort((a, b) => a.zIndex - b.zIndex)
      const idx = items.findIndex((i) => i.id === action.id)
      if (idx < 0) return state
      let newIdx = idx
      if (action.dir === 'front') newIdx = items.length - 1
      else if (action.dir === 'back') newIdx = 0
      else if (action.dir === 'forward') newIdx = Math.min(items.length - 1, idx + 1)
      else if (action.dir === 'backward') newIdx = Math.max(0, idx - 1)
      const [moved] = items.splice(idx, 1)
      items.splice(newIdx, 0, moved)
      const rezoned = items.map((it, i) => ({ ...it, zIndex: i }))
      return push(commit(state.layout, rezoned))
    }
    case 'SELECT':
      return { ...state, selectedId: action.id }
    case 'CLEAR':
      return { ...push(commit(state.layout, [])), selectedId: null }
    case 'UNDO': {
      const prev = state.history[state.history.length - 1]
      if (!prev) return state
      return {
        ...state,
        layout: prev,
        history: state.history.slice(0, -1),
        future: [state.layout, ...state.future].slice(0, 50),
      }
    }
    case 'REDO': {
      const [next, ...rest] = state.future
      if (!next) return state
      return {
        ...state,
        layout: next,
        history: [...state.history, state.layout].slice(-50),
        future: rest,
      }
    }
    default:
      return state
  }
}

export function cryptoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function emptyLayout(sheetSizeId: SheetSizeId = '14x24'): Layout {
  return { version: 1, sheetSizeId, items: [], updatedAt: new Date().toISOString() }
}

export function useLayoutStore(initial?: Layout) {
  const initialState: State = {
    layout: initial || emptyLayout(),
    selectedId: null,
    history: [],
    future: [],
  }
  const [state, dispatch] = useReducer(reducer, initialState)
  const ref = useRef(state)
  ref.current = state

  const api = useMemo(
    () => ({
      setLayout: (layout: Layout) => dispatch({ type: 'SET_LAYOUT', layout }),
      setSheet: (sheetSizeId: SheetSizeId) => dispatch({ type: 'SET_SHEET', sheetSizeId }),
      addItem: (item: ArtworkItem) => dispatch({ type: 'ADD_ITEM', item }),
      updateItem: (id: string, patch: Partial<ArtworkItem>) => dispatch({ type: 'UPDATE_ITEM', id, patch }),
      setItems: (items: ArtworkItem[]) => dispatch({ type: 'SET_ITEMS', items }),
      removeItem: (id: string) => dispatch({ type: 'REMOVE_ITEM', id }),
      duplicateItem: (id: string) => dispatch({ type: 'DUPLICATE_ITEM', id }),
      reorder: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => dispatch({ type: 'REORDER', id, dir }),
      select: (id: string | null) => dispatch({ type: 'SELECT', id }),
      clear: () => dispatch({ type: 'CLEAR' }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
    }),
    []
  )

  const canUndo = state.history.length > 0
  const canRedo = state.future.length > 0

  return { state, ...api, canUndo, canRedo }
}
