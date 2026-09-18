import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Get current nutrition setup for a user (for editing).
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from('users')
      .select(
        'current_weight, goal_weight, height, age, sex, activity_level, nutrition_goal'
      )
      .eq('auth_id', user.id)
      .single()

    if (error || !data) {
      console.error('[nutrition/get-setup] error:', error)
      return NextResponse.json({ error: 'Failed to load setup' }, { status: 500 })
    }

    return NextResponse.json({
      currentWeight: data.current_weight,
      goalWeight: data.goal_weight,
      height: data.height,
      age: data.age,
      sex: data.sex,
      activityLevel: data.activity_level,
      goal: data.nutrition_goal,
    })
  } catch (err) {
    console.error('[nutrition/get-setup] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
