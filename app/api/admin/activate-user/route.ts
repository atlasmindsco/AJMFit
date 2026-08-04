import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Admin-only route to activate a user account and set a temporary password.
 * Bypasses email confirmation and sets a password they can use to log in immediately.
 * Then they can change it in their profile settings.
 * Body: { email: "user@example.com", tempPassword: "TempPass123!" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const tempPassword = typeof body?.tempPassword === 'string' ? body.tempPassword : 'TempPassword123!'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    if (tempPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    // Get the user
    const { data: users, error: listError } = await admin.auth.admin.listUsers()
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`)
    }

    const user = users?.users?.find((u: any) => u.email === email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user: confirm email and set password
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: tempPassword,
      email_confirm: true, // Confirm the email
    })

    if (error) {
      console.error('[activate-user] Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Failed to activate' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: `User ${email} activated successfully`,
      note: `They can now log in with their email and password: ${tempPassword}. They should change it in account settings.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[activate-user] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
