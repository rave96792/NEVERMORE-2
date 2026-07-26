'use client'

import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { ArrowRight, Palette, Zap, MousePointerClick } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(217,70,239,0.25),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.2),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>
        <div className="container mx-auto px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 animate-pulse" /> DTF PRINTING · SHIPS IN 48 HOURS
            </span>
            <h1 className="mt-6 text-5xl sm:text-7xl font-black tracking-tight leading-[0.95]">
              High quality vibrant <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">Prints.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-neutral-300">
              Nevermore DTF prints your designs as Direct-to-Film transfers. Load a gang sheet, press it on cotton, poly, tri-blend &mdash; whatever. Vivid color.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/builder"
                className="inline-flex items-center gap-2 rounded-md bg-fuchsia-500 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_30px_rgba(217,70,239,0.5)] hover:bg-fuchsia-400 transition"
                data-testid="hero-cta"
              >
                Open Gang Sheet Builder <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#how" className="text-sm text-neutral-300 hover:text-white transition">How it works &rarr;</Link>
            </div>
            <div className="mt-14 grid grid-cols-2 gap-6 max-w-md">
              {[
                { icon: Zap, k: '48hr', v: 'Turnaround' },
                { icon: Palette, k: 'CMYK+W', v: 'Full Color' },
              ].map(({ icon: Icon, k, v }) => (
                <div key={k} className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-fuchsia-400 mt-0.5" />
                  <div>
                    <div className="text-lg font-bold text-white leading-none">{k}</div>
                    <div className="text-xs text-neutral-400 mt-1">{v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="builder" className="relative border-t border-white/10 py-20 bg-neutral-950/50">
        <div className="container mx-auto px-4 grid gap-8 lg:grid-cols-[1.2fr_1fr] items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
              <MousePointerClick className="h-3.5 w-3.5" /> INTERACTIVE CANVAS · LIVE DPI CHECK
            </span>
            <h2 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight">Design your gang sheet, click by click.</h2>
            <p className="mt-4 max-w-lg text-neutral-400">
              Drop multiple artworks into the sidebar, drag them onto a 14&quot;-wide sheet, resize by the inch, rotate, layer, and check effective print DPI in real time. We compose the final print at 300 DPI — never a screenshot.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2 max-w-lg">
              {['9 stock sheet sizes', 'Free drag placement', 'Aspect-locked resize', 'Rotate & layer order', 'Undo / redo · autosave', 'DPI quality warnings'].map((f) => (
                <li key={f} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-fuchsia-400" />{f}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/builder" className="inline-flex items-center gap-2 rounded-md bg-fuchsia-500 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_30px_rgba(217,70,239,0.5)] hover:bg-fuchsia-400 transition" data-testid="cta-open-builder">
                Open Builder <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-neutral-500">14&Prime; wide · $10&ndash;$40 · ships in 48hrs</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4 relative overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(217,70,239,0.2),transparent_70%)]" />
            <div className="grid grid-cols-3 gap-2">
              {['14×12', '14×24', '14×36', '14×48', '14×60', '14×72', '14×84', '14×96', '14×120'].map((s) => (
                <div key={s} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
                  <div className="text-xs font-bold text-white">{s}″</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/10 bg-neutral-950 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">How It Works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: '01', t: 'Design & Upload', d: 'Drop your PNG, JPG or PDF into the gang sheet builder. 300 DPI recommended.' },
              { n: '02', t: 'We Print & QC', d: 'Your art is printed on premium PET film with CMYK + white ink. Every sheet hand-checked.' },
              { n: '03', t: 'Ship & Press', d: 'Sheets arrive in 48–72 hours. Heat-press onto any garment at 315°F for 15 seconds.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-4xl font-black text-fuchsia-400/80">{s.n}</div>
                <div className="mt-3 text-xl font-bold text-white">{s.t}</div>
                <div className="mt-2 text-sm text-neutral-400">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/10 py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">FAQ</h2>
          <div className="mt-10 divide-y divide-white/10">
            {[
              { q: 'What is DTF printing?', a: 'Direct-to-Film. We print your artwork onto a special PET film with adhesive powder, and you heat-press it onto virtually any garment.' },
              { q: 'What file format should I send?', a: 'PNG with transparent background is best. JPG and PDF also work. 300 DPI at final print size.' },
              { q: 'How fast do you ship?', a: '48 hours standard, 24 hours with Rush add-on. USPS Priority in the US.' },
              { q: 'Can I gang multiple designs on one sheet?', a: 'Absolutely — that\'s the point. Combine as many designs as fit on the sheet size you pick. You save vs ordering separately.' },
            ].map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-semibold text-white">
                  {f.q}
                  <span className="text-fuchsia-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-neutral-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Nevermore DTF · Direct-to-Film transfers, printed with care.
      </footer>
    </div>
  )
}

export default App
