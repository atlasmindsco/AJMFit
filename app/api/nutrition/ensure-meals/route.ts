import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_MEALS = [
  { name: 'Breakfast', time: '07:00:00', order: 1 },
  { name: 'Lunch', time: '12:30:00', order: 2 },
  { name: 'Dinner', time: '19:00:00', order: 3 },
  { name: 'Snack', time: '21:00:00', order: 4 },
]

export async function POST(request: Request) {
  try {
    // Get current user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const admin = createAdminClient() as any

    console.log('[ensure-meals] Starting for user:', user.id)

    // Delete all existing meals for user
    console.log('[ensure-meals] Deleting all existing meals')
    const { error: deleteError } = await admin
      .from('meals')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[ensure-meals] Delete error:', deleteError)
      return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 })
    }

    // Create default meals
    console.log('[ensure-meals] Creating default meals')
    const rows = DEFAULT_MEALS.map((m) => ({
      user_id: user.id,
      name: m.name,
      scheduled_time: m.time,
      meal_order: m.order,
    }))

    const { data: created, error: insertError } = await admin
      .from('meals')
      .insert(rows)
      .select()

    if (insertError) {
      console.error('[ensure-meals] Insert error:', insertError)
      return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 })
    }

    console.log('[ensure-meals] Success, created meals:', created)
    return NextResponse.json({ ok: true, meals: created })
  } catch (err) {
    console.error('[ensure-meals] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
