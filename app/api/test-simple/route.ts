import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated', user: null })
    }

    console.log('[test-simple] User:', user.id, user.email)

    // Simple direct update to just one column
    const { data, error } = await supabase
      .from('users')
      .update({ daily_cal_target: 2500 })
      .eq('id', user.id)

    console.log('[test-simple] Update result - error:', error, 'data:', data)

    if (error) {
      return NextResponse.json({
        success: false,
        userId: user.id,
        error: error.message,
        code: error.code,
        details: error.details,
        status: error.status,
      })
    }

    // Try to read it back
    const { data: readData, error: readError } = await supabase
      .from('users')
      .select('daily_cal_target')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      userId: user.id,
      userEmail: user.email,
      updateSucceeded: !error,
      readBack: readData?.daily_cal_target,
      readError: readError?.message,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack,
    })
  }
}
