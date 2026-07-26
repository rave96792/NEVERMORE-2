'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'

const CartCtx = createContext(null)
const STORAGE_KEY = 'nvm_cart_v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setItems(parsed)
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Persist on every change (post-hydration only)
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items, hydrated])

  const addItem = useCallback((item) => {
    setItems((prev) => [...prev, { ...item, id: item.id || cryptoId() }])
  }, [])

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id, quantity) => {
    const q = Math.max(1, Math.min(500, parseInt(quantity, 10) || 1))
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: q } : i)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const count = useMemo(() => items.reduce((s, i) => s + (i.quantity || 1), 0), [items])
  const subtotal = useMemo(
    () => Math.round(items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0) * 100) / 100,
    [items]
  )

  const value = useMemo(
    () => ({ items, hydrated, count, subtotal, addItem, removeItem, updateQuantity, clear }),
    [items, hydrated, count, subtotal, addItem, removeItem, updateQuantity, clear]
  )

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}

export function useCart() {
  const ctx = useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
