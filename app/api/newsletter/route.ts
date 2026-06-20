import { NextRequest, NextResponse } from 'next/server'

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
    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    if (!KIT_API_KEY) {
      console.error('Missing KIT_API_KEY environment variable')
      return NextResponse.json({ error: 'Newsletter service not configured' }, { status: 500 })
    }

    // 1) Create (or upsert) the subscriber.
    const createRes = await kitFetch('/subscribers', { email_address: email })
    if (!createRes.ok) {
      const err = await createRes.text()
      console.error('Kit create subscriber failed:', createRes.status, err)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 502 })
    }

    // 2) Add to the welcome sequence + 3) tag. Best-effort: a hiccup here
    //    shouldn't fail the visitor's signup — they're already a subscriber.
    const [seqRes, tagRes] = await Promise.all([
      kitFetch(`/sequences/${KIT_WELCOME_SEQUENCE_ID}/subscribers`, { email_address: email }),
      kitFetch(`/tags/${KIT_BG_TAG_ID}/subscribers`, { email_address: email }),
    ])
    if (!seqRes.ok) console.error('Kit add-to-sequence failed:', seqRes.status, await seqRes.text())
    if (!tagRes.ok) console.error('Kit tag-subscriber failed:', tagRes.status, await tagRes.text())

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Newsletter signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
