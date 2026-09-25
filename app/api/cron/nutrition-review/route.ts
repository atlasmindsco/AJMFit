import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateClient, resolveTiers } from '@/lib/nutrition-evaluate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Weekly nutrition review.
 *
 * Walks every client with nutrition set up, compares a rolling seven-day
 * weight average against the one from a fortnight earlier, and decides whether
 * targets should move. Coached clients get a proposal waiting for Anthony;
 * Blueprint clients have it applied with an explanation.
 *
 * `?dry=1` computes everything and writes nothing, so the decisions can be
 * read against real clients before the job is ever allowed to change a target.
 *
 * Auth matches the digest cron: a bearer CRON_SECRET when configured, the
 * Vercel cron header otherwise. Unlike the digest, this one WRITES, so the dry
 * run is the only thing an unauthorised caller could usefully reach if the
 * secret were ever missing -- and it is the safe half.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (!request.headers.get('x-vercel-cron')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dry') === '1'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

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

    if (error) {
      console.error('[cron/nutrition-review] load failed', error)
      return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
    }

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
        console.error('[cron/nutrition-review] client failed', user.id, e)
        summary.push({ name: user.name ?? user.id, error: String(e) })
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      clients: (users ?? []).length,
      proposed,
      applied,
      escalated,
      summary,
    })
  } catch (err) {
    console.error('[cron/nutrition-review] error', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
