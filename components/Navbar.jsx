'use client'

import Link from 'next/link'
import { ShoppingCart, Menu } from 'lucide-react'
import { useCart } from '@/components/CartProvider'
import { Badge } from '@/components/ui/badge'

export default function Navbar() {
  const { count, hydrated } = useCart()
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-[0_0_20px_rgba(217,70,239,0.5)]" />
          <span className="font-black tracking-[0.2em] text-white text-sm sm:text-base">NEVERMORE<span className="text-fuchsia-400">.DTF</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-300">
          <Link href="/builder" className="hover:text-white transition">Gang Sheet Builder</Link>
          <Link href="/shop" className="hover:text-white transition">Shop</Link>
          <Link href="/contact" className="hover:text-white transition">Contact</Link>
          <Link href="/#faq" className="hover:text-white transition">FAQ</Link>
        </nav>
        <Link
          href="/cart"
          className="relative inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition"
          data-testid="nav-cart-link"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
          {hydrated && count > 0 && (
            <Badge
              data-testid="nav-cart-badge"
              className="absolute -right-2 -top-2 h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1.5 text-[10px] font-bold text-white border-0 shadow-[0_0_10px_rgba(217,70,239,0.7)]"
            >
              {count}
            </Badge>
          )}
        </Link>
      </div>
    </header>
  )
}
