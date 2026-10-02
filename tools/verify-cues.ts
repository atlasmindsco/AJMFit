import { cuesFor } from '../lib/cues.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 52), detail)
}

/** Every exercise in every program assigned to a live client. */
const REAL = [
  'Arnold Dumbbell Press', 'Barbell Bench Press - Medium Grip', 'Barbell Curl', 'Barbell Deadlift',
  'Barbell Hip Thrust', 'Barbell Incline Bench Press - Medium Grip', 'Barbell Lunge', 'Barbell Shrug',
  'Barbell Squat', 'Barbell Walking Lunge', 'Bent Over Barbell Row',
  'Bent Over Dumbbell Rear Delt Raise With Head On Bench', 'Bent Over Two-Dumbbell Row',
  'Bent-Arm Dumbbell Pullover', 'Butt Lift (Bridge)', 'Cable Crossover', 'Calf Raise On A Dumbbell',
  'Carioca Quick Step', 'Chest Push (multiple response)', 'Chin-Up', 'Dead Bug',
  'Decline Dumbbell Triceps Extension', 'Decline Push-Up', 'Dips - Triceps Version',
  'Dumbbell Bench Press', 'Dumbbell Bicep Curl', 'Dumbbell Flyes', 'Dumbbell Lunges',
  'Dumbbell Rear Lunge', 'Dumbbell Shoulder Press', 'Dumbbell Shrug', 'Dumbbell Squat',
  'Dumbbell Step Ups', 'Face Pull', 'Floor Glute-Ham Raise', 'Front Box Jump', 'Hammer Curls',
  'Incline Dumbbell Press', 'Inverted Row', 'Lateral Bound', 'Leg Press',
  'Linear Acceleration Wall Drill', 'Lying Dumbbell Tricep Extension', 'Lying Leg Curls',
  'One-Arm Dumbbell Row', 'Plank', 'Pullups', 'Romanian Deadlift', 'Rowing, Stationary',
  'Russian Twist', 'Seated Cable Rows', 'Seated Calf Raise', 'Seated Leg Curl', 'Side Lateral Raise',
  'Single Leg Glute Bridge', 'Single-Cone Sprint Drill', 'Split Squat with Dumbbells',
  'Standing Cable Wood Chop', 'Standing Calf Raises', 'Standing Dumbbell Calf Raise',
  'Standing Military Press', 'Stiff-Legged Dumbbell Deadlift', 'Triceps Pushdown',
  'Walking, Treadmill', 'Wide-Grip Lat Pulldown',
]

console.log('COVERAGE OF EVERY REAL EXERCISE\n')
{
  const missing = REAL.filter((n) => cuesFor(n) === null)
  for (const n of missing) console.log(`  FAIL   no cues: ${n}`)
  g(`all ${REAL.length} assigned exercises have cues`, missing.length === 0, `${REAL.length - missing.length}/${REAL.length}`)
}

console.log('\nTHE RIGHT CUES, NOT JUST SOME CUES\n')
{
  // Each of these matched the wrong family at some point while writing the
  // rules, which is the whole reason for checking by assertion rather than eye.
  const expectations: Array<[string, RegExp]> = [
    ['Romanian Deadlift', /hips back/i],
    ['Barbell Deadlift', /slack out of the bar/i],
    ['Stiff-Legged Dumbbell Deadlift', /hips back/i],
    ['Lying Leg Curls', /hips stay down/i],
    ['Seated Leg Curl', /hips stay down/i],
    ['Barbell Curl', /elbows pinned/i],
    ['Hammer Curls', /elbows pinned/i],
    ['Leg Press', /knees tracking/i],
    ['Barbell Squat', /brace/i],
    ['Split Squat with Dumbbells', /front heel/i],
    ['Barbell Walking Lunge', /front heel/i],
    ['Cable Crossover', /soft bend/i],
    ['Bent-Arm Dumbbell Pullover', /soft bend/i],
    ['Seated Cable Rows', /flat back/i],
    ['Inverted Row', /straight line/i],
    ['Wide-Grip Lat Pulldown', /full hang/i],
    ['Chin-Up', /full hang/i],
    ['Face Pull', /forehead/i],
    ['Bent Over Dumbbell Rear Delt Raise With Head On Bench', /forehead/i],
    ['Standing Military Press', /glutes and brace/i],
    ['Arnold Dumbbell Press', /glutes and brace/i],
    ['Dumbbell Shoulder Press', /glutes and brace/i],
    ['Incline Dumbbell Press', /upper chest/i],
    ['Barbell Incline Bench Press - Medium Grip', /upper chest/i],
    ['Dumbbell Bench Press', /shoulder blades/i],
    ['Decline Push-Up', /shoulder blades/i],
    ['Dips - Triceps Version', /upper arms still/i],
    ['Triceps Pushdown', /upper arms still/i],
    ['Barbell Hip Thrust', /shins vertical/i],
    ['Butt Lift (Bridge)', /shins vertical/i],
    ['Single Leg Glute Bridge', /shins vertical/i],
    ['Floor Glute-Ham Raise', /hinge at the hip/i],
    ['Standing Calf Raises', /full stretch/i],
    ['Side Lateral Raise', /lead with the elbows/i],
    ['Front Box Jump', /land soft/i],
    ['Lateral Bound', /land soft/i],
    ['Single-Cone Sprint Drill', /full recovery/i],
    ['Linear Acceleration Wall Drill', /full recovery/i],
    ['Chest Push (multiple response)', /every throw/i],
    ['Carioca Quick Step', /balls of your feet/i],
    ['Plank', /heels to head/i],
    ['Dead Bug', /lower back stays flat/i],
    ['Russian Twist', /rotate from the ribs/i],
    ['Standing Cable Wood Chop', /rotate from the ribs/i],
    ['Rowing, Stationary', /legs, then back/i],
    ['Walking, Treadmill', /hold a conversation/i],
    ['Dumbbell Shrug', /straight up and down/i],
  ]
  for (const [name, want] of expectations) {
    const c = cuesFor(name)
    const joined = (c?.cues ?? []).join(' ')
    const ok = want.test(joined)
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(name.slice(0, 44), 46), ok ? '' : `got: ${joined.slice(0, 60)}`)
  }
}

console.log('\nSUBSTRING TRAPS\n')
{
  // "row" is inside "Crossover", "curl" inside "Leg Curl", "press" inside
  // "Leg Press". The serving-units work in this codebase was a lesson in
  // exactly this failure, so the same check belongs here.
  const traps: Array<[string, RegExp, string]> = [
    ['Cable Crossover', /flat back/i, 'row inside Crossover'],
    ['Lying Leg Curls', /elbows pinned/i, 'curl inside Leg Curl'],
    ['Leg Press', /shoulder blades/i, 'press inside Leg Press'],
    ['Barbell Shrug', /flat back/i, 'rug... no row here'],
  ]
  for (const [name, mustNot, why] of traps) {
    const joined = (cuesFor(name)?.cues ?? []).join(' ')
    const ok = !mustNot.test(joined)
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(name, 22), W(why, 26), ok ? '' : joined.slice(0, 50))
  }
}

console.log('\nSHAPE AND LENGTH\n')
{
  const all = REAL.map(cuesFor).filter(Boolean) as Array<{ cues: string[]; mistake: string }>
  g('every entry has 2 or 3 cues', all.every((c) => c.cues.length >= 2 && c.cues.length <= 3))
  g('every entry names a mistake', all.every((c) => c.mistake.length > 0))
  // Someone standing in a gym does not read an essay.
  const longest = Math.max(...all.flatMap((c) => c.cues.map((x) => x.length)))
  g('no cue is longer than 90 characters', longest <= 90, `longest ${longest}`)
  const longestMistake = Math.max(...all.map((c) => c.mistake.length))
  g('no mistake note longer than 130', longestMistake <= 130, `longest ${longestMistake}`)
  g('an unknown movement returns null', cuesFor('Zorbium Crunch Delight') === null)
  g('empty input is safe', cuesFor('') === null)
}

console.log('\n' + (fail === 0 ? 'ALL CUE CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
