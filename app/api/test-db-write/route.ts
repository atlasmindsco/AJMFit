import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('[test-db-write] Testing write to users table for user:', user.id)

    const admin = createAdminClient() as any

    // Try to write a test value
    const testValue = Math.random()
    console.log('[test-db-write] Writing test value:', testValue)

    const { error, data } = await admin
      .from('users')
      .update({ daily_cal_target: testValue })
      .eq('id', user.id)
      .select('daily_cal_target')

    console.log('[test-db-write] Update error:', error)
    console.log('[test-db-write] Update data:', data)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code
      })
    }

    // Now try to read it back
    const { data: readData, error: readError } = await admin
      .from('users')
      .select('daily_cal_target')
      .eq('id', user.id)
      .single()

    console.log('[test-db-write] Read error:', readError)
    console.log('[test-db-write] Read data:', readData)

    return NextResponse.json({
      success: true,
      wrote: testValue,
      read: readData?.daily_cal_target,
      match: readData?.daily_cal_target === testValue,
    })
  } catch (err) {
    console.error('[test-db-write] Exception:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
