import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { Construction, Mail, ArrowRight, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'Shop · Nevermore DTF',
  description: 'The Nevermore DTF merch shop is under construction. Contact us for custom orders.',
}

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="container mx-auto px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 flex items-center justify-center shadow-[0_0_50px_rgba(217,70,239,0.35)]">
            <Construction className="h-9 w-9 text-fuchsia-300" />
          </div>

          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
            <Sparkles className="h-3.5 w-3.5" /> COMING SOON
          </span>

          <h1 className="mt-4 text-4xl sm:text-6xl font-black tracking-tight">
            Shop <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">under construction.</span>
          </h1>

          <p className="mt-5 text-neutral-300 max-w-xl mx-auto">
            We&rsquo;re stocking the shelves. Tees, hoodies, caps, stickers &mdash; the full Nevermore merch line drops soon. In the meantime, hit us up for custom orders and bulk pricing.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-bold uppercase tracking-widest px-6 py-3 shadow-[0_0_30px_rgba(217,70,239,0.4)] transition"
            >
              <Mail className="h-4 w-4" /> Contact Us
            </Link>
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-bold uppercase tracking-widest px-6 py-3 transition"
            >
              Open Gang Sheet Builder <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
            <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-300 mb-3">What&rsquo;s coming</div>
            <ul className="grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
              {[
                'Heavyweight cotton tees',
                'Fleece-lined pullovers',
                'Snapback caps',
                'Vinyl sticker packs',
                'Ceramic mugs',
                'Canvas tote bags',
              ].map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
