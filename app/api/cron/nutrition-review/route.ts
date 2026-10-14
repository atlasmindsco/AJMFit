import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runNutritionReview } from '@/lib/nutrition-review-run'

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
    const out = await runNutritionReview(admin, { dryRun })
    return NextResponse.json({ ok: true, dryRun, ...out })
  } catch (err) {
    console.error('[cron/nutrition-review] error', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
