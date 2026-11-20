/**
 * "Add 5 lb" is meaningless on a movement the body loads.
 *
 * The guard that catches this has existed for a while and has never fired.
 * It needs the client's bodyweight, read it from the coached intake form,
 * and Blueprint clients never fill that in — so the weight was always null,
 * the check always declined, and a real client is currently being told to put
 * another 5 lb on a Butt Lift (Bridge) he logs at his own bodyweight.
 *
 * The weight now comes from the weigh-in at the end of a workout. These
 * checks are what the guard is supposed to do once it has one.
 */
import { nextTarget, isBodyweightMovement } from '@/lib/progression'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

/* Eight sessions topping a 12-15 range at 175 lb — a client's own weight
   typed into the load field, which is what these movements collect. */
const history = [0, 1, 2].map((i) => ({
  topWeight: 175,
  topReps: 15,
  lowestReps: 15,
  rir: 2,
  at: `2026-11-${18 - i * 2}`,
}))

const ask = (name: string, bodyWeightLb: number | null) =>
  nextTarget(name, '12-15', { level: 'beginner', daysSinceLast: 2, bodyWeightLb }, history as never)

console.log('MOVEMENTS THE BODY LOADS ARE RECOGNISED\n')
for (const n of [
  'Butt Lift (Bridge)',
  'Single Leg Glute Bridge',
  'Chin-Up',
  'Pullups',
  'Decline Push-Up',
  'Inverted Row',
  'Plank',
  'Floor Glute-Ham Raise',
]) {
  ok(isBodyweightMovement(n), n)
}
console.log('\n  and loaded lifts are not:')
for (const n of ['Barbell Squat', 'Dumbbell Bench Press', 'Triceps Pushdown', 'Barbell Hip Thrust']) {
  ok(!isBodyweightMovement(n), n)
}

console.log('\nWITH A WEIGH-IN ON RECORD, THE ADVICE CHANGES\n')
const known = ask('Butt Lift (Bridge)', 180)
const unknown = ask('Butt Lift (Bridge)', null)
console.log(`        no weigh-in -> ${unknown?.verdict}: "${unknown?.text}"`)
console.log(`        weighs 180  -> ${known?.verdict}: "${known?.text}"`)
ok(unknown?.verdict === 'add_load', 'with no weight on record it still says add load — the old behaviour', String(unknown?.verdict))
ok(known?.verdict === 'push_reps', 'with a weigh-in it says add a rep instead', String(known?.verdict))
ok(known?.addLoad === false, 'and does not ask for more weight')
ok(
  (known?.text ?? '').toLowerCase().includes('weight box'),
  'and tells them to leave the weight box alone',
  known?.text ?? ''
)

console.log('\nTHE TOLERANCE IS A WINDOW, NOT AN EXERCISE-NAME RULE\n')
// 12 lb either side. A loaded chin-up at bodyweight+45 is a real load and
// must still progress by weight.
ok(ask('Chin-Up', 175)?.verdict === 'push_reps', 'logged at exactly bodyweight -> reps')
ok(ask('Chin-Up', 186)?.verdict === 'push_reps', '11 lb out is still within the window')
ok(ask('Chin-Up', 130)?.verdict === 'add_load', 'a weighted chin-up still adds load', String(ask('Chin-Up', 130)?.verdict))

console.log('\nA LOADED LIFT IS NEVER CAUGHT BY IT\n')
ok(
  ask('Barbell Squat', 175)?.verdict === 'add_load',
  'squatting your own bodyweight is a coincidence, not a bodyweight movement',
  String(ask('Barbell Squat', 175)?.verdict)
)

console.log(
  failed === 0 ? '\nAll bodyweight-guard checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
