/**
 * Holds: which exercises are held, and how a duration survives a round trip.
 *
 * Run against the real 873-exercise library, because the claim this rests on
 * is that `force === 'static'` identifies the right exercises. If that is
 * wrong, planks keep asking for rep counts and something that is genuinely
 * repeated starts asking for seconds — both worse than the bug.
 */
import { readFileSync } from 'node:fs'
import {
  isHold,
  parseHoldSeconds,
  formatHold,
  holdLabel,
  HOLD_PRESETS,
  DEFAULT_HOLD_SECONDS,
  holdSecondsFromReps,
} from '../lib/holds.ts'
import { isTimedPrescription } from '../lib/conditioning.ts'
import type { LibraryExercise } from '../lib/builder-rules.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 56), detail)
}

const LIB: LibraryExercise[] = JSON.parse(readFileSync('public/exercises/exercises.json', 'utf8'))
const byName = (n: string) => LIB.find((e) => e.name === n) ?? null

console.log('WHAT COUNTS AS A HOLD, IN THE REAL LIBRARY\n')
{
  g('Plank is a hold', isHold(byName('Plank')), 'the one Alex reported')
  g('Side Bridge is a hold', isHold(byName('Side Bridge')))
  g('Isometric Neck Exercise is a hold', isHold(byName('Isometric Neck Exercise - Sides')))
  g('Plate Pinch is a hold', isHold(byName('Plate Pinch')))

  // Things that are repeated must NOT become holds, which would be a worse bug
  // than the one being fixed.
  g('a bench press is not', !isHold(byName('Barbell Bench Press - Medium Grip')))
  g('a squat is not', !isHold(byName('Barbell Squat')))
  g('a curl is not', !isHold(byName('Barbell Curl')))
  g('crunches are not', !isHold(byName('Crunches')))
  g('a glute bridge is not', !isHold(byName('Butt Lift (Bridge)')), 'it is repped, despite the name')
  g('Push Up to Side Plank is not', !isHold(byName('Push Up to Side Plank')), 'a push-up that ends in a plank')

  g('an unknown name is not', !isHold(null))
  g('a missing force is not', !isHold({ force: null }))

  const holds = LIB.filter(isHold)
  g('104 static exercises in the library', holds.length === 104, String(holds.length))

  const strengthHolds = holds.filter((e) => e.category !== 'stretching')
  g('10 of them are not stretches', strengthHolds.length === 10, strengthHolds.map((e) => e.name).join(', ').slice(0, 60))

  // Every abdominal hold should be caught, since that is where this bites.
  const absHolds = strengthHolds.filter((e) => e.primaryMuscles.includes('abdominals'))
  g('both ab holds are caught', absHolds.length === 2, absHolds.map((e) => e.name).join(', '))
}

console.log('\nREADING A DURATION BACK\n')
{
  g('"60 sec" is 60', parseHoldSeconds('60 sec') === 60)
  g('"2 min" is 120', parseHoldSeconds('2 min') === 120)
  g('"90 sec" is 90', parseHoldSeconds('90 sec') === 90)
  g('"1 min 30 sec" is 90', parseHoldSeconds('1 min 30 sec') === 90)
  g('a bare "45" is 45 seconds', parseHoldSeconds('45') === 45, 'on a hold a number means seconds')
  g('"30-60" takes the top', parseHoldSeconds('30-60') === 60, 'what they are working to')
  g('"1 minute" long form works', parseHoldSeconds('1 minute') === 60)
  g('"30 seconds" long form works', parseHoldSeconds('30 seconds') === 30)
  g('nothing is null, not zero', parseHoldSeconds('') === null && parseHoldSeconds(null) === null)
  g('"8-12" reps is not a duration', parseHoldSeconds('8-12') === 12, 'top of range; only asked on a hold')
  g('"to failure" is null', parseHoldSeconds('to failure') === null)
}

console.log('\nWRITING ONE OUT\n')
{
  g('45 reads as "45 sec"', formatHold(45) === '45 sec')
  g('60 reads as "1 min"', formatHold(60) === '1 min')
  g('120 reads as "2 min"', formatHold(120) === '2 min')
  g('90 reads as "1 min 30 sec"', formatHold(90) === '1 min 30 sec')

  g('buttons stay short', holdLabel(45) === '45s' && holdLabel(60) === '1m' && holdLabel(120) === '2m',
    [45, 60, 90, 120].map(holdLabel).join(' '))

  // The round trip is what matters: what the builder writes, the workout
  // screen must read back as the same number.
  const broken = HOLD_PRESETS.filter((s) => parseHoldSeconds(formatHold(s)) !== s)
  g('every preset survives the round trip', broken.length === 0, broken.join(', '))

  g('Alex asked for 60, 90 and 120', [60, 90, 120].every((s) => HOLD_PRESETS.includes(s)), HOLD_PRESETS.join(', '))
  g('and something easier is offered first', HOLD_PRESETS[0] < 60, `${HOLD_PRESETS[0]}s`)
  g('the default is a real preset', HOLD_PRESETS.includes(DEFAULT_HOLD_SECONDS), `${DEFAULT_HOLD_SECONDS}s`)
}

console.log('\nHOLDS vs THE CARDIO TIMER')
console.log('A hold keeps its SET ROWS. A run is one duration for the whole thing.\n')
{
  // isTimedPrescription fires on "sec" too, so without holds taking precedence
  // a plank would lose its three set rows and become a single stopwatch.
  g('"60 sec" also looks timed to the cardio check', isTimedPrescription('60 sec'),
    'which is why isHold has to win')
  g('a 20-minute run is timed', isTimedPrescription('20 min'))
  g('and is NOT a hold', !isHold(byName('Trail Running/Walking')), 'one duration, not three')
  g('"8-12" is neither', !isTimedPrescription('8-12'))
}

console.log('\nTHE 45 PLANK SLOTS IN THE SEEDED LIBRARY')
console.log('Prescribed by rep count, because the plank\'s role is "core".\n')
{
  g('Build Strength 2x10 becomes 30 sec', holdSecondsFromReps(10) === 30)
  g('Build Muscle 3x15 becomes 45 sec', holdSecondsFromReps(15) === 45)
  g('Lean Out 3x20 becomes 60 sec', holdSecondsFromReps(20) === 60)
  g('all three land on real presets', [10, 15, 20].every((r) => HOLD_PRESETS.includes(holdSecondsFromReps(r))))
  g('the goal ordering survives',
    holdSecondsFromReps(10) < holdSecondsFromReps(15) && holdSecondsFromReps(15) < holdSecondsFromReps(20),
    'strength holds least in total, lean-out most')
  g('an absurd scheme is clamped', holdSecondsFromReps(100) === 120, 'nobody planks for five minutes here')
  g('and a tiny one has a floor', holdSecondsFromReps(1) === 15)
  g('the result round-trips', parseHoldSeconds(formatHold(holdSecondsFromReps(15))) === 45)
}

console.log(fail === 0 ? '\nAll hold checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
