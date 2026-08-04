'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Global handler for Supabase auth redirects that arrive in the URL HASH,
 * which server code can never see. Two cases:
 *
 * 1. IMPLICIT-FLOW TOKENS (#access_token=...&type=recovery|invite): links in
 *    server-sent emails (admin invites, REST /recover resends) use the
 *    implicit flow, not PKCE, so /auth/callback finds no ?code and wrongly
 *    reports "expired" while a perfectly good token rides along in the hash.
 *    We consume it here (setSession) and forward to the set-password page.
 *    This was the root cause of "fresh link says expired".
 *
 * 2. ERROR HASHES (#error=...&error_code=otp_expired): genuinely dead links
 *    bounce to the Site URL with the error in the hash; forward to the
 *    members screen which explains and offers a fresh link.
 */
export default function AuthErrorCatcher() {
  const router = useRouter()
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return
    const params = new URLSearchParams(hash.slice(1))

    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken && refreshToken) {
      const type = params.get('type') // recovery | invite | signup | magiclink
      const supabase = createClient()
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          window.history.replaceState(null, '', window.location.pathname)
          if (error) {
            router.replace('/members?error=link_expired')
            return
          }
          const dest =
            type === 'recovery' || type === 'invite' || type === 'signup'
              ? '/members/reset'
              : '/studio'
          router.replace(dest)
          router.refresh()
        })
      return
    }

    if (/error_code=otp_expired|error=access_denied/.test(hash)) {
      window.history.replaceState(null, '', window.location.pathname)
      router.replace('/members?error=link_expired')
    }
  }, [router])
  return null
}
