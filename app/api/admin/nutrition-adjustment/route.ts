import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAdjustment } from '@/lib/nutrition-evaluate'
import { calorieFloorFor, calculateBMR, deriveMacros, type FitnessGoal, type Sex } from '@/lib/nutrition-goals'

export const runtime = 'nodejs'

/**
 * Coach-only: approve or reject a proposed nutrition adjustment.
 *
 * Anthony can approve as proposed, approve with a different calorie number, or
 * reject. Approving with an edit recalculates the macros rather than keeping
 * the engine's, so the numbers always agree with each other.
 *
 * The floor is re-checked here and not only in the engine. A hand-typed number
 * is exactly where an unsafe target would otherwise get in, and "the coach
 * asked for it" is not a reason to write a target below someone's BMR without
 * saying so.
 */
async function requireTrainer() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  return role === 'trainer' ? user : null
}

/**
 * Pending proposals for the review queue.
 *
 * Served from here rather than read directly by the page, because
 * nutrition_adjustments has no RLS policies and no grants for `authenticated`
 * by design: every read goes through the service role behind a trainer check.
 */
export async function GET() {
  const trainer = await requireTrainer()
  if (!trainer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('nutrition_adjustments')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin/nutrition-adjustment] list failed', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }

  const rows = data ?? []
  const ids = Array.from(new Set<string>(rows.map((r: { user_id: string }) => r.user_id)))
  const { data: people } = ids.length
    ? await admin.from('users').select('id, name, email').in('id', ids)
    : { data: [] }
  const nameOf = new Map(
    (people ?? []).map((p: { id: string; name: string | null; email: string | null }) => [
      p.id,
      p.name || p.email || 'Client',
    ])
  )

  return NextResponse.json({
    rows: rows.map((r: { user_id: string }) => ({ ...r, client_name: nameOf.get(r.user_id) ?? 'Client' })),
  })
}

export async function POST(request: Request) {
  try {
    const trainer = await requireTrainer()
    if (!trainer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = (await request.json()) as {
      id: string
      action: 'approve' | 'reject'
      calories?: number
    }
    if (!body.id || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data: adj } = await admin
      .from('nutrition_adjustments')
      .select('*')
      .eq('id', body.id)
      .maybeSingle()

    if (!adj) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (adj.status !== 'pending') {
      return NextResponse.json({ error: `Already ${adj.status}` }, { status: 409 })
    }

    const { data: coachRow } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', trainer.id)
      .maybeSingle()

    if (body.action === 'reject') {
      await admin
        .from('nutrition_adjustments')
        .update({
          status: 'rejected',
          decided_by: coachRow?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq('id', body.id)
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    // --- Approve ---
    const { data: client } = await admin
      .from('users')
      .select('current_weight, goal_weight, height, age, sex, nutrition_goal')
      .eq('id', adj.user_id)
      .maybeSingle()

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    let calories = Number(body.calories ?? adj.new_cal)
    const edited = body.calories !== undefined && Number(body.calories) !== Number(adj.new_cal)

    if (!Number.isFinite(calories) || calories <= 0) {
      return NextResponse.json({ error: 'Invalid calorie target' }, { status: 422 })
    }

    const bmr = calculateBMR(
      Number(client.current_weight),
      Number(client.height),
      Number(client.age),
      client.sex as Sex
    )
    const floor = calorieFloorFor(client.sex as Sex, bmr)
    let floored = false
    if (calories < floor) {
      calories = Math.ceil(floor / 25) * 25
      floored = true
    }

    const macros = deriveMacros(
      calories,
      Number(client.current_weight),
      Number(client.goal_weight),
      client.nutrition_goal as FitnessGoal
    )

    await applyAdjustment(
      admin,
      adj.user_id,
      {
        verdict: adj.verdict,
        newCalories: calories,
        newProtein: macros.proteinGrams,
        newCarbs: macros.carbGrams,
        newFats: macros.fatGrams,
        reason: adj.reason,
        evidence: { ...(adj.evidence ?? {}), approvedBy: 'coach', coachEdited: edited, floored },
      },
      'coach',
      coachRow?.id
    )

    await admin
      .from('nutrition_adjustments')
      .update({
        status: 'approved',
        new_cal: calories,
        new_protein: macros.proteinGrams,
        new_carbs: macros.carbGrams,
        new_fats: macros.fatGrams,
        coach_edited: edited,
        decided_by: coachRow?.id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', body.id)

    return NextResponse.json({ ok: true, status: 'approved', calories, floored })
  } catch (err) {
    console.error('[admin/nutrition-adjustment] error', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
