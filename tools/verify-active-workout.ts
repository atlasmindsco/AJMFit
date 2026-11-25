/**
 * The rules behind "you still have a workout running".
 *
 * The bug these exist to stop is specific and it already happened: resume
 * matched the day by name, and a name that no longer matched returned -1 and
 * then simply `return`ed. No error, no log, nothing on screen, and the
 * workout still open in the database. Anthony reported it as his workout
 * disappearing. It had not — nothing had looked for it properly, and nothing
 * said so when it failed.
 */
import {
  STALE_AFTER_HOURS,
  isStale,
  elapsedLabel,
  progressLine,
  abandonWarning,
  pickDay,
  type ActiveWorkout,
  type PlanShape,
} from '@/lib/active-workout'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const NOW = Date.parse('2026-11-24T19:00:00Z')
const ago = (hours: number) => new Date(NOW - hours * 3600_000).toISOString()

const workout = (over: Partial<ActiveWorkout> = {}): ActiveWorkout => ({
  id: 'w1',
  dayName: 'Upper Body',
  programName: 'Build Strength',
  startedAt: ago(0.5),
  exercisesTouched: ['Barbell Bench Press', 'Bent Over Barbell Row', 'Standing Military Press'],
  loggedSets: 11,
  ...over,
})

console.log('THE CLOCK\n')
ok(elapsedLabel(ago(0), NOW) === '0:00', 'just started', String(elapsedLabel(ago(0), NOW)))
ok(elapsedLabel(ago(0.5), NOW) === '30:00', 'half an hour', String(elapsedLabel(ago(0.5), NOW)))
ok(elapsedLabel(ago(1.25), NOW) === '1:15:00', 'past the hour gets hours', String(elapsedLabel(ago(1.25), NOW)))
ok(elapsedLabel('not a date', NOW) === null, 'an unparseable start shows no clock')

console.log('\nA PHONE RUNNING FAST DOES NOT PRODUCE A NEGATIVE CLOCK\n')
/* Phone and server clocks disagree by seconds routinely. "-0:03" on the bar
   would look like the app is broken, which it would be. */
ok(elapsedLabel(ago(-0.02), NOW) === '0:00', 'a start in the future reads 0:00', String(elapsedLabel(ago(-0.02), NOW)))

console.log('\nSTALENESS IS ONE NUMBER, NOT TWO\n')
/* The whole point of STALE_AFTER_HOURS: resume looked for sessions started
   since local midnight while auto-close swept anything started before it, so
   a session begun at 11:30pm was unresumable at 12:01am and closed shortly
   after. Alive in the table, dead on the screen. */
ok(STALE_AFTER_HOURS === 18, 'eighteen hours', String(STALE_AFTER_HOURS))
ok(!isStale(ago(2), NOW), 'two hours ago is still live')
ok(!isStale(ago(9), NOW), 'an 11:30pm session is live at 8:30am')
ok(!isStale(ago(17.9), NOW), 'just inside the window')
ok(isStale(ago(18), NOW), 'eighteen hours is stale')
ok(isStale(ago(40), NOW), 'yesterday is stale')
ok(isStale('nonsense', NOW), 'a start we cannot read is stale, not immortal')

console.log('\nWHAT THE BAR SAYS\n')
ok(
  progressLine(workout(), 7) === 'Upper Body · 3 of 7 exercises',
  'day, position, total',
  progressLine(workout(), 7)
)
ok(progressLine(workout({ dayName: '  ' }), 7) === 'Workout · 3 of 7 exercises', 'a blank day name still reads')
ok(progressLine(workout(), 0) === 'Upper Body', 'an unknown day shape shows the name alone', progressLine(workout(), 0))
ok(progressLine(workout(), -1) === 'Upper Body', 'and never prints a negative total')
ok(
  progressLine(workout({ exercisesTouched: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }), 7) ===
    'Upper Body · 7 of 7 exercises',
  'more exercises touched than the day holds clamps, rather than "9 of 7"'
)
ok(
  progressLine(workout({ exercisesTouched: [] }), 7) === 'Upper Body · 0 of 7 exercises',
  'a session with nothing logged says so'
)

console.log('\nABANDON SAYS WHAT IS AT STAKE\n')
ok(abandonWarning(workout({ loggedSets: 12 })).includes('12 logged sets'), 'the count is in the sentence', abandonWarning(workout({ loggedSets: 12 })))
ok(abandonWarning(workout({ loggedSets: 1 })).includes('1 logged set'), 'singular', abandonWarning(workout({ loggedSets: 1 })))
ok(!abandonWarning(workout({ loggedSets: 1 })).includes('1 logged sets'), 'and not "1 logged sets"')
ok(abandonWarning(workout({ loggedSets: 0 })).includes('Nothing'), 'an empty session is honest about it')
/* Abandoning closes the workout. It must never claim to delete the sets,
   because it does not and the client would stop trusting the history. */
ok(!abandonWarning(workout()).toLowerCase().includes('delete'), 'never promises to delete anything')

console.log('\nFINDING THE DAY — THE BUG THIS MODULE EXISTS FOR\n')
const plan: PlanShape[] = [
  { name: 'Lower Body', exercises: ['Barbell Squat', 'Romanian Deadlift', 'Leg Press'] },
  { name: 'Upper Body', exercises: ['Barbell Bench Press', 'Bent Over Barbell Row', 'Standing Military Press'] },
  { name: 'Full Body', exercises: ['Barbell Squat', 'Barbell Bench Press', 'Pullups'] },
]
ok(pickDay('Upper Body', plan, []) === 1, 'an exact name wins', String(pickDay('Upper Body', plan, [])))
ok(pickDay('upper body', plan, []) === 1, 'case and spacing do not break it', String(pickDay('upper body', plan, [])))
ok(pickDay('  Upper Body ', plan, []) === 1, 'nor do stray spaces')

console.log('\nA RENAMED DAY IS FOUND BY WHAT WAS LIFTED IN IT\n')
/* "Gym (my version)". The client renames Upper Body to Push and comes back.
   The old code returned -1 here and silently discarded the session. */
ok(
  pickDay('Push Day A', plan, ['Barbell Bench Press', 'Bent Over Barbell Row']) === 1,
  'two matching lifts identify Upper Body',
  String(pickDay('Push Day A', plan, ['Barbell Bench Press', 'Bent Over Barbell Row']))
)
ok(
  pickDay('Renamed', plan, ['Romanian Deadlift', 'Leg Press']) === 0,
  'and the same works for Lower Body',
  String(pickDay('Renamed', plan, ['Romanian Deadlift', 'Leg Press']))
)

console.log('\nTHE OVERLAP HAS TO BE THE BEST ONE, NOT THE FIRST ONE\n')
/* Barbell Squat appears in two days. One shared lift must not outrank three. */
ok(
  pickDay('Gone', plan, ['Barbell Bench Press', 'Bent Over Barbell Row', 'Standing Military Press']) === 1,
  'three hits on Upper beats one hit on Full Body',
  String(pickDay('Gone', plan, ['Barbell Bench Press', 'Bent Over Barbell Row', 'Standing Military Press']))
)
ok(pickDay('Gone', plan, ['Barbell Squat']) === 0, 'a tie goes to the earlier day, not a coin toss', String(pickDay('Gone', plan, ['Barbell Squat'])))

console.log('\nIT ADMITS WHEN IT CANNOT TELL\n')
/* -1 is a real answer and the caller has to handle it by SHOWING the workout,
   not by discarding it. What must not happen is a confident wrong day. */
ok(pickDay('Gone', plan, []) === -1, 'no name match and nothing logged is -1')
ok(pickDay('Gone', plan, ['Sled Push', 'Farmer Walk']) === -1, 'logged lifts in no day at all is -1')
ok(pickDay('Upper Body', [], ['Barbell Bench Press']) === -1, 'an empty plan is -1')

console.log('\nNOTHING ODD THROWS\n')
for (const [label, run] of [
  ['empty day name, empty plan', () => pickDay('', [], [])],
  ['day with no exercises', () => pickDay('x', [{ name: 'y', exercises: [] }], ['a'])],
  ['blank exercise names', () => pickDay('x', [{ name: 'y', exercises: [''] }], [''])],
] as Array<[string, () => number]>) {
  let got: string
  try {
    got = String(run())
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(failed === 0 ? '\nAll active-workout checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
