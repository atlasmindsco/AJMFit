/** Verifies the re-apply fix: active user stayed active; removes the test application row. */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: u } = await sb.from('users').select('id,status,is_beta').eq('email', 'shanmarric@gmail.com').single()
console.log(`user status after re-apply: ${u.status} (expect: active)`)

const { data: apps } = await sb.from('applications').select('id,goals,created_at').eq('user_id', u.id).order('created_at', { ascending: false })
const test = (apps ?? []).find((a) => a.goals?.includes('AUDIT TEST'))
if (test) {
  await sb.from('applications').delete().eq('id', test.id)
  console.log(`test application ${test.id} deleted`)
} else {
  console.log('no test application found')
}
console.log(u.status === 'active' ? 'PASS: active status preserved' : 'FAIL: status was clobbered!')
process.exit(0)
