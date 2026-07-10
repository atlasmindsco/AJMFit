/** Lists applications with their user + status (read-only). */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: apps, error } = await sb
  .from('applications')
  .select('id, user_id, tier, billing_cycle, status, created_at, users(name, email, status)')
  .order('created_at', { ascending: false })
if (error) { console.error(error); process.exit(1) }

console.log(`applications: ${apps.length}\n`)
for (const a of apps) {
  const u = a.users || {}
  console.log(`${a.created_at?.slice(0, 10)} | app:${a.status} user:${u.status} | ${u.name} <${u.email}> | ${a.tier}/${a.billing_cycle} | id ${a.id}`)
}
process.exit(0)
