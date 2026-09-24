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
 * Save nutrition goal setup for the current user.
 * Calculates targets using Mifflin-St Jeor equation and saves to database.
 */
export async function POST(request: Request) {
  try {
    // 1. Get current user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[nutrition/setup] unauthorized: no user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[nutrition/setup] auth user:', user.id)

    // 2. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      console.error('[nutrition/setup] invalid json')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const setup = body as Partial<NutritionGoalSetup>
    console.log('[nutrition/setup] setup:', { height: setup.height, weight: setup.currentWeight, goal: setup.goal })

    const errors = validateSetup(setup)
    if (errors.length > 0) {
      console.error('[nutrition/setup] validation error:', errors[0])
      return NextResponse.json({ error: errors[0] }, { status: 422 })
    }

    // 2b. Health screen. Enforced here and not only in the form, because the
    // form is client-side and this is the gate that decides whether anyone
    // gets an automated calorie prescription at all.
    const healthScreen: HealthScreen = {
      ...EMPTY_HEALTH_SCREEN,
      ...((body as { healthScreen?: Partial<HealthScreen> }).healthScreen ?? {}),
    }
    const screen = screenHealth(healthScreen)
    if (screen.blocked) {
      console.log('[nutrition/setup] blocked by health screen:', screen.code)
      // Record the block before returning. Without this the client is told to
      // speak to Anthony and Anthony is never told there is anything to speak
      // about, which is the worst of both outcomes.
      try {
        const admin = createAdminClient() as any
        await admin
          .from('users')
          .update({
            health_screen: healthScreen,
            nutrition_block_code: screen.code,
            health_screened_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('auth_id', user.id)
      } catch (e) {
        console.error('[nutrition/setup] failed to record health block', e)
      }
      return NextResponse.json(
        { error: screen.message, blocked: true, code: screen.code },
        { status: 422 }
      )
    }

    // 3. Calculate nutrition targets
    const calculated = calculateNutritionTargets(setup as NutritionGoalSetup)
    console.log('[nutrition/setup] calculated:', { calories: calculated.dailyCalories, protein: calculated.proteinGrams })

    // 4. Save to database
    const admin = createAdminClient() as any

    // First, check if user exists and has auth_id linked
    const { data: existingUser, error: selectError } = await admin
      .from('users')
      .select('id, auth_id, email')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('[nutrition/setup] select error:', selectError)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    let userId: string

    if (!existingUser) {
      // User row doesn't exist or auth_id not linked. Try to find by email and link it.
      console.log('[nutrition/setup] No user found with auth_id, checking by email:', user.email)

      const { data: userByEmail, error: emailError } = await admin
        .from('users')
        .select('id, auth_id')
        .eq('email', user.email)
        .maybeSingle()

      if (emailError && emailError.code !== 'PGRST116') {
        console.error('[nutrition/setup] email lookup error:', emailError)
        return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
      }

      if (userByEmail) {
        // Found user by email, but auth_id not set. Link it.
        console.log('[nutrition/setup] found user by email, linking auth_id')
        userId = userByEmail.id

        const { error: linkError } = await admin
          .from('users')
          .update({ auth_id: user.id, updated_at: new Date().toISOString() })
          .eq('id', userId)

        if (linkError) {
          console.error('[nutrition/setup] link auth_id error:', linkError)
          return NextResponse.json({ error: 'Failed to link account' }, { status: 500 })
        }
      } else {
        // No user row exists at all. Create one with auth_id.
        console.log('[nutrition/setup] creating new user row with auth_id')

        const { data: newUser, error: createError } = await admin
          .from('users')
          .insert({
            auth_id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          })
          .select('id')
          .single()

        if (createError || !newUser) {
          console.error('[nutrition/setup] create user error:', createError)
          return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
        }
        userId = newUser.id
      }
    } else {
      userId = existingUser.id
      console.log('[nutrition/setup] found user row:', userId)
    }

    // Now update the user with nutrition data
    const { error: updateError, data: updated } = await admin
      .from('users')
      .update({
        nutrition_goal_setup_complete: true,
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
        // Null here means "not blocked". A non-blocking flag such as a
        // weight-affecting medication is carried on health_screen itself.
        nutrition_block_code: null,
        health_screened_at: new Date().toISOString(),
        last_weight_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, daily_cal_target, protein_target')

    if (updateError) {
      console.error('[nutrition/setup] update error:', updateError)
      return NextResponse.json({ error: 'Failed to save nutrition goals' }, { status: 500 })
    }

    if (!updated?.length) {
      console.error('[nutrition/setup] update returned no rows')
      return NextResponse.json({ error: 'Failed to save nutrition goals' }, { status: 500 })
    }

    console.log('[nutrition/setup] update successful:', { updated: updated[0] })

    await recordTargetChange(admin, {
      userId,
      calories: calculated.dailyCalories,
      protein: calculated.proteinGrams,
      carbs: calculated.carbGrams,
      fats: calculated.fatGrams,
      source: 'setup',
      reason: 'Starting targets from your height, weight, age and activity.',
      clamp: calculated.clamp,
      evidence: {
        bmr: calculated.bmr,
        maintenance: calculated.maintenanceCalories,
        expectedLbsPerWeek: calculated.expectedLbsPerWeek,
        goal: setup.goal,
      },
    })

    return NextResponse.json({ ok: true, calculated })
  } catch (err) {
    console.error('[nutrition/setup] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
