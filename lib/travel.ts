/**
 * Training somewhere else for a while, without losing your place.
 *
 * Someone away from their gym has three bad options today: train the program
 * they cannot do, pick a different one and lose eight weeks of block progress,
 * or stop. The third is what actually happens, and a fortnight off is how a
 * training habit ends.
 *
 * The fix needs no new content. The library already holds every program twice
 * — 34 at a gym and the same 34 at home, matched on goal and split — so the
 * home version of someone's exact program already exists. Swapping is finding
 * the twin.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO.
 *
 * It does not switch back on a timer. A program that silently changes under
 * someone mid-week is a bug from where they are standing, however well meant.
 * They switch, and they switch back, both on purpose.
 *
 * It does not start a new block. The block clock lives on the assignment's
 * `assigned_at`, so a naive swap would put someone in week one of eight after
 * six weeks of work — which is exactly the punishment for travelling that this
 * exists to remove. The original date is carried across.
 */

import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface LocationTwin {
  id: string
  name: string
  location: 'gym' | 'home'
}

/**
 * The same program at the other location, or null when there is none.
 *
 * Null is not a failure to report loudly: a custom-built program has no twin,
 * which is correct — there is no automatic home version of something a coach
 * assembled by hand, and pretending otherwise would hand someone a program
 * that is not theirs.
 */
export async function fetchLocationTwin(programId: string): Promise<LocationTwin | null> {
  const { data: current } = await db
    .from('programs')
    .select('id, goal, split_key, location, source')
    .eq('id', programId)
    .maybeSingle()
  if (!current || current.source !== 'blueprint') return null
  if (current.location !== 'gym' && current.location !== 'home') return null

  const other = current.location === 'gym' ? 'home' : 'gym'
  const { data: twin } = await db
    .from('programs')
    .select('id, name, location')
    .eq('source', 'blueprint')
    .eq('goal', current.goal)
    .eq('split_key', current.split_key)
    .eq('location', other)
    .maybeSingle()
  return (twin as LocationTwin) ?? null
}

/** What the button should say, given where they are training now. */
export function swapLabel(to: 'gym' | 'home'): string {
  return to === 'home' ? 'Away from the gym?' : 'Back at the gym?'
}

export function swapDetail(to: 'gym' | 'home'): string {
  return to === 'home'
    ? 'Switch to the dumbbell version of this exact program. Same week, same progress — swap back whenever you are home.'
    : 'Switch back to the full-equipment version. You keep everything you logged while you were away.'
}
