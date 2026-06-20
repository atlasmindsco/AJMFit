import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/** Top members by workouts logged this month. Authenticated members only. */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const [{ data: workouts }, { data: users }] = await Promise.all([
    db.from('workouts').select('user_id').gte('date', monthStart),
    db.from('users').select('id, name'),
  ])
  const names = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]))
  const counts = new Map<string, number>()
  for (const w of (workouts ?? []) as { user_id: string }[]) counts.set(w.user_id, (counts.get(w.user_id) ?? 0) + 1)

  const leaders = Array.from(counts.entries())
    .map(([id, workouts]) => ({ name: (names.get(id) as string) ?? 'Member', workouts }))
    .sort((a, b) => b.workouts - a.workouts)
    .slice(0, 8)

  return NextResponse.json({ leaders })
}
