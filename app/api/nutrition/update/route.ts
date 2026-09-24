import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordTargetChange } from '@/lib/nutrition-history'
import {
  EMPTY_HEALTH_SCREEN,
  HealthScreen,
  NutritionGoalSetup,
  calculateNutritionTargets,
  screenHealth,
  validateSetup,
} from '@/lib/nutrition-goals'

/**
 * Update nutrition goals for the current user.
 * Recalculates targets and clears any custom coach overrides.
 */
export async function POST(request: Request) {
  try {
    // 1. Get current user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const setup = body as Partial<NutritionGoalSetup>
    const errors = validateSetup(setup)
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 422 })
    }

    // 2b. Same health gate as setup. A client's circumstances change, and an
    // edit is exactly where they would tell us.
    const healthScreen: HealthScreen = {
      ...EMPTY_HEALTH_SCREEN,
      ...((body as { healthScreen?: Partial<HealthScreen> }).healthScreen ?? {}),
    }
    const screen = screenHealth(healthScreen)
    if (screen.blocked) {
      const blockAdmin = createAdminClient() as any
      try {
        await blockAdmin
          .from('users')
          .update({
            health_screen: healthScreen,
            nutrition_block_code: screen.code,
            health_screened_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('auth_id', user.id)
      } catch (e) {
        console.error('[nutrition/update] failed to record health block', e)
      }
      return NextResponse.json(
        { error: screen.message, blocked: true, code: screen.code },
        { status: 422 }
      )
    }

    // 3. Calculate nutrition targets
    const calculated = calculateNutritionTargets(setup as NutritionGoalSetup)

    // 4. Save to database
    const admin = createAdminClient() as any

    // user.id is the AUTH id; public.users is keyed by its own id with the
    // auth id in auth_id. Matching on id silently updates zero rows.
    const { error: updateError, data: updated } = await admin
      .from('users')
      .update({
        current_weight: setup.currentWeight,
        goal_weight: setup.goalWeight,
        height: setup.height,
        age: setup.age,
        sex: setup.sex,
        activity_level: setup.activityLevel,
        job_activity: setup.jobActivity ?? null,
        training_days_per_week: setup.trainingDaysPerWeek ?? null,
        nutrition_goal: setup.goal,
        daily_cal_target: calculated.dailyCalories,
        protein_target: calculated.proteinGrams,
        carb_target: calculated.carbGrams,
        fat_target: calculated.fatGrams,
        health_screen: healthScreen,
        nutrition_block_code: null,
        health_screened_at: new Date().toISOString(),
        // Coach overrides are deliberately NOT cleared here.
        //
        // This route used to null all four custom_* columns on every client
        // edit. So a client updating their weight in settings silently erased
        // the targets Anthony had set by hand, and neither of them was told.
        // The recalculated values above still land in the calculated columns,
        // which is what fetchTargets falls back to once an override is lifted.
        last_weight_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('auth_id', user.id)
      .select('id, custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')

    if (updateError || !updated?.length) {
      console.error('[nutrition/update] update error:', updateError ?? 'no matching users row')
      return NextResponse.json(
        { error: 'Failed to save nutrition goals' },
        { status: 500 }
      )
    }

    // If Anthony has set targets by hand, the recalculated numbers are stored
    // but not in force. The client needs to be told that rather than being
    // shown a target they are not actually on.
    const row = updated[0]
    const hasCoachOverride =
      row.custom_cal_target !== null ||
      row.custom_protein_target !== null ||
      row.custom_carb_target !== null ||
      row.custom_fat_target !== null

    await recordTargetChange(admin, {
      userId: row.id,
      calories: calculated.dailyCalories,
      protein: calculated.proteinGrams,
      carbs: calculated.carbGrams,
      fats: calculated.fatGrams,
      source: 'client_edit',
      reason: hasCoachOverride
        ? 'You updated your details. Anthony has set your targets by hand, so these recalculated numbers are stored but not in force.'
        : 'You updated your details, so your targets were recalculated.',
      clamp: calculated.clamp,
      evidence: {
        bmr: calculated.bmr,
        maintenance: calculated.maintenanceCalories,
        expectedLbsPerWeek: calculated.expectedLbsPerWeek,
        goal: setup.goal,
        supersededByCoachOverride: hasCoachOverride,
      },
    })

    return NextResponse.json({ ok: true, calculated, hasCoachOverride })
  } catch (err) {
    console.error('[nutrition/update] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
