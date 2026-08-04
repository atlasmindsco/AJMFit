'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Global catcher for Supabase auth-error redirects.
 *
 * When an invite/reset link is expired or already used, GoTrue redirects the
 * browser to the Site URL (or the callback) with the error in the URL HASH,
 * e.g. `#error=access_denied&error_code=otp_expired&...`. Server code never
 * sees fragments, so without this the user just lands on the homepage with no
 * explanation (exactly what confused real users). This runs on every page,
 * spots that hash, and forwards to the members screen which explains it and
 * offers a fresh link.
 */
export default function AuthErrorCatcher() {
  const router = useRouter()
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    if (/error_code=otp_expired|error=access_denied/.test(hash)) {
      // Clear the hash so back-navigation doesn't loop.
      window.history.replaceState(null, '', window.location.pathname)
      router.replace('/members?error=link_expired')
    }
  }, [router])
  return null
}
