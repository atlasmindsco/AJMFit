import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  NutritionGoalSetup,
  calculateNutritionTargets,
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

    // 3. Calculate nutrition targets
    const calculated = calculateNutritionTargets(setup as NutritionGoalSetup)
    console.log('[nutrition/setup] calculated:', { calories: calculated.dailyCalories, protein: calculated.proteinGrams })

    // 4. Save to database
    const admin = createAdminClient() as any

    // First, verify the user exists in public.users
    const { data: existingUser, error: selectError } = await admin
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('[nutrition/setup] select error:', selectError)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!existingUser) {
      console.error('[nutrition/setup] no user row found for auth_id:', user.id)
      return NextResponse.json({ error: 'User account not found. Please contact support.' }, { status: 404 })
    }

    console.log('[nutrition/setup] found user row:', existingUser.id)

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
        nutrition_goal: setup.goal,
        daily_cal_target: calculated.dailyCalories,
        protein_target: calculated.proteinGrams,
        carb_target: calculated.carbGrams,
        fat_target: calculated.fatGrams,
        last_weight_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('auth_id', user.id)
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

    return NextResponse.json({ ok: true, calculated })
  } catch (err) {
    console.error('[nutrition/setup] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
