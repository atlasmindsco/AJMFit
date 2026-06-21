/**
 * Fires a live password-reset email through Supabase + the new custom SMTP.
 * Verifies BOTH the sender (anthony@ajmfit.com) and the branded template.
 *
 * Usage:  node scripts/test-email.mjs <email-to-send-to>
 * Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local.
 */
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const to = process.argv[2]
if (!to) { console.error('Pass an email: node scripts/test-email.mjs you@example.com'); process.exit(1) }

const res = await fetch(`${url}/auth/v1/recover`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: to }),
})
console.log(`Reset email -> ${to}`)
console.log(`HTTP ${res.status}`)
console.log(await res.text())
