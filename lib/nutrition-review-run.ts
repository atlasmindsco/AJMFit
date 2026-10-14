/**
 * The weekly nutrition review, as a function rather than only a route.
 *
 * It lived inside its own cron route, which made it a third scheduled job.
 * Vercel's Hobby plan allows two, and three declared crons is the most likely
 * reason none of them has ever run: cron_runs and notifications_sent are both
 * empty, and the endpoints themselves answer correctly when called.
 *
 * Pulling the body out means the daily digest can run it on Mondays, the whole
 * system fits in two daily jobs on any plan, and the route stays for running
 * it by hand.
 */
import { evaluateClient, resolveTiers } from '@/lib/nutrition-evaluate'

export interface NutritionReviewResult {
  clients: number
  proposed: number
  applied: number
  escalated: number
  summary: Array<Record<string, unknown>>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function runNutritionReview(
  admin: any,
  opts: { dryRun?: boolean } = {}
): Promise<NutritionReviewResult> {
  const dryRun = Boolean(opts.dryRun)

  const { data: users, error } = await admin
    .from('users')
    .select(
      'id, name, email, nutrition_goal_setup_complete, nutrition_goal, ' +
        'current_weight, goal_weight, height, age, sex, activity_level, ' +
        'job_activity, training_days_per_week, health_screen, nutrition_block_code, ' +
        'daily_cal_target, protein_target, carb_target, fat_target, ' +
        'custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target'
    )
    .eq('nutrition_goal_setup_complete', true)
  if (error) throw new Error(error.message)

  const tiers = await resolveTiers(admin, (users ?? []).map((u: { id: string }) => u.id))

  const summary: Array<Record<string, unknown>> = []
  let proposed = 0
  let applied = 0
  let escalated = 0

  for (const user of users ?? []) {
    try {
      const out = await evaluateClient(admin, { ...user, tier: tiers.get(user.id) ?? null }, { dryRun })
      if (out.skipped) {
        summary.push({ name: out.name, skipped: out.skipped })
        continue
      }
      const r = out.result
      summary.push({
        name: out.name,
        verdict: r.verdict,
        escalation: r.escalation,
        from: r.evidence.currentCalories,
        to: r.newCalories,
        rate: r.evidence.actualRatePct,
        target: r.evidence.targetRatePct,
        applied: out.applied,
        coachNote: r.coachNote,
      })
      if (r.escalation) escalated++
      else if (out.applied) applied++
      else if (r.newCalories !== null) proposed++
    } catch (e) {
      // One client's bad data must not stop the other four being reviewed.
      console.error('[nutrition-review] client failed', user.id, e)
      summary.push({ name: user.name ?? user.id, error: String(e) })
    }
  }

  return { clients: (users ?? []).length, proposed, applied, escalated, summary }
}
