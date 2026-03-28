import { NextRequest, NextResponse } from 'next/server'

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY || ''
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID || ''

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
      console.error('Missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID environment variables')
      return NextResponse.json({ error: 'Newsletter service not configured' }, { status: 500 })
    }

    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${BEEHIIV_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          send_welcome_email: true,
          utm_source: 'ajmfit.com',
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Beehiiv subscribe failed:', res.status, err)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Newsletter signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
