import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'

// Kit (formerly ConvertKit) — Brains & Gains newsletter.
// Signup flow: create subscriber -> add to welcome sequence (fires the welcome
// email) -> tag so they receive the weekly Thursday broadcasts.
const KIT_API_KEY = process.env.KIT_API_KEY || ''
const KIT_WELCOME_SEQUENCE_ID = process.env.KIT_WELCOME_SEQUENCE_ID || '2800010'
const KIT_BG_TAG_ID = process.env.KIT_BG_TAG_ID || '20490383'
const KIT_BASE = 'https://api.kit.com/v4'

function kitFetch(path: string, body: unknown) {
  return fetch(`${KIT_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kit-Api-Key': KIT_API_KEY,
    },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { email, first_name } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const firstName = typeof first_name === 'string' ? first_name.trim() : ''
    if (!firstName) {
      return NextResponse.json({ error: 'A first name is required' }, { status: 400 })
    }

    if (!KIT_API_KEY) {
      console.error('Missing KIT_API_KEY environment variable')
      return NextResponse.json({ error: 'Newsletter service not configured' }, { status: 500 })
    }

    // 1) Create (or upsert) the subscriber.
    const createRes = await kitFetch('/subscribers', { email_address: email, first_name: firstName })
    if (!createRes.ok) {
      const err = await createRes.text()
      console.error('Kit create subscriber failed:', createRes.status, err)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 502 })
    }

    // 2) Add to the welcome sequence + 3) tag. The visitor's signup still
    //    succeeds (they exist as a subscriber), but a failure here means NO
    //    welcome email and NO Thursday issues, which is invisible unless we
    //    alert the coach. This is exactly what happens when the Kit paid plan
    //    lapses (free plan disables sequences), so it must not be silent.
    const [seqRes, tagRes] = await Promise.all([
      kitFetch(`/sequences/${KIT_WELCOME_SEQUENCE_ID}/subscribers`, { email_address: email }),
      kitFetch(`/tags/${KIT_BG_TAG_ID}/subscribers`, { email_address: email }),
    ])
    if (!seqRes.ok || !tagRes.ok) {
      const seqErr = seqRes.ok ? '' : `sequence add failed (HTTP ${seqRes.status})`
      const tagErr = tagRes.ok ? '' : `tag failed (HTTP ${tagRes.status})`
      console.error('Kit post-signup step failed:', seqErr, tagErr)
      // Instructional ops alert to the coach; best-effort, never blocks the visitor.
      try {
        await sendMail({
          to: 'anthony@ajmfit.com',
          subject: `Newsletter problem: ${email} signed up but will not get emails`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1B2D50;">
            <h2 style="color:#1B2D50;">A newsletter signup needs your attention</h2>
            <p style="color:#475569;line-height:1.6;"><strong>${firstName} (${email})</strong> just subscribed on the website. Their subscriber was created, but Kit refused to start their welcome emails (${[seqErr, tagErr].filter(Boolean).join(', ')}). They will not receive anything until this is fixed.</p>
            <p style="color:#1B2D50;font-weight:bold;">What to do next:</p>
            <ol style="color:#475569;line-height:1.8;">
              <li>Log into Kit at <a href="https://app.kit.com">app.kit.com</a> and check <strong>Billing</strong>. If the plan shows as Free or expired, renew the Creator plan. This is the usual cause.</li>
              <li>Then open <strong>Subscribers</strong>, find <strong>${email}</strong>, and add them to the <strong>Brains and Gains Welcome</strong> sequence and the <strong>Brains and Gains</strong> tag.</li>
              <li>Reply to this email if you get stuck and Shane can sort it out.</li>
            </ol>
          </div>`,
        })
      } catch (alertErr) {
        console.error('Newsletter ops alert failed to send:', alertErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Newsletter signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
