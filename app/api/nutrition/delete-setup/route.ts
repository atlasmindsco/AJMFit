import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Delete/reset nutrition setup for a user.
 * Clears all nutrition goals so they can start fresh.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { error } = await admin
      .from('users')
      .update({
        nutrition_goal_setup_complete: false,
        current_weight: null,
        goal_weight: null,
        height: null,
        age: null,
        sex: null,
        activity_level: null,
        nutrition_goal: null,
        daily_cal_target: 2000, // Reset to default
        protein_target: 150,
        carb_target: 250,
        fat_target: 70,
        custom_cal_target: null,
        custom_protein_target: null,
        custom_carb_target: null,
        custom_fat_target: null,
        last_weight_update: null,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_id', user.id)

    if (error) {
      console.error('[nutrition/delete-setup] error:', error)
      return NextResponse.json({ error: 'Failed to delete nutrition setup' }, { status: 500 })
    }

    // Clear localStorage backup
    return NextResponse.json({ ok: true, message: 'Nutrition setup deleted. Please set up again.' })
  } catch (err) {
    console.error('[nutrition/delete-setup] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
