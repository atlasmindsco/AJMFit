import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * Server Supabase client for Server Components, Route Handlers and Server
 * Actions. Reads/writes the session cookie. (Next 14: cookies() is synchronous.)
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // In a Server Component the cookie store is read-only; the middleware
          // refreshes the session instead, so swallowing here is safe.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* no-op: called from a Server Component */
          }
        },
      },
    }
  )
}
