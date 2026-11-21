/**
 * One row each time a client opens a screen. That is the whole feature.
 *
 * Five audits have reasoned about what clients look at and the app has never
 * recorded a single view, so every claim any of those documents makes about
 * attention — mine included — is inference. The check-in has zero
 * submissions and eleven of fifteen clients are dormant, and nobody can say
 * whether those clients open the app and leave or never open it at all.
 * Those are different problems with different fixes.
 *
 * Deliberately the smallest thing that answers that: who, which path, when.
 * No events, no funnels, no properties, no third-party script, nothing that
 * leaves the database.
 *
 * A failure is dropped. Measurement must never be able to break a workout.
 */
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * The route, with anything identifying stripped out.
 *
 * Query strings on this app carry exercise names and day indexes
 * (`?view=exercise&ex=Barbell+Squat`), and none of that is needed to answer
 * "which screens do people open". Dynamic ids are collapsed so the same
 * screen does not become a thousand distinct paths.
 */
export function normalisePath(raw: string): string {
  const path = String(raw ?? '').split('?')[0].split('#')[0]
  if (!path.startsWith('/')) return '/'
  return (
    path
      // UUIDs and long ids become a placeholder.
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+(?=\/|$)/g, '/:n')
      .replace(/\/+$/, '') || '/'
  )
}

/** Screens worth counting. Everything else is noise or not a client screen. */
export function shouldRecord(path: string): boolean {
  return normalisePath(path).startsWith('/studio')
}

/**
 * Record a view. Never throws, never awaited by anything the client sees.
 *
 * Returns whether a row was attempted, which is what the verifier checks —
 * the insert itself needs a signed-in session and a database.
 */
export async function recordView(userId: string | null, path: string): Promise<boolean> {
  if (!userId || !shouldRecord(path)) return false
  try {
    await db.from('screen_views').insert({ user_id: userId, path: normalisePath(path) })
    return true
  } catch {
    // Deliberately silent. A client mid-set must never see, or wait on,
    // anything to do with measurement.
    return false
  }
}
