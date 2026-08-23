import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    // Get current user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[nutrition/targets] Fetching targets for user:', user.id)

    const { data, error } = await supabase
      .from('users')
      .select('daily_cal_target, protein_target, carb_target, fat_target')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      console.error('[nutrition/targets] Error fetching targets:', error)
      // Return defaults if not found
      return NextResponse.json({
        calories: 2000,
        protein: 150,
        carbs: 250,
        fats: 70,
      })
    }

    console.log('[nutrition/targets] Fetched targets:', JSON.stringify(data, null, 2))

    const response = {
      calories: data.daily_cal_target ?? 2000,
      protein: data.protein_target ?? 150,
      carbs: data.carb_target ?? 250,
      fats: data.fat_target ?? 70,
    }
    console.log('[nutrition/targets] Returning:', JSON.stringify(response, null, 2))

    return NextResponse.json(response)
  } catch (err) {
    console.error('[nutrition/targets] error:', err)
    return NextResponse.json({
      calories: 2000,
      protein: 150,
      carbs: 250,
      fats: 70,
    })
  }
}
