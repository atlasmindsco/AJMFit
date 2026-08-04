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
 * the application snapshot. No auth account is created here, that happens when
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

  // 1. Create or update the user by email WITHOUT clobbering their status.
  //    A blind upsert here once downgraded ACTIVE (paying) members back to
  //    'pending' when they re-submitted the public form, locking them out at
  //    the paywall and opening a double-subscribe path. Rules:
  //      - new email            -> insert as 'pending'
  //      - existing 'cancelled' -> back to 'pending' (declined/churned re-apply)
  //      - existing active/paused/pending -> keep status; refresh name/phone only
  const email = data.email.toLowerCase()
  const { data: existing, error: findErr } = await db
    .from('users')
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json(
      { error: 'Could not save your application. Please try again.' },
      { status: 500 }
    )
  }

  let userId: string
  if (!existing) {
    const { data: created, error: insErr } = await db
      .from('users')
      .insert({ name: data.name, email, phone: data.phone, status: 'pending' })
      .select('id')
      .single()
    if (insErr || !created) {
      return NextResponse.json(
        { error: 'Could not save your application. Please try again.' },
        { status: 500 }
      )
    }
    userId = created.id as string
  } else {
    const update: Record<string, string> = { name: data.name, phone: data.phone }
    if (existing.status === 'cancelled') update.status = 'pending'
    const { error: updErr } = await db.from('users').update(update).eq('id', existing.id)
    if (updErr) {
      return NextResponse.json(
        { error: 'Could not save your application. Please try again.' },
        { status: 500 }
      )
    }
    userId = existing.id as string
  }

  // 2. Insert the application snapshot.
  const { error: appErr } = await db.from('applications').insert({
    user_id: userId,
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

  // 4. Blueprint is self-guided (no coaching), so it skips the manual approval
  //    queue: auto-accept the application and create an instant login with a
  //    temporary password. No expiring email links — they can log in immediately.
  //    Coaching tiers still wait for the trainer to approve them in the dashboard.
  //    Best-effort — a hiccup here must never fail the applicant's submission.
  if (data.tier === 'blueprint') {
    try {
      await db
        .from('applications')
        .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'pending')

      // Only create auth account if they don't already have one
      const { data: u } = await db.from('users').select('auth_id').eq('id', userId).maybeSingle()
      if (!u?.auth_id) {
        // Generate a temporary password
        const tempPassword = `AJM${Math.random().toString(36).substring(2, 11).toUpperCase()}`

        // Create auth account and confirm email immediately (no recovery link needed)
        const { data: authUser, error: authErr } = await db.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true, // Confirm email immediately
        })

        if (!authErr && authUser?.id) {
          // Link the auth account to the user
          await db.from('users').update({ auth_id: authUser.id }).eq('id', userId)

          // Send them their login credentials (no expiring link)
          await sendMail({
            to: email,
            subject: 'Welcome to AJM Fit – Access Your Studio',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">Welcome to AJM Fit</h1>
                </div>
                <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                  <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hi ${data.name},
                  </p>
                  <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Your application is approved! You can now access The Blueprint and start training immediately.
                  </p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #666; font-size: 14px; margin: 0 0 10px;"><strong>Your Login Credentials:</strong></p>
                    <p style="color: #333; font-size: 14px; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="color: #333; font-size: 14px; margin: 5px 0;"><strong>Password:</strong> <code style="background: white; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://ajmfit.com/members" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      Log In Now
                    </a>
                  </div>
                  <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                    <strong>Pro tip:</strong> Change your password to something personal in your account settings after you log in.
                  </p>
                </div>
                <div style="text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #e5e7eb;">
                  <p>© 2026 AJM Fit. All rights reserved.</p>
                </div>
              </div>
            `,
            text: `Welcome to AJM Fit!\n\nYour application is approved! Log in with:\nEmail: ${email}\nPassword: ${tempPassword}\n\nChange your password after logging in.`,
          })
        }
      }
    } catch (e) {
      console.error('[apply] blueprint auto-approve failed', e)
    }
  }

  return NextResponse.json({ ok: true })
}
