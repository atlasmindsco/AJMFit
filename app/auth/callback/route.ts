import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth/PKCE callback. Supabase invite + password-reset emails link here with a
 * `code`; we exchange it for a session cookie, then forward to `next`
 * (defaults to the set-password page for invites/resets).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/members/reset'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }

  // Bad or expired link.
  return NextResponse.redirect(
    new URL('/members?error=link_expired', url.origin)
  )
}
