/**
 * The one sentence about progress that is allowed on the home screen.
 *
 * This file exists because the obvious version of the feature is garbage, and
 * the checks below are the ones that would have caught it. Run "your X is up
 * N lbs" over the live workout_sets table with no filtering and the top three
 * results are Inverted Row up 145 lbs, Butt Lift (Bridge) up 130, Decline
 * Push-Up up 120 — every one a bodyweight movement where the client simply
 * changed what they type into the weight box.
 *
 * Shipping that teaches a client that the numbers in the app are decoration.
 */
import { bestLift, liftLine, MIN_SESSIONS } from '@/lib/progress-lines'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

/** n sessions climbing from `from` to `to`, newest first as the app returns them. */
const climb = (from: number, to: number, n: number, startMonth = '09') => {
  const step = (to - from) / (n - 1)
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({
      date: `2026-${startMonth}-${String(1 + i * 3).padStart(2, '0')}`,
      topWeight: Math.round(from + step * i),
    })
  }
  return out.reverse()
}

console.log('A REAL LIFT, WITH ENOUGH SESSIONS BEHIND IT\n')
const good = bestLift({ 'Dumbbell Bench Press': climb(20, 80, 6) })
console.log(`        -> ${liftLine(good)}`)
ok(good != null, 'is picked up')
ok(good?.exerciseName === 'Dumbbell Bench Press', 'by name', good?.exerciseName)
ok(good?.fromLb === 20 && good?.toLb === 80, 'first and last session, not best and worst', `${good?.fromLb} to ${good?.toLb}`)
ok(good?.sinceMonth === 'September', 'and the month it started', good?.sinceMonth)
ok(
  liftLine(good) === 'Dumbbell Bench Press: 20 to 80 lbs since September',
  'the sentence reads as a fact',
  String(liftLine(good))
)

console.log('\nBODYWEIGHT MOVEMENTS ARE NEVER MENTIONED\n')
/* The three that would really have shipped. The client did not get 145 lbs
   stronger at the Inverted Row; they started typing their bodyweight into a
   box that had been holding 0. */
for (const name of ['Inverted Row', 'Butt Lift (Bridge)', 'Decline Push-Up', 'Chin-Up', 'Pullups', 'Plank']) {
  const got = bestLift({ [name]: climb(0, 145, 8) })
  ok(got === null, `${name} is skipped`, got ? `claimed +${got.toLb - got.fromLb} lbs` : '')
}

console.log('\nAND A LOADED LIFT STILL WINS WHEN BOTH ARE PRESENT\n')
// The real case: a client's history holds both, and the bodyweight one has
// the bigger apparent gain. It must not be the one that gets said out loud.
const mixed = bestLift({
  'Inverted Row': climb(0, 145, 8),
  'Dumbbell Bench Press': climb(20, 80, 6),
})
ok(mixed?.exerciseName === 'Dumbbell Bench Press', 'the bench wins over the fake 145', mixed?.exerciseName)

console.log('\nFOUR SESSIONS, OR NOTHING IS SAID\n')
for (let n = 1; n < MIN_SESSIONS; n++) {
  const got = bestLift({ 'Barbell Squat': climb(95, 225, n + 1).slice(0, n) })
  ok(got === null, `${n} session${n === 1 ? '' : 's'} is not enough`, got ? 'claimed anyway' : '')
}
ok(bestLift({ 'Barbell Squat': climb(95, 225, MIN_SESSIONS) }) != null, `${MIN_SESSIONS} is enough`)

console.log('\nA LIFT THAT DID NOT GO UP IS NOT A PROGRESS LINE\n')
ok(bestLift({ 'Barbell Squat': climb(225, 185, 6) }) === null, 'going backwards says nothing')
ok(bestLift({ 'Barbell Squat': climb(185, 185, 6) }) === null, 'flat says nothing')

console.log('\nTHE BIGGEST GAIN WINS, MEASURED IN POUNDS\n')
/* Not percentages. A first session is calibration, not a baseline — the curl
   below went up 400% and 20 lbs, the squat 67% and 90 lbs. The squat is the
   one worth saying, and percentage would pick the curl. */
const two = bestLift({
  'Dumbbell Bicep Curl': climb(5, 25, 6),
  'Barbell Squat': climb(135, 225, 6),
})
console.log(`        -> ${liftLine(two)}`)
ok(two?.exerciseName === 'Barbell Squat', 'pounds, not percent', two?.exerciseName)

console.log('\nORDER DOES NOT MATTER\n')
// lib/workout.ts returns newest first. Sorting inside means a caller that
// hands them over oldest-first, or shuffled, gets the same answer.
const newestFirst = climb(20, 80, 6)
const oldestFirst = newestFirst.slice().reverse()
const a = bestLift({ Bench: newestFirst })
const b = bestLift({ Bench: oldestFirst })
ok(a?.fromLb === b?.fromLb && a?.toLb === b?.toLb, 'same answer either way', `${a?.fromLb}-${a?.toLb} vs ${b?.fromLb}-${b?.toLb}`)

console.log('\nNOTHING A NEW CLIENT CAN HAVE MAKES IT THROW OR LIE\n')
/* Today renders this for everybody, including somebody who signed up an hour
   ago. Returning null is the whole contract. */
for (const [label, input] of [
  ['no history at all', {}],
  ['an exercise with no sessions', { 'Barbell Squat': [] }],
  ['sets logged at zero weight', { 'Barbell Squat': climb(0, 0, 6) }],
  ['a malformed date', { 'Barbell Squat': [{ date: 'soon', topWeight: 100 }] }],
  ['a short date', { 'Barbell Squat': [{ date: '2026-09', topWeight: 100 }] }],
  ['a month out of range', { 'Barbell Squat': climb(20, 80, 6, '13') }],
] as Array<[string, Record<string, Array<{ date: string; topWeight: number }>>]>) {
  let got: unknown
  try {
    got = bestLift(input)
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(got === null, label, got === null ? '' : String(got))
}
ok(liftLine(null) === null, 'and no lift means no sentence')

console.log('\nTHE SENTENCE DOES NOT CHEER\n')
const words = String(liftLine(good))
ok(!/!/.test(words), 'no exclamation mark', words)
ok(!/amazing|crushing|beast|great job|well done/i.test(words), 'no praise', words)
ok(!/%/.test(words), 'and no percentage', words)

console.log(
  failed === 0 ? '\nAll progress-line checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
