/**
 * Scanner-safe auth email sender.
 *
 * Wraps Supabase's `admin.auth.admin.generateLink()` so that the one-time
 * verify URL is never emailed directly. Instead we email a link to our own
 * /auth/handoff page which requires a real button click before touching the
 * Supabase token. This survives Gmail/Outlook/enterprise scanner prefetches.
 *
 * See app/auth/handoff/page.tsx for the click-through, and lib/email.ts for
 * the branded email templates.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, setupInviteEmailHTML, passwordResetEmailHTML } from '@/lib/email'

export type AuthLinkKind = 'invite' | 'recovery'

export interface SendAuthLinkInput {
  email: string
  kind: AuthLinkKind
  origin: string
  next?: string // path to land on after auth (default /members/reset)
  firstName?: string | null
}

export interface SendAuthLinkResult {
  ok: boolean
  reason?: 'user_exists' | 'user_missing' | 'generate_failed' | 'send_failed' | 'unknown'
  message?: string
}

const DEFAULT_NEXT = '/members/reset'

/**
 * Generate a Supabase auth link and email it wrapped in our handoff URL.
 *
 * - `kind: 'invite'` — creates a new auth user if one doesn't exist. If one
 *   already exists, callers should retry with `kind: 'recovery'` (mirrors the
 *   existing invite route behaviour).
 * - `kind: 'recovery'` — requires an existing auth user; sends a set-password
 *   link the same shape as a password reset.
 */
export async function sendAuthLink(input: SendAuthLinkInput): Promise<SendAuthLinkResult> {
  const { email, kind, origin } = input
  const next = input.next ?? DEFAULT_NEXT

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // IMPORTANT: no query string here. Supabase's redirect allow-list only
  // matches the bare /auth/callback entry; adding ?next=... failed the match
  // and made GoTrue fall back to the Site URL (which pointed at localhost),
  // dead-ending every invite/reset link. The callback route already defaults
  // to /members/reset, so the query was redundant anyway.
  void next // reserved for when the allow-list covers query strings
  const redirectTo = `${origin}/auth/callback`

  const { data, error } = await admin.auth.admin.generateLink({
    type: kind,
    email,
    options: { redirectTo },
  })

  if (error || !data?.properties?.action_link) {
    const message = error?.message ?? 'no action_link returned'
    // Distinguish the "user already exists" case for invites so callers can retry
    // as a recovery link (same policy as the old inviteUserByEmail flow).
    if (kind === 'invite' && /already|exists|registered/i.test(message)) {
      return { ok: false, reason: 'user_exists', message }
    }
    if (kind === 'recovery' && /not found|no user/i.test(message)) {
      return { ok: false, reason: 'user_missing', message }
    }
    return { ok: false, reason: 'generate_failed', message }
  }

  const actionLink: string = data.properties.action_link

  const handoffUrl = `${origin}/auth/handoff?target=${encodeURIComponent(actionLink)}&kind=${kind}`

  const html =
    kind === 'invite'
      ? setupInviteEmailHTML({ firstName: input.firstName ?? '', ctaUrl: handoffUrl })
      : passwordResetEmailHTML({ firstName: input.firstName ?? '', ctaUrl: handoffUrl })

  const subject = kind === 'invite' ? 'Set up your AJM Fit account' : 'Reset your AJM Fit password'

  try {
    const sent = await sendMail({ to: email, subject, html, replyTo: 'anthony@ajmfit.com' })
    if (!sent) return { ok: false, reason: 'send_failed', message: 'SMTP not configured' }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: 'send_failed',
      message: err instanceof Error ? err.message : 'send failed',
    }
  }
}
