import { createClient } from '@/lib/supabase/client'

/**
 * Backward-compatible singleton browser client.
 *
 * Now backed by @supabase/ssr's cookie-based client, so existing browser data
 * libraries (lib/workout.ts, lib/nutrition.ts, lib/admin.ts) automatically send
 * the logged-in user's session and are subject to RLS. New code should prefer
 * importing the appropriate factory from `@/lib/supabase/{client,server}`.
 */
export const supabase = createClient()
