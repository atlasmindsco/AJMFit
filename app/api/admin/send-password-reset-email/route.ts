import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'

/**
 * Admin-only route to generate and email a password reset link.
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

    // Generate a password reset link
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (error) {
      console.error('[send-password-reset-email] Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Failed to generate link' }, { status: 500 })
    }

    const resetLink = data?.properties?.action_link
    if (!resetLink) {
      return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 })
    }

    // Send email with the reset link
    await sendMail({
      to: email,
      subject: 'Set Your Password - AJM Fit',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Welcome to AJM Fit</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Hi there,
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Click the button below to set your password and start your training journey:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Set Your Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0 0;">
              Or copy this link: <br/>
              <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${resetLink}</code>
            </p>
            <p style="color: #666; font-size: 12px; line-height: 1.6; margin: 20px 0 0;">
              This link expires in 24 hours.
            </p>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #e5e7eb;">
            <p>© 2026 AJM Fit. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Welcome to AJM Fit\n\nClick this link to set your password:\n${resetLink}\n\nThis link expires in 24 hours.`,
    })

    return NextResponse.json({
      ok: true,
      message: `Password reset email sent to ${email}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[send-password-reset-email] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
