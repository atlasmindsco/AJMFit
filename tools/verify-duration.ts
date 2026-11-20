/**
 * How long a session takes, and the one function allowed to say so.
 *
 * There were three answers to this question and they disagreed. The one a
 * CLIENT saw, in lib/blueprint.ts, was `~${Math.max(30, exercises.length * 10)}
 * min` — ten minutes an exercise with a floor of thirty. It read neither sets
 * nor rest, so a 5x5 with three-minute rests and a circuit with forty-second
 * rests came out the same if they had the same number of lines.
 *
 * The floor did the real damage. Measured against the live library, NOT ONE of
 * the 69 programs could display an average day under half an hour — the Lean
 * Out Full Body day runs 21 minutes and its card said "~50 min". Eighteen
 * programs really do average thirty minutes or less, and the app had no way to
 * say so. That is why a client with half an hour concluded the library had
 * nothing for them, and why I wrongly reported the catalog had a gap.
 *
 * The second, in lib/program-match.ts, multiplied the exercise count by nine
 * for the coach's intake warning. Both are gone. This pins what is left.
 */
import { estimateMinutes } from '@/lib/builder-rules'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const ex = (sets: number, restSeconds: number, reps = '10') => ({ sets, restSeconds, reps })

/* THE DAYS BELOW ARE REAL, COPIED OUT OF THE LIVE LIBRARY.
   Invented fixtures are how I got this wrong on the first run: I guessed at a
   "heavy day" of five exercises at three minutes' rest, asserted it should come
   in under an hour, and the check failed because no such day exists. The 316
   populated days run 11 to 72 minutes, median 36. */

/** Blueprint · Lean Out · Full Body (3-day) · Home — Day 2. Card said "~50 min". */
const leanOutDay = [
  { sets: 3, restSeconds: 60, reps: '10-12' }, // Stiff-Legged Dumbbell Deadlift
  { sets: 3, restSeconds: 45, reps: '12-15' }, // Dumbbell Shoulder Press
  { sets: 3, restSeconds: 45, reps: '15-20' }, // Bent Over Two-Dumbbell Row
  { sets: 3, restSeconds: 30, reps: '15-20' }, // Lying Dumbbell Tricep Extension
  { sets: 3, restSeconds: 30, reps: '20-25' }, // Dead Bug
]

/** Blueprint · Build Strength · Upper / Lower (4-day) · Home — Day 4. */
const strengthDay = [
  { sets: 5, restSeconds: 180, reps: '5' }, // Stiff-Legged Dumbbell Deadlift
  { sets: 3, restSeconds: 150, reps: '6-8' }, // Single Leg Glute Bridge
  { sets: 3, restSeconds: 90, reps: '8-12' }, // Dumbbell Rear Lunge
  { sets: 2, restSeconds: 60, reps: '10-12' }, // Floor Glute-Ham Raise
  { sets: 3, restSeconds: 60, reps: '10-12' }, // Calf Raise On A Dumbbell
]

/** Blueprint · Build Strength · Athletic Performance (4-day) · Gym — Day 1.
    The longest day in the library, and the one with a timed drill in it. */
const athleticDay = [
  { sets: 1, restSeconds: 0, reps: '10 min' }, // Linear Acceleration Wall Drill
  { sets: 6, restSeconds: 180, reps: '1' }, // Single-Cone Sprint Drill
  { sets: 4, restSeconds: 120, reps: '3-5' }, // Front Box Jump
  { sets: 5, restSeconds: 180, reps: '5' }, // Barbell Squat
  { sets: 3, restSeconds: 150, reps: '6-8' }, // Romanian Deadlift
]

console.log('FIVE EXERCISES ARE NOT FIVE EXERCISES\n')
// The old formula gave all three of these the same answer, because it counted
// lines. They are 21, 43 and 71 minutes.
const lean = estimateMinutes(leanOutDay)
const strong = estimateMinutes(strengthDay)
const athletic = estimateMinutes(athleticDay)
console.log(`        Lean Out Full Body B    -> ${lean} min   (the card said ~50)`)
console.log(`        Build Strength Lower B  -> ${strong} min   (the card said ~50)`)
console.log(`        Athletic Performance D1 -> ${athletic} min   (the card said ~50)`)
ok(lean === 21, 'the lean out day is 21 minutes', String(lean))
ok(strong === 43, 'the strength day is 43 minutes', String(strong))
ok(athletic === 71, 'the athletic day is 71 minutes', String(athletic))
ok(lean < strong && strong < athletic, 'and the app can finally tell them apart')

console.log('\nREST AND SETS BOTH MOVE THE NUMBER\n')
ok(
  estimateMinutes([ex(3, 90), ex(3, 90)]) < estimateMinutes([ex(5, 90), ex(5, 90)]),
  'more sets, more minutes'
)
ok(estimateMinutes([ex(3, 45)]) < estimateMinutes([ex(3, 180)]), 'more rest, more minutes')

console.log('\nTHERE IS NO FLOOR\n')
// The old formula could not return less than 30 whatever it was given, which
// is how a library holding eighteen sub-30-minute programs advertised none.
ok(estimateMinutes([ex(1, 0)]) < 2, 'one set, no rest, is about a minute', String(estimateMinutes([ex(1, 0)])))
ok(lean < 30, 'a real lean out day comes in under thirty', String(lean))
ok(estimateMinutes([]) === 0, 'an empty day is zero, not thirty', String(estimateMinutes([])))

console.log('\nTIME-PRESCRIBED WORK IS READ, NOT GUESSED\n')
/* The part the surviving estimator was also getting wrong until today. A
   45-minute long run is ONE set; counted as a working set it was forty
   seconds. Twenty of the 69 programs hold timed work and every one of them was
   understated — the Strength + Endurance days by 18 minutes a day. */
const longRun = [{ sets: 1, restSeconds: 0, reps: '45 min' }]
console.log(`        45 min run -> ${estimateMinutes(longRun)} min`)
ok(estimateMinutes(longRun) === 45, 'a 45-minute run is 45 minutes', String(estimateMinutes(longRun)))
ok(
  estimateMinutes([{ sets: 1, restSeconds: 0, reps: '20 min' }]) === 20,
  'a 20-minute conditioning block is 20 minutes'
)
ok(
  estimateMinutes([{ sets: 3, restSeconds: 45, reps: '45 sec' }]) === 5,
  'three 45-second planks with 45s rest is about five minutes',
  String(estimateMinutes([{ sets: 3, restSeconds: 45, reps: '45 sec' }]))
)

console.log('\nA ZERO REST IS A REAL ZERO\n')
/* All 56 zero-rest rows in the library are explicit zeros, not nulls, and
   every one of them is a conditioning block. A run has no rest after it.
   `|| 60` at a call site would hand each one a minute it does not take — which
   is what I wrote first, and what this check is here to catch. */
ok(
  estimateMinutes([{ sets: 1, restSeconds: 0, reps: '20 min' }]) === 20,
  'a 20-minute run with no rest is 20 minutes, not 21'
)

console.log('\nA LIFTING DAY WITH A RUN BEATS THE SAME DAY WITHOUT ONE\n')
const lifting = [ex(4, 120), ex(3, 90), ex(3, 90)]
const hybrid = lifting.concat([{ sets: 1, restSeconds: 0, reps: '20 min' }])
console.log(`        lifting only -> ${estimateMinutes(lifting)} min`)
console.log(`        plus a run   -> ${estimateMinutes(hybrid)} min`)
ok(
  estimateMinutes(hybrid) - estimateMinutes(lifting) === 20,
  'adding a 20-minute run adds exactly 20 minutes',
  String(estimateMinutes(hybrid) - estimateMinutes(lifting))
)

console.log('\nNOTHING IT IS HANDED MAKES IT THROW\n')
// It reads whatever the database holds, including rows written before any of
// these fields were required.
for (const [label, list] of [
  ['no reps at all', [{ sets: 3, restSeconds: 60 }]],
  ['null reps', [{ sets: 3, restSeconds: 60, reps: null }]],
  ['empty reps', [{ sets: 3, restSeconds: 60, reps: '' }]],
  ['zero rest', [ex(3, 0)]],
  ['a distance, which carries no duration', [{ sets: 1, restSeconds: 0, reps: '2 mile' }]],
  ['nonsense reps', [{ sets: 3, restSeconds: 60, reps: 'as many as you can' }]],
] as Array<[string, Array<{ sets: number; restSeconds: number; reps?: string | null }>]>) {
  let got: number | string
  try {
    got = estimateMinutes(list)
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(typeof got === 'number' && isFinite(got) && got >= 0, label, String(got))
}

/* A DISTANCE IS STILL GUESSED, AND THAT IS KNOWN.
   "2 mile" carries no duration, so it falls back to forty seconds a set. No
   program in the library prescribes distance today — every timed row is
   written in minutes or seconds — so this costs nothing now. Pinned so that if
   someone seeds a distance-based program, this check says what will happen. */
ok(
  estimateMinutes([{ sets: 1, restSeconds: 0, reps: '2 mile' }]) < 2,
  'a distance falls back to a working set, and is therefore understated',
  `${estimateMinutes([{ sets: 1, restSeconds: 0, reps: '2 mile' }])} min for 2 miles`
)

console.log(failed === 0 ? '\nAll duration checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
