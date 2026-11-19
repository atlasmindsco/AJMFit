/**
 * Where a client says they are starting from, and what it changes.
 *
 * For months this resolved to 'beginner' for everybody: it read an onboarding
 * answer, Blueprint clients never fill in onboarding, and the table is empty.
 * The beginner rules are the aggressive ones — 5 lb on an upper-body lift and
 * 10 on a lower-body one, earned after a single good session — so a client two
 * years in was being told to put another 10 lb on their squat every time they
 * hit the top of the range.
 *
 * The picker asks now and the answer is stored, so these three strings decide
 * real numbers and are worth pinning down.
 */
import { experienceFrom, experienceKnown, nextTarget } from '@/lib/progression'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log("THE PICKER'S THREE ANSWERS MAP TO A TRAINING AGE\n")
ok(experienceFrom('new', null) === 'beginner', 'new to lifting -> beginner', experienceFrom('new', null))
ok(experienceFrom('returning', null) === 'beginner', 'coming back -> beginner', experienceFrom('returning', null))
ok(
  experienceFrom('consistent', null) === 'intermediate',
  'training already -> intermediate',
  experienceFrom('consistent', null)
)

console.log('\nAND ALL THREE COUNT AS AN ANSWER\n')
for (const e of ['new', 'returning', 'consistent']) {
  ok(experienceKnown(e, null), `"${e}" is a real answer, not a default`)
}
ok(!experienceKnown(null, null), 'no answer is not mistaken for one')
ok(!experienceKnown(undefined, ''), 'an empty answer is not mistaken for one')

console.log('\nNOTHING AN EMPTY ONBOARDING ROW CAN SAY BREAKS IT\n')
// Every shape the old path could hand this, now that it is no longer the
// only source. The safe fallback is beginner: guessing small never hurts.
for (const [e, y] of [
  [undefined, undefined],
  [null, null],
  ['', ''],
  [null, 0],
  ['nonsense', 'nonsense'],
] as Array<[unknown, unknown]>) {
  const got = experienceFrom(e as string, y as string)
  ok(got === 'beginner', `(${String(e)}, ${String(y)}) falls back to beginner`, got)
}

console.log('\nWHAT IT ACTUALLY CHANGES, ON THE SAME HISTORY\n')
// Three sessions at 185 lb, topping an 8-12 range every time. The only
// difference between the two runs below is what the client said about
// themselves.
const history = [
  { topWeight: 185, topReps: 12, lowestReps: 12, rir: 1, at: '2026-11-17' },
  { topWeight: 185, topReps: 12, lowestReps: 12, rir: 1, at: '2026-11-13' },
  { topWeight: 180, topReps: 10, lowestReps: 10, rir: 2, at: '2026-11-10' },
]
const run = (said: string) =>
  nextTarget(
    'Barbell Squat',
    '8-12',
    { level: experienceFrom(said, null), daysSinceLast: 3, bodyWeightLb: 185 },
    history as never
  )

const asNew = run('new')
const asTrained = run('consistent')
console.log(`        new to lifting   -> ${asNew?.verdict}, ${asNew?.suggestedWeight} lbs`)
console.log(`        training already -> ${asTrained?.verdict}, ${asTrained?.suggestedWeight} lbs`)
ok(asNew?.suggestedWeight === 195, 'a beginner gets the full 10 lb jump on a squat', String(asNew?.suggestedWeight))

/* THE SAME JUMP, AND THAT IS WHAT THE TABLE SAYS.
   I expected the experienced lifter to get a smaller increase and wrote a
   check asserting it. The check failed and the code was right: in LEVELS,
   beginner and intermediate carry identical increments — 5 lb upper, 10 lb
   lower — and only the advanced tier takes 2.5 and 5. Nothing the picker can
   answer reaches advanced; that needs two years of training age, which only
   the coached intake form collects.

   So the picker's answer changes stall patience (3 flat sessions versus 4)
   and nothing else about the load. Whether an intermediate should take
   smaller jumps than a true novice is a coaching decision on live clients,
   not something to slip in behind a verifier. Pinned as it stands, so a
   change to it is deliberate. */
ok(
  asTrained?.suggestedWeight === asNew?.suggestedWeight,
  'and so does somebody already training — the tiers share an increment',
  `${asTrained?.suggestedWeight} vs ${asNew?.suggestedWeight}`
)

console.log('\nWHAT THE ANSWER DOES CHANGE: HOW LONG BEFORE A STALL IS CALLED\n')
// Three flat sessions at the top, working hard. A beginner's patience runs
// out at three; an intermediate waits for a fourth.
const flat = [0, 1, 2].map((i) => ({
  topWeight: 185,
  topReps: 12,
  lowestReps: 12,
  rir: 1,
  at: `2026-11-${17 - i * 3}`,
}))
const stalled = (said: string) =>
  nextTarget(
    'Barbell Squat',
    '12',
    { level: experienceFrom(said, null), daysSinceLast: 3, bodyWeightLb: 185 },
    flat as never
  )
console.log(`        new to lifting   -> ${stalled('new')?.verdict}`)
console.log(`        training already -> ${stalled('consistent')?.verdict}`)
ok(
  stalled('new')?.verdict !== stalled('consistent')?.verdict,
  'the two tiers do not agree about when to call it',
  `${stalled('new')?.verdict} vs ${stalled('consistent')?.verdict}`
)

console.log('\nAN UPPER-BODY LIFT TAKES A SMALLER JUMP THAN A SQUAT\n')
const upper = nextTarget(
  'Barbell Bench Press - Medium Grip',
  '8-12',
  { level: 'beginner', daysSinceLast: 3, bodyWeightLb: 185 },
  history as never
)
ok(
  upper != null && asNew != null && upper.suggestedWeight! < asNew.suggestedWeight!,
  'bench moves up less than squat',
  `${upper?.suggestedWeight} vs ${asNew?.suggestedWeight}`
)

console.log(
  failed === 0 ? '\nAll experience checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
