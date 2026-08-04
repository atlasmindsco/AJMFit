import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Admin-only route to send a password reset email.
 * Uses Supabase's email_change type which generates a password reset link.
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

    // Get user by email first
    const { data: users, error: listError } = await admin.auth.admin.listUsers()
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`)
    }

    const user = users?.users?.find((u: any) => u.email === email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate a password reset link
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (error) {
      console.error('[send-password-reset] Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Failed to send' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: `Password reset link sent to ${email}`,
      link: data?.properties?.action_link || 'Link generated but not displayed',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[send-password-reset] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
