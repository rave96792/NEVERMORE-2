import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { handleCORS, optionsResponse } from '@/lib/api/cors'
import { connectToMongo } from '@/lib/api/mongo'

export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }

export async function POST(request) {
  try {
    const body = await request.json()
    const name = String(body.name || '').trim().slice(0, 120)
    const email = String(body.email || '').trim().slice(0, 200)
    const phone = String(body.phone || '').trim().slice(0, 60)
    const subject = String(body.subject || '').trim().slice(0, 200) || 'Contact form message'
    const message = String(body.message || '').trim().slice(0, 5000)
    if (name.length < 2) return handleCORS(NextResponse.json({ error: 'Name required' }, { status: 400 }))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return handleCORS(NextResponse.json({ error: 'Valid email required' }, { status: 400 }))
    if (message.length < 10) return handleCORS(NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 }))

    try {
      const database = await connectToMongo()
      await database.collection('contact_messages').insertOne({
        id: uuidv4(),
        name, email, phone: phone || null, subject, message,
        createdAt: new Date(),
      })
    } catch (e) {
      console.error('[contact] mongo insert failed:', e?.message)
    }

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const from = process.env.MAIL_FROM || 'onboarding@resend.dev'
        const to = process.env.MAIL_SHOP_TO
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#eee;padding:24px">
          <div style="max-width:640px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#d946ef,#7c3aed);border-radius:12px;padding:20px;color:#fff">
              <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.85">Nevermore DTF</div>
              <div style="font-size:22px;font-weight:800;margin-top:4px">New contact form message</div>
              <div style="opacity:0.85;margin-top:6px">${esc(subject)}</div>
            </div>
            <div style="background:#fff;color:#111;border-radius:12px;margin-top:16px;padding:20px">
              <table style="width:100%;font-size:14px"><tbody>
                <tr><td style="padding:6px 0;color:#666;width:100px">Name</td><td style="padding:6px 0;color:#111;font-weight:600">${esc(name)}</td></tr>
                <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0;color:#111"><a href="mailto:${esc(email)}" style="color:#7c3aed">${esc(email)}</a></td></tr>
                ${phone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0;color:#111">${esc(phone)}</td></tr>` : ''}
              </tbody></table>
              <div style="margin-top:14px;border-top:1px solid #eee;padding-top:14px">
                <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#666;margin-bottom:6px">Message</div>
                <div style="white-space:pre-wrap;color:#111;line-height:1.5">${esc(message)}</div>
              </div>
            </div>
          </div>
        </body></html>`
        if (to) {
          await resend.emails.send({
            from,
            to,
            replyTo: email,
            subject: `CONTACT · ${subject} · from ${name}`,
            html,
          })
        }
      } catch (e) {
        console.error('[contact] email send failed:', e?.message)
      }
    }

    return handleCORS(NextResponse.json({ ok: true }))
  } catch (e) {
    console.error('[contact] top-level error:', e?.message)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
