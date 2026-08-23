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

    // 4. Save to database using UPSERT (insert or update)
    console.log('[nutrition/setup] Saving nutrition goals for user:', user.id, 'calories:', calculated.dailyCalories)

    const upsertObj = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || 'User',
      auth_id: user.id,
      nutrition_goal_setup_complete: true,
      daily_cal_target: calculated.dailyCalories,
      protein_target: calculated.proteinGrams,
      carb_target: calculated.carbGrams,
      fat_target: calculated.fatGrams,
      updated_at: new Date().toISOString(),
    }

    console.log('[nutrition/setup] Upserting user record:', JSON.stringify(upsertObj))

    const { error: updateError, data: updateData } = await supabase
      .from('users')
      .upsert(upsertObj, { onConflict: 'id' })
      .select()

    console.log('[nutrition/setup] Upsert error:', updateError)
    console.log('[nutrition/setup] Upsert data:', updateData)

    if (updateError) {
      console.error('[nutrition/setup] update error:', updateError)
      return NextResponse.json(
        { error: `Update error: ${updateError.message || 'Unknown error'}. Columns might not exist.` },
        { status: 500 }
      )
    }

    console.log('[nutrition/setup] Update success')
    console.log('[nutrition/setup] Returned data:', JSON.stringify(updateData, null, 2))

    // Verify the data was actually saved by fetching it back
    const { data: verify } = await admin
      .from('users')
      .select('custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')
      .eq('id', user.id)
      .single()

    console.log('[nutrition/setup] Verification fetch:', JSON.stringify(verify, null, 2))

    return NextResponse.json({ ok: true, calculated, verified: updateData?.[0], verificationFetch: verify })
  } catch (err) {
    console.error('[nutrition/setup] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
