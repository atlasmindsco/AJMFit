/**
 * Seeds (or updates) the trainer auth account with app_metadata.role = 'trainer'.
 * Run once:  node scripts/seed-trainer.mjs <email> <password>
 * Falls back to TRAINER_EMAIL / TRAINER_PASSWORD env or the values below.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL from .env.local.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// --- load .env.local ---
const env = {}
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
} catch {
  console.error('Could not read .env.local'); process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const email = (process.argv[2] || process.env.TRAINER_EMAIL || 'anthony@ajmfit.com').toLowerCase()
const password = process.argv[3] || process.env.TRAINER_PASSWORD
if (!password) {
  console.error('Usage: node scripts/seed-trainer.mjs <email> <password>')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Find existing user by email (paginate a little just in case).
let existing = null
for (let page = 1; page <= 5 && !existing; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) { console.error(error.message); process.exit(1) }
  existing = data.users.find((u) => u.email?.toLowerCase() === email)
  if (data.users.length < 200) break
}

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    app_metadata: { ...existing.app_metadata, role: 'trainer' },
  })
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Updated existing trainer: ${email} (role=trainer, password reset)`)
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'trainer' },
  })
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Created trainer: ${email} (role=trainer)`)
}
