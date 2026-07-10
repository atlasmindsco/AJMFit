/**
 * One-time catch-up: emails Coach Anthony the instructional notification for
 * every PENDING application (ones submitted before the notification existed).
 * Mirrors lib/email.ts applicationNotificationHTML. Run:
 *   node scripts/notify-pending-apps.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const COACH_EMAIL = 'anthony@ajmfit.com'
const TIER_LABELS = { blueprint: 'The Blueprint', accelerator: 'The Accelerator', 'full-experience': 'The Full Experience' }

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 465), secure: Number(env.SMTP_PORT ?? 465) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
})

function notificationHTML(a, u) {
  const first = (u.name || '').trim().split(/\s+/)[0]
  const tierLabel = TIER_LABELS[a.tier] ?? a.tier
  const row = (label, value) =>
    `<tr><td style="color:#94a3b8;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;padding:12px 0 2px;">${label}</td></tr>
     <tr><td style="color:#1B2D50;font-size:15px;line-height:1.6;padding-bottom:10px;border-bottom:1px solid #eef1f5;">${value}</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1B2D50;padding:24px 32px;" align="center">
        <img src="https://ajmfit.com/AJMfit.png" width="44" height="44" alt="AJM Fit" style="display:block;margin:0 auto 8px;" />
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">AJM FIT</div>
      </td></tr>
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 4px;color:#F76B16;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">New application</p>
        <h1 style="margin:0 0 6px;color:#1B2D50;font-size:22px;font-weight:800;">${u.name}</h1>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">${first} applied for <strong>${tierLabel}</strong> (${a.billing_cycle}).</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;border-left:4px solid #F76B16;border-radius:6px;margin:0 0 24px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 12px;color:#1B2D50;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">What to do next</p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;"><strong>1.</strong> Tap the orange <strong>Review in dashboard</strong> button below to open your coach portal.</p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;"><strong>2.</strong> Find <strong>${first}</strong> in your Clients list (they'll be marked <strong>Pending</strong>).</p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;"><strong>3.</strong> Tap <strong>Approve</strong> to send ${first} a welcome email to set up their account and start their plan. Tap <strong>Decline</strong> if they're not the right fit.</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;"><strong>4.</strong> Want to ask a question first? Just <strong>reply to this email</strong> and it goes straight to ${first}.</p>
          </td></tr>
        </table>
        <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;">Their application</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row('Email', `<a href="mailto:${u.email}" style="color:#1A7BFF;">${u.email}</a>`)}
          ${row('Phone', u.phone || 'Not provided')}
          ${row('Goals', a.goals)}
          ${row('Equipment', (a.equipment || []).join(', '))}
          ${row('Availability', a.availability)}
          ${a.health_limitations ? row('Health notes', a.health_limitations) : ''}
          ${a.referral ? row('Referral', a.referral) : ''}
        </table>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;" align="center">
        <a href="https://ajmfit.com/luffy" style="display:inline-block;background:#F76B16;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border-radius:8px;">Review in dashboard</a>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">This is where you manage every client. Bookmark it: <a href="https://ajmfit.com/luffy" style="color:#1A7BFF;">ajmfit.com/luffy</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>`
}

const { data: apps, error } = await sb
  .from('applications')
  .select('id, tier, billing_cycle, goals, equipment, availability, health_limitations, referral, status, users(name, email, phone)')
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
if (error) { console.error(error); process.exit(1) }

console.log(`pending applications: ${apps.length}`)
for (const a of apps) {
  const u = a.users || {}
  const tierLabel = TIER_LABELS[a.tier] ?? a.tier
  await transport.sendMail({
    from: env.SMTP_FROM ?? `AJM Fit <${env.SMTP_USER}>`,
    to: COACH_EMAIL,
    replyTo: u.email,
    subject: `New application: ${u.name} (${tierLabel})`,
    html: notificationHTML(a, u),
  })
  console.log(`  sent -> ${COACH_EMAIL} for ${u.name} <${u.email}>`)
}
console.log('done.')
process.exit(0)
