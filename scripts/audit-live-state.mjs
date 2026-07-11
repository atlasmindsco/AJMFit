/**
 * Read-only live-state audit: Calendly event types (durations/slugs) +
 * Supabase table state (counts, pending users, sessions, subscriptions).
 * Run: node scripts/audit-live-state.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}

// --- Calendly event types ---
console.log('=== CALENDLY EVENT TYPES ===')
try {
  const me = await fetch('https://api.calendly.com/users/me', {
    headers: { Authorization: `Bearer ${env.CALENDLY_API_TOKEN}` },
  })
  if (!me.ok) {
    console.log(`users/me -> HTTP ${me.status} (token dead or rotated)`)
  } else {
    const uri = (await me.json()).resource.uri
    const et = await fetch(`https://api.calendly.com/event_types?user=${encodeURIComponent(uri)}&count=20`, {
      headers: { Authorization: `Bearer ${env.CALENDLY_API_TOKEN}` },
    })
    const data = await et.json()
    for (const e of data.collection ?? []) {
      console.log(`  ${e.active ? 'ACTIVE ' : 'inactive'} | ${e.duration} min | slug=${e.slug} | "${e.name}"`)
    }
  }
} catch (e) { console.log('calendly error:', e.message) }

// --- Supabase state ---
console.log('\n=== SUPABASE STATE ===')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const tables = ['users', 'applications', 'subscriptions', 'scheduled_sessions', 'messages', 'posts', 'feedback', 'programs', 'program_assignments', 'workouts']
for (const t of tables) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`  ${t.padEnd(20)} ${error ? 'ERR ' + error.message : count + ' rows'}`)
}
const { data: users } = await sb.from('users').select('name,email,status,is_beta,auth_id').order('created_at')
console.log('\n  users detail:')
for (const u of users ?? []) console.log(`   ${u.status.padEnd(9)} beta:${u.is_beta ? 'Y' : 'n'} auth:${u.auth_id ? 'Y' : 'n'} | ${u.name} <${u.email}>`)
const { data: sessions } = await sb.from('scheduled_sessions').select('type,status,starts_at,join_url').order('starts_at', { ascending: false }).limit(5)
console.log('\n  recent sessions:')
for (const s of sessions ?? []) console.log(`   ${s.status.padEnd(10)} ${s.starts_at} | ${s.type} | zoom:${s.join_url ? 'Y' : 'n'}`)
process.exit(0)
