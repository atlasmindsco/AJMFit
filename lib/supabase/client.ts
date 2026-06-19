import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

/**
 * Browser Supabase client (cookie-backed session via @supabase/ssr).
 * Use inside 'use client' components. Carries the logged-in user's JWT, so
 * Postgres RLS applies to every query.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
