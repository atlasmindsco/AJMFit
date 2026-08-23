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

    // Use admin client to fetch targets (bypass RLS)
    const admin = createAdminClient() as any

    console.log('[nutrition/targets] Fetching targets for user:', user.id)

    const { data, error } = await admin
      .from('users')
      .select('custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')
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
    console.log('[nutrition/targets] custom_cal_target value:', data.custom_cal_target)
    console.log('[nutrition/targets] custom_cal_target is null?', data.custom_cal_target === null)
    console.log('[nutrition/targets] custom_cal_target is undefined?', data.custom_cal_target === undefined)

    const response = {
      calories: data.custom_cal_target ?? 2000,
      protein: data.custom_protein_target ?? 150,
      carbs: data.custom_carb_target ?? 250,
      fats: data.custom_fat_target ?? 70,
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
