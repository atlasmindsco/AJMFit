/** Runs Shane's three diagnostic queries for rumafle07@gmail.com. Read-only. */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const EMAIL = 'rumafle07@gmail.com'

console.log('===== 1) public user + application =====')
const q1 = await c.query(
  `SELECT u.id, u.name, u.email, u.phone, u.status, u.auth_id, u.created_at,
          a.tier, a.status AS app_status, a.created_at AS applied_at, a.reviewed_at
   FROM public.users u
   LEFT JOIN LATERAL (
     SELECT tier, status, created_at, reviewed_at
     FROM public.applications WHERE user_id = u.id
     ORDER BY created_at DESC LIMIT 1
   ) a ON true
   WHERE u.email = $1`,
  [EMAIL]
)
console.log(JSON.stringify(q1.rows, null, 2))

console.log('\n===== 2) auth.users row =====')
const q2 = await c.query(
  `SELECT id AS auth_id, email, created_at, invited_at, confirmed_at,
          email_confirmed_at, last_sign_in_at, recovery_sent_at, email_change_sent_at
   FROM auth.users WHERE email = $1`,
  [EMAIL]
)
console.log(JSON.stringify(q2.rows, null, 2))

console.log('\n===== 3) auth audit events (latest 50) =====')
const q3 = await c.query(
  `SELECT created_at,
          payload ->> 'action' AS action,
          payload -> 'traits' ->> 'user_email' AS user_email,
          payload ->> 'actor_username' AS actor
   FROM auth.audit_log_entries
   WHERE payload -> 'traits' ->> 'user_email' = $1
      OR payload ->> 'actor_username' = $1
   ORDER BY created_at DESC LIMIT 50`,
  [EMAIL]
)
for (const r of q3.rows) {
  console.log(`${r.created_at.toISOString()} | ${r.action} | actor=${r.actor ?? '-'} | user_email=${r.user_email ?? '-'}`)
}
console.log(`(${q3.rows.length} events)`)
await c.end()
