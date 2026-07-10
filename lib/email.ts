// Server-only transactional email via Hostinger SMTP (the same mailbox that
// powers branded auth emails). Reads SMTP_* from env; if unset, sends are
// skipped gracefully so callers never break.
import nodemailer from 'nodemailer'

function getTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  const port = Number(process.env.SMTP_PORT ?? 465)
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
}

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text?: string
  ics?: string
  replyTo?: string
}): Promise<boolean> {
  const transport = getTransport()
  if (!transport) {
    console.warn('[email] SMTP not configured, skipping send')
    return false
  }
  const from = process.env.SMTP_FROM ?? `AJM Fit <${process.env.SMTP_USER}>`
  await transport.sendMail({
    from,
    to: opts.to,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    ...(opts.ics ? { icalEvent: { method: 'REQUEST', filename: 'session.ics', content: opts.ics } } : {}),
  })
  return true
}

/** Minimal RFC-5545 VEVENT so the booking lands on the client's calendar. */
export function buildEventICS(opts: {
  uid: string
  title: string
  description?: string
  location?: string
  startISO: string
  durationMin: number
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = new Date(opts.startISO)
  const end = new Date(start.getTime() + opts.durationMin * 60_000)
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AJM Fit//Scheduling//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : '',
    opts.location ? `LOCATION:${esc(opts.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

/** Branded HTML notifying Coach Anthony of a new application. */
export function applicationNotificationHTML(opts: {
  name: string
  email: string
  phone: string
  tierLabel: string
  billingCycle: string
  goals: string
  equipment: string[]
  availability: string
  healthLimitations?: string | null
  referral?: string | null
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="color:#94a3b8;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;padding:12px 0 2px;">${label}</td></tr>
     <tr><td style="color:#1B2D50;font-size:15px;line-height:1.6;padding-bottom:10px;border-bottom:1px solid #eef1f5;">${value}</td></tr>`
  const first = opts.name.trim().split(/\s+/)[0]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1B2D50;padding:24px 32px;" align="center">
        <img src="https://ajmfit.com/AJMfit.png" width="44" height="44" alt="AJM Fit" style="display:block;margin:0 auto 8px;" />
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">AJM FIT</div>
      </td></tr>
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 4px;color:#F76B16;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">New application</p>
        <h1 style="margin:0 0 6px;color:#1B2D50;font-size:22px;font-weight:800;">${opts.name}</h1>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">${first} applied for <strong>${opts.tierLabel}</strong> (${opts.billingCycle}).</p>

        <!-- What to do next -->
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
          ${row('Email', `<a href="mailto:${opts.email}" style="color:#1A7BFF;">${opts.email}</a>`)}
          ${row('Phone', opts.phone)}
          ${row('Goals', opts.goals)}
          ${row('Equipment', opts.equipment.join(', '))}
          ${row('Availability', opts.availability)}
          ${opts.healthLimitations ? row('Health notes', opts.healthLimitations) : ''}
          ${opts.referral ? row('Referral', opts.referral) : ''}
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

/** Branded HTML for a session booking confirmation (matches AJM Fit auth emails). */
export function sessionConfirmationHTML(opts: {
  firstName: string
  type: string
  when: string
  durationMin: number
  joinUrl?: string | null
}): string {
  const cta = opts.joinUrl
    ? `<a href="${opts.joinUrl}" style="display:inline-block;background:#F76B16;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border-radius:8px;">Join on Zoom</a>
       <p style="margin:18px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">Or paste this link into your browser:<br /><a href="${opts.joinUrl}" style="color:#1A7BFF;word-break:break-all;">${opts.joinUrl}</a></p>`
    : `<p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">Coach Anthony will share the meeting details before your session.</p>`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1B2D50;padding:24px 32px;" align="center">
        <img src="https://ajmfit.com/AJMfit.png" width="44" height="44" alt="AJM Fit" style="display:block;margin:0 auto 8px;" />
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">AJM FIT</div>
      </td></tr>
      <tr><td style="padding:36px 32px 16px;">
        <h1 style="margin:0 0 14px;color:#1B2D50;font-size:24px;font-weight:800;">You're booked${opts.firstName ? ', ' + opts.firstName : ''}</h1>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">Your session with Coach Anthony is confirmed:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="color:#1B2D50;font-size:16px;font-weight:700;padding-bottom:4px;">${opts.type}</td></tr>
          <tr><td style="color:#475569;font-size:14px;">${opts.when} &middot; ${opts.durationMin} min</td></tr>
        </table>
        ${cta}
      </td></tr>
      <tr><td style="padding:24px 32px 32px;border-top:1px solid #eef1f5;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">A calendar invite is attached. Need to change this time? Reply to this email and we'll sort it out.<br />AJM Fit &middot; Personal Training &amp; Coaching</p>
      </td></tr>
    </table>
  </td></tr>
</table>`
}
