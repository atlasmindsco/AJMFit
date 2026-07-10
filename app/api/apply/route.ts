import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, applicationNotificationHTML } from '@/lib/email'

const TIER_LABELS: Record<string, string> = {
  blueprint: 'The Blueprint',
  accelerator: 'The Accelerator',
  'full-experience': 'The Full Experience',
}
const COACH_EMAIL = 'anthony@ajmfit.com'

/**
 * Public application submission. Runs server-side with the service-role key so
 * the browser needs no write access to the (now RLS-protected) users /
 * applications tables. Creates or updates a *pending* user by email and stores
 * the application snapshot. No auth account is created here — that happens when
 * the trainer approves and the client is invited.
 */
const bodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  goals: z.string().min(10),
  equipment: z.array(z.string()).min(1),
  healthLimitations: z.string().optional().nullable(),
  availability: z.string().min(5),
  tier: z.enum(['blueprint', 'accelerator', 'full-experience']),
  billingCycle: z.enum(['monthly', 'weekly']),
  referral: z.string().optional().nullable(),
})

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check your answers and try again.' },
      { status: 422 }
    )
  }
  const data = parsed.data

  // The hand-written Database types resolve typed inserts to `never`; the rest
  // of the codebase casts for the same reason.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // 1. Upsert the pending user by email (re-applications don't collide).
  const { data: user, error: userErr } = await db
    .from('users')
    .upsert(
      {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        status: 'pending',
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (userErr || !user) {
    return NextResponse.json(
      { error: 'Could not save your application. Please try again.' },
      { status: 500 }
    )
  }

  // 2. Insert the application snapshot.
  const { error: appErr } = await db.from('applications').insert({
    user_id: user.id,
    goals: data.goals,
    equipment: data.equipment,
    health_limitations: data.healthLimitations || null,
    availability: data.availability,
    tier: data.tier,
    billing_cycle: data.billingCycle,
    referral: data.referral || null,
    status: 'pending',
  })

  if (appErr) {
    return NextResponse.json(
      { error: 'Could not save your application. Please try again.' },
      { status: 500 }
    )
  }

  // 3. Notify Coach Anthony. Best-effort: a mail hiccup must never fail the
  //    applicant's submission (it's already saved above).
  try {
    await sendMail({
      to: COACH_EMAIL,
      replyTo: data.email,
      subject: `New application: ${data.name} (${TIER_LABELS[data.tier] ?? data.tier})`,
      html: applicationNotificationHTML({
        name: data.name,
        email: data.email,
        phone: data.phone,
        tierLabel: TIER_LABELS[data.tier] ?? data.tier,
        billingCycle: data.billingCycle,
        goals: data.goals,
        equipment: data.equipment,
        availability: data.availability,
        healthLimitations: data.healthLimitations,
        referral: data.referral,
      }),
    })
  } catch (e) {
    console.error('[apply] notification email failed', e)
  }

  return NextResponse.json({ ok: true })
}
