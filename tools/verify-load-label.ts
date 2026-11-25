/**
 * The "Today" load line, and the two unknowns it used to confuse.
 *
 * This existed as a ternary inside 5,000 lines of JSX and said "Bodyweight"
 * whenever the engine had no suggestion. Anthony opened a swapped squat slot
 * on his own account and the app told him to squat his bodyweight for 5,
 * directly underneath his own 155 lb record. Not a styling problem — the
 * screen stated something untrue about what he should lift.
 *
 * Pinned here because the failure is one keystroke away from coming back:
 * `null` is "I do not know yet" and must never render as an instruction.
 */
import { loadLabel } from '@/lib/progression'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log('A KNOWN LOAD IS PRINTED AS A LOAD\n')
for (const [w, want] of [
  [185, '185 lb'],
  [45, '45 lb'],
  [2.5, '2.5 lb'],
] as Array<[number, string]>) {
  ok(loadLabel(w, 'Barbell Bench Press') === want, `${w} reads "${want}"`, loadLabel(w, 'Barbell Bench Press'))
}

console.log('\nZERO IS A LOAD, NOT AN ABSENCE\n')
/* An empty bar prescribed deliberately — a warm-up or a technique session —
   is a real instruction and must not fall through to the unknown branch. */
ok(loadLabel(0, 'Barbell Squat') === '0 lb', 'zero prints as zero', loadLabel(0, 'Barbell Squat'))

console.log('\nNO SUGGESTION ON A LOADED LIFT IS NOT "BODYWEIGHT"\n')
/* The actual bug, in the actual words. */
for (const name of [
  'Barbell Full Squat',
  'Barbell Squat',
  'Barbell Bench Press - Medium Grip',
  'Leg Press',
  'Romanian Deadlift',
  'Standing Military Press',
]) {
  const got = loadLabel(null, name)
  ok(got !== 'Bodyweight', `${name} is never told "Bodyweight"`, got)
}
ok(loadLabel(null, 'Barbell Full Squat') === 'Your call', 'it says "Your call" instead', loadLabel(null, 'Barbell Full Squat'))

console.log('\nNO SUGGESTION ON A BODYWEIGHT MOVEMENT STILL IS "BODYWEIGHT"\n')
/* The branch that was right all along, and must survive the fix. */
for (const name of ['Pullups', 'Chin-Up', 'Push-Ups', 'Dips - Triceps Version', 'Plank', 'Hanging Leg Raise']) {
  ok(loadLabel(null, name) === 'Bodyweight', `${name} reads "Bodyweight"`, loadLabel(null, name))
}

console.log('\nIT NEVER RETURNS SOMETHING UNREADABLE\n')
for (const [w, name] of [
  [null, ''],
  [null, 'Some Exercise Nobody Has Heard Of'],
  [500, 'Rack Pull'],
] as Array<[number | null, string]>) {
  const got = loadLabel(w, name)
  ok(typeof got === 'string' && got.length > 0 && !got.includes('null') && !got.includes('undefined'), `(${w}, "${name}")`, got)
}

console.log(failed === 0 ? '\nAll load-label checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
