/**
 * What gets recorded when a client opens a screen, and what does not.
 *
 * The app has never recorded a single view, so every claim five audits have
 * made about what clients look at — mine included — is inference. This is the
 * smallest thing that answers it: who, which path, when.
 *
 * The checks that matter are about what it REFUSES to store. A query string
 * on this app carries exercise names and day indexes, and none of that is
 * needed to answer "which screens do people open".
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

const { normalisePath, shouldRecord } = await import('../lib/screen-views.ts')

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log('THE QUERY STRING IS NEVER STORED\n')
/* ?view=exercise&ex=Barbell+Squat tells you which lift somebody is doing.
   That is in workout_sets already, properly, and has no business being in a
   page-view log as well. */
for (const [raw, want] of [
  ['/studio/programs?view=exercise&ex=Barbell+Squat', '/studio/programs'],
  ['/studio/programs?day=2', '/studio/programs'],
  ['/studio/nutrition?tab=meals', '/studio/nutrition'],
  ['/studio#today', '/studio'],
] as Array<[string, string]>) {
  ok(normalisePath(raw) === want, raw.slice(0, 44), normalisePath(raw))
}

console.log('\nIDS COLLAPSE, SO ONE SCREEN STAYS ONE SCREEN\n')
// Without this a route with an id in it becomes a thousand distinct paths and
// the counts answer nothing.
ok(
  normalisePath('/studio/x/7f3a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90') === '/studio/x/:id',
  'a uuid becomes :id',
  normalisePath('/studio/x/7f3a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90')
)
ok(normalisePath('/studio/day/12') === '/studio/day/:n', 'a number becomes :n', normalisePath('/studio/day/12'))

console.log('\nTRAILING SLASHES DO NOT SPLIT A SCREEN IN TWO\n')
ok(normalisePath('/studio/nutrition/') === normalisePath('/studio/nutrition'), 'with and without match')
ok(normalisePath('/') === '/', 'the root survives', normalisePath('/'))

console.log('\nONLY CLIENT SCREENS ARE COUNTED\n')
for (const path of ['/studio', '/studio/programs', '/studio/nutrition?x=1']) {
  ok(shouldRecord(path), `${path} counts`)
}
for (const path of ['/luffy', '/luffy/clients', '/members', '/', '/api/chat', '/work-with-me']) {
  ok(!shouldRecord(path), `${path} does not`)
}

console.log('\nNOTHING MALFORMED PRODUCES A STORED PATH\n')
for (const [label, raw] of [
  ['empty', ''],
  ['not a path', 'studio'],
  ['a full URL', 'https://ajmfit.com/studio'],
] as Array<[string, string]>) {
  let got: string
  try {
    got = normalisePath(raw)
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(got.startsWith('/'), label, got)
  ok(!got.includes('ajmfit.com'), '  and carries no host', got)
}

console.log('\nTHE COUNTS WOULD ACTUALLY ANSWER THE QUESTION\n')
/* The reason this exists: to tell "opens the app and leaves" from "never
   opens the app". Both of those produce distinguishable rows. */
const screens = ['/studio', '/studio/programs', '/studio/nutrition', '/studio/messages'].map(normalisePath)
ok(new Set(screens).size === 4, 'the four tabs are four distinct paths', screens.join(' '))
ok(
  normalisePath('/studio/programs?day=2') === normalisePath('/studio/programs?view=builder'),
  'and starting a workout is not a different screen from opening the plan'
)

console.log(failed === 0 ? '\nAll screen-view checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
