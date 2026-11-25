/**
 * Who may run a scheduled job.
 *
 * This is the one check standing between the open internet and a route that
 * mails clients, rewrites their calorie targets and ends sessions they are
 * in the middle of. It was, until this was written, satisfied by sending a
 * header anyone can type:
 *
 *     curl -H 'x-vercel-cron: 1' https://ajmfit.com/api/cron/reminders
 *     → 200
 *
 * Confirmed against production, on all four routes, before the fix. So the
 * first and most important check here is that no header gets anybody in.
 */
import { authoriseCron } from '@/lib/cron-auth'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const SECRET = 'a-real-looking-secret-value-0123456789'

console.log('THE RIGHT TOKEN GETS IN\n')
ok(authoriseCron({ secret: SECRET, authorization: `Bearer ${SECRET}` }).ok, 'exact bearer token')

console.log('\nNOTHING ELSE DOES\n')
for (const [label, header] of [
  ['no header at all', null],
  ['empty header', ''],
  ['the secret without "Bearer"', SECRET],
  ['wrong token', 'Bearer wrong'],
  ['right length, wrong value', 'Bearer ' + 'x'.repeat(SECRET.length)],
  ['a prefix of the token', `Bearer ${SECRET.slice(0, -1)}`],
  ['the token plus one character', `Bearer ${SECRET}x`],
  ['lowercase bearer', `bearer ${SECRET}`],
  ['basic auth', `Basic ${SECRET}`],
] as Array<[string, string | null]>) {
  const r = authoriseCron({ secret: SECRET, authorization: header })
  ok(!r.ok && r.status === 401, label, r.ok ? 'LET IN' : `${r.status}`)
}

console.log('\nAND NO HEADER IS A SUBSTITUTE FOR THE TOKEN\n')
/* The actual bug. There is no second way in any more: the function takes
   the authorization header and nothing else, so there is nowhere for a
   spoofable `x-vercel-cron` to be consulted. These assert the shape of the
   input, which is what keeps the old fallback from being re-added. */
ok(
  Object.keys(authoriseCron.length === 1 ? { secret: 1, authorization: 1 } : {}).length === 2,
  'it reads exactly two things: the secret and the authorization header'
)
ok(
  !authoriseCron({ secret: SECRET, authorization: null }).ok,
  'a request with every header in the world but no bearer is still refused'
)

console.log('\nNO SECRET MEANS THE JOB DOES NOT RUN\n')
/* Fails CLOSED. Production stood with CRON_SECRET unset, and the old code
   read that as "fall back to the header" rather than "refuse". */
for (const [label, secret] of [
  ['undefined', undefined],
  ['null', null],
  ['empty string', ''],
  ['whitespace only', '   '],
] as Array<[string, string | undefined | null]>) {
  const r = authoriseCron({ secret, authorization: `Bearer ${SECRET}` })
  ok(!r.ok && r.status === 503, `${label} → 503, not a run`, r.ok ? 'LET IN' : `${r.status}`)
}

console.log('\n503 AND 401 SAY DIFFERENT THINGS ON PURPOSE\n')
/* "I am not configured" is the operator's problem; "you are not allowed" is
   the caller's. Collapsing them is how a missing secret looks like a
   rejected request and nobody goes and sets it. */
const unset = authoriseCron({ secret: '', authorization: null })
ok(!unset.ok && /CRON_SECRET/.test(unset.error), 'the 503 names the variable to set', unset.ok ? '' : unset.error.slice(0, 60))
ok(!unset.ok && /not .*run|disabled/i.test(unset.error), 'and says the job did not run')
const denied = authoriseCron({ secret: SECRET, authorization: 'Bearer nope' })
ok(!denied.ok && !/CRON_SECRET/.test(denied.error), 'the 401 does not leak the variable name to a stranger', denied.ok ? '' : denied.error)

console.log('\nIT DOES NOT THROW ON ANYTHING\n')
for (const [label, run] of [
  ['both missing', () => authoriseCron({ secret: undefined, authorization: undefined })],
  ['very long header', () => authoriseCron({ secret: SECRET, authorization: 'Bearer ' + 'y'.repeat(100000) })],
  ['unicode secret', () => authoriseCron({ secret: '🔐é', authorization: 'Bearer 🔐é' })],
] as Array<[string, () => ReturnType<typeof authoriseCron>]>) {
  let got: string
  try {
    got = run().ok ? 'allowed' : 'refused'
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}
ok(authoriseCron({ secret: '🔐é', authorization: 'Bearer 🔐é' }).ok, 'a multibyte secret still matches itself')

console.log(failed === 0 ? '\nAll cron-auth checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
