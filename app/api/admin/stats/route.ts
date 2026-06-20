import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

/** Trainer-only dashboard stats: client counts (DB) + this month's revenue (Stripe). */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  if (!user || role !== 'trainer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const [activeRes, totalRes, pendingRes] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  // Revenue this calendar month from paid Stripe invoices.
  let revenueMtdCents = 0
  try {
    const now = new Date()
    const monthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)
    const invoices = await stripe.invoices.list({
      status: 'paid',
      created: { gte: monthStart },
      limit: 100,
    })
    revenueMtdCents = invoices.data.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)
  } catch {
    /* Stripe unavailable → leave 0 */
  }

  return NextResponse.json({
    activeClients: activeRes.count ?? 0,
    totalClients: totalRes.count ?? 0,
    pendingApplications: pendingRes.count ?? 0,
    revenueMtdCents,
  })
}
