'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Mail, MapPin, Clock, Send, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ContactClient() {
  const params = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  useEffect(() => {
    const product = params.get('product')
    if (product) {
      setForm((f) => ({
        ...f,
        subject: f.subject || `Order inquiry: ${product}`,
        message: f.message || `Hi Nevermore team — I’d like to order the "${product}" from your shop. Please let me know availability, size options, and shipping.`,
      }))
    }
  }, [params])

  const isValid =
    form.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.message.trim().length >= 10

  const submit = async (e) => {
    e.preventDefault()
    if (!isValid || sending) return
    setSending(true)
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Send failed')
      setSent(true)
      toast.success('Message sent — we’ll be in touch')
    } catch (e) {
      toast.error(e.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="container mx-auto px-4 py-10 sm:py-16">
        <div className="flex flex-col items-start gap-3 mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
            CONTACT US
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight">Let’s make something.</h1>
          <p className="max-w-xl text-neutral-400">Questions about gang sheets, merch, bulk orders, or custom art? Drop a message and we&rsquo;ll get back within 24 hours.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Form */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-10">
                <div className="mx-auto h-14 w-14 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/50 flex items-center justify-center shadow-[0_0_40px_rgba(217,70,239,0.4)]">
                  <CheckCircle2 className="h-7 w-7 text-fuchsia-300" />
                </div>
                <h2 className="mt-4 text-2xl font-black">Message sent</h2>
                <p className="mt-2 text-neutral-400">Thanks {form.name}, we’ll reply to <span className="text-white">{form.email}</span> within 24 hours.</p>
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
                  className="mt-6 rounded-md border border-white/15 bg-white/5 px-5 py-2 text-sm font-bold uppercase tracking-widest hover:bg-white/10"
                >Send another</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-neutral-300">Name</Label>
                    <Input data-testid="c-name" value={form.name} onChange={set('name')} className="mt-1 bg-white/5 border-white/10" required />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">Email</Label>
                    <Input data-testid="c-email" type="email" value={form.email} onChange={set('email')} className="mt-1 bg-white/5 border-white/10" required />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">Phone (optional)</Label>
                    <Input data-testid="c-phone" value={form.phone} onChange={set('phone')} className="mt-1 bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-300">Subject</Label>
                    <Input data-testid="c-subject" value={form.subject} onChange={set('subject')} className="mt-1 bg-white/5 border-white/10" placeholder="Bulk order, custom art, question…" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-neutral-300">Message</Label>
                  <Textarea
                    data-testid="c-message"
                    value={form.message}
                    onChange={set('message')}
                    rows={6}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                    placeholder="Tell us what you need—print quantities, art requirements, timeline, anything."
                    required
                    minLength={10}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!isValid || sending}
                  data-testid="c-submit"
                  className="w-full h-12 text-sm font-bold uppercase tracking-widest bg-fuchsia-500 hover:bg-fuchsia-400 text-white shadow-[0_0_30px_rgba(217,70,239,0.4)] disabled:opacity-50"
                >
                  {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : <><Send className="h-4 w-4 mr-2" /> Send message</>}
                </Button>
                {!isValid && (form.name || form.email || form.message) && (
                  <p className="text-[11px] text-neutral-500 text-center">Fill name, valid email, and a message (10+ chars) to enable send.</p>
                )}
              </form>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-fuchsia-500/10 to-transparent p-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Direct</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-fuchsia-400 mt-0.5" />
                  <div>
                    <div className="text-neutral-400 text-xs">Email</div>
                    <a href="mailto:nevermoreprintingcompany@yahoo.com" className="text-white hover:text-fuchsia-300">nevermoreprintingcompany@yahoo.com</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-fuchsia-400 mt-0.5" />
                  <div>
                    <div className="text-neutral-400 text-xs">Reply time</div>
                    <div className="text-white">Within 24 hours · Mon–Fri</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-fuchsia-400 mt-0.5" />
                  <div>
                    <div className="text-neutral-400 text-xs">Ships from</div>
                    <div className="text-white">United States</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-fuchsia-300 mb-3">Common asks</h2>
              <ul className="space-y-2 text-sm text-neutral-300">
                <li>• Custom sheet size beyond the 9 stock options</li>
                <li>• Bulk order pricing (50+ pieces)</li>
                <li>• Private-label &amp; wholesale</li>
                <li>• Art clean-up or vector conversion</li>
                <li>• Rush turnaround (24 hr)</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
