import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Admin-only route to resend email confirmation for a user.
 * Body: { email: "user@example.com" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    // Resend confirmation email via Supabase Admin API
    const { error } = await admin.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      console.error('[resend-confirmation] Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Failed to resend' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: `Confirmation email resent to ${email}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[resend-confirmation] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
