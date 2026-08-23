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

    // 3. Calculate nutrition targets
    const calculated = calculateNutritionTargets(setup as NutritionGoalSetup)

    // 4. Save to database
    const admin = createAdminClient() as any

    const { error: updateError } = await admin
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
      .eq('id', user.id)

    if (updateError) {
      console.error('[nutrition/setup] update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save nutrition goals' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, calculated })
  } catch (err) {
    console.error('[nutrition/setup] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
