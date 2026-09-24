import type { ClampReason } from '@/lib/nutrition-goals'

/**
 * Append-only record of nutrition target changes.
 *
 * Targets live as mutable columns on users, so before this there was no way to
 * answer "what was I eating last month and why did it change?" — not for the
 * client, not for Anthony reviewing his own decisions, and not for the
 * adjustment engine, which needs to know how long a target has been in force
 * before it can judge whether it is working.
 *
 * Writing history must never break the thing that changed the target. A
 * failure here is logged and swallowed: a client whose targets saved but whose
 * history row did not is in a worse position if we then show them an error.
 */

export type TargetSource = 'setup' | 'client_edit' | 'coach' | 'auto' | 'diet_break'

export interface TargetChange {
  userId: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fats: number | null
  source: TargetSource
  /** Shown to the client. Plain language, not jargon. */
  reason?: string | null
  clamp?: ClampReason | null
  /** The data the decision rested on, so a past call can be audited. */
  evidence?: Record<string, unknown> | null
  /** Set only when Anthony acts. */
  changedBy?: string | null
}

/**
 * @param admin a Supabase client with the service role. This table has no
 *              insert policy by design, so an anon or user-scoped client
 *              cannot write to it.
 */
export async function recordTargetChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  change: TargetChange
): Promise<void> {
  try {
    const { error } = await admin.from('nutrition_target_history').insert({
      user_id: change.userId,
      cal_target: change.calories,
      protein_target: change.protein,
      carb_target: change.carbs,
      fat_target: change.fats,
      source: change.source,
      reason: change.reason ?? null,
      clamp: change.clamp ?? null,
      evidence: change.evidence ?? null,
      changed_by: change.changedBy ?? null,
    })
    if (error) console.error('[nutrition-history] insert failed', error)
  } catch (e) {
    console.error('[nutrition-history] insert threw', e)
  }
}
