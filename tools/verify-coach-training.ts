/**
 * What a client actually did, assembled from logged sets.
 *
 * 1,371 of them existed and no coach screen displayed one: you could see that
 * a workout happened and not what was in it. The arrows this produces are the
 * only interpretation on that screen, so they are worth pinning — a wrong
 * "down from 80" is the app telling a coach something untrue about a person.
 */
import { buildSessions, topWeight, durationLabel, setLabel, type CoachSet } from '@/lib/coach-training'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const set = (
  workoutId: string,
  date: string,
  exerciseName: string,
  weight: number | null,
  reps: number,
  setNumber: number,
  over: Partial<CoachSet> = {}
) => ({
  workoutId,
  date,
  dayName: 'Push',
  durationSeconds: 3120,
  exerciseName,
  weight,
  reps,
  setNumber,
  rir: null,
  swappedFrom: null,
  isIntensitySet: false,
  ...over,
})

console.log('SESSIONS COME BACK NEWEST FIRST\n')
const sessions = buildSessions([
  set('w1', '2026-11-16', 'Barbell Squat', 225, 5, 1),
  set('w2', '2026-11-19', 'Barbell Bench Press', 185, 10, 1),
  set('w3', '2026-11-12', 'Barbell Squat', 205, 5, 1),
])
console.log('        ' + sessions.map((s) => s.date).join(' · '))
ok(sessions.length === 3, 'three sessions', String(sessions.length))
ok(sessions[0].date === '2026-11-19', 'newest first', sessions[0].date)
ok(sessions[2].date === '2026-11-12', 'oldest last', sessions[2].date)

console.log('\nSETS STAY IN THE ORDER THEY WERE DONE\n')
const ordered = buildSessions([
  set('w1', '2026-11-19', 'Bench', 185, 9, 2),
  set('w1', '2026-11-19', 'Bench', 185, 10, 1),
  set('w1', '2026-11-19', 'Bench', 175, 10, 3),
])
const reps = ordered[0].exercises[0].sets.map((s) => s.reps)
console.log('        ' + ordered[0].exercises[0].sets.map(setLabel).join('   '))
ok(reps.join() === '10,9,10', 'set 1, 2, 3 whatever order they arrived', reps.join())

console.log('\nTHE ARROW COMPARES WITH THEIR OWN LAST ATTEMPT\n')
/* Not a target, not an average, not anyone else. "Down from 80" has to mean
   down from the last time THIS client did THIS lift. */
const trend = buildSessions([
  set('w1', '2026-11-12', 'Squat', 145, 5, 1),
  set('w2', '2026-11-16', 'Squat', 225, 5, 1),
  set('w3', '2026-11-19', 'Squat', 205, 5, 1),
])
const newest = trend[0].exercises[0]
const middle = trend[1].exercises[0]
const oldest = trend[2].exercises[0]
console.log(`        12 Nov 145 → 16 Nov 225 → 19 Nov 205`)
ok(oldest.change === null, 'the first time they ever did it has no arrow', String(oldest.change))
ok(middle.change?.direction === 'up' && middle.change.from === 145, '145 to 225 is up from 145', JSON.stringify(middle.change))
ok(newest.change?.direction === 'down' && newest.change.from === 225, '225 to 205 is down from 225', JSON.stringify(newest.change))

console.log('\nNO ARROW WHEN NOTHING CHANGED\n')
const flat = buildSessions([
  set('w1', '2026-11-12', 'Bench', 185, 10, 1),
  set('w2', '2026-11-19', 'Bench', 185, 8, 1),
])
ok(flat[0].exercises[0].change === null, 'same weight, fewer reps, still no arrow')

console.log('\nAN INTENSITY SET NEVER SETS THE TOP WEIGHT\n')
/* A drop set is lighter on purpose. Counting it would show a client's bench
   falling every week they used one. */
const withDrop = [
  set('w1', '2026-11-19', 'Bench', 185, 8, 1),
  set('w1', '2026-11-19', 'Bench', 95, 15, 2, { isIntensitySet: true }),
]
ok(topWeight(withDrop) === 185, 'the working set wins', String(topWeight(withDrop)))
const dropTrend = buildSessions([
  set('w1', '2026-11-12', 'Bench', 185, 8, 1),
  ...withDrop,
])
ok(dropTrend[0].exercises[0].change === null, 'and a drop set does not look like going backwards')

console.log('\nBODYWEIGHT WORK READS AS BODYWEIGHT\n')
ok(setLabel(set('w', 'd', 'Pullups', 0, 12, 1)) === 'BW × 12', 'zero load is BW', setLabel(set('w', 'd', 'Pullups', 0, 12, 1)))
ok(setLabel(set('w', 'd', 'Pullups', null, 12, 1)) === 'BW × 12', 'so is null')
ok(setLabel(set('w', 'd', 'Bench', 185, 10, 1)) === '185 × 10', 'and a loaded lift shows the load')
const bwTrend = buildSessions([
  set('w1', '2026-11-12', 'Pullups', 0, 8, 1),
  set('w2', '2026-11-19', 'Pullups', 0, 12, 1),
])
ok(bwTrend[0].exercises[0].change === null, 'bodyweight work gets no weight arrow, because there is no weight')

console.log('\nA SWAP SAYS WHAT IT REPLACED\n')
const swapped = buildSessions([
  set('w1', '2026-11-19', 'One-Arm Dumbbell Row', 70, 10, 1, { swappedFrom: 'Barbell Row' }),
])
ok(swapped[0].exercises[0].swappedFrom === 'Barbell Row', 'the original is carried through', String(swapped[0].exercises[0].swappedFrom))

console.log('\nDURATION READS LIKE A SESSION, OR SAYS NOTHING\n')
ok(durationLabel(3120) === '52 min', '52 minutes', String(durationLabel(3120)))
ok(durationLabel(5400) === '1h 30m', 'over an hour', String(durationLabel(5400)))
for (const bad of [null, 0, -5]) {
  ok(durationLabel(bad) === null, `${bad} shows nothing rather than "0 min"`, String(durationLabel(bad)))
}

console.log('\nNOTHING EMPTY OR ODD BREAKS IT\n')
for (const [label, rows] of [
  ['no sets at all', []],
  ['a set with no reps', [set('w1', '2026-11-19', 'Bench', 185, 0, 1)]],
  ['two clients worth of exercises in one session', [set('w1', '2026-11-19', 'A', 10, 5, 1), set('w1', '2026-11-19', 'B', 20, 5, 1)]],
] as Array<[string, ReturnType<typeof set>[]]>) {
  let got: string
  try {
    got = `${buildSessions(rows).length} sessions`
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(
  failed === 0 ? '\nAll coach-training checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
