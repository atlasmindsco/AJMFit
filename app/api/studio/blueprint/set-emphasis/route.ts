import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_EMPHASIS = ['none', 'legs', 'glutes', 'chest', 'back', 'shoulders', 'arms', 'upper_body', 'lower_body']

/**
 * Save body-part emphasis preference for a user.
 * Called after program assignment to customize their training focus.
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

    const body = (await request.json()) as { emphasis?: string }
    const emphasis = body.emphasis || 'none'

    if (!VALID_EMPHASIS.includes(emphasis)) {
      return NextResponse.json({ error: 'Invalid emphasis' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    const { error } = await admin
      .from('users')
      .update({ body_part_emphasis: emphasis })
      .eq('auth_id', user.id)

    if (error) {
      console.error('[set-emphasis] update error:', error)
      return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[set-emphasis] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
