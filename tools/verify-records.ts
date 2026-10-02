import { judgeSet, judgeTimed, estimate1RM, sessionRecords, type PersonalBest } from '../lib/records.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 50), detail)
}

console.log('A BASELINE IS NOT A RECORD\n')
{
  // The bug that was live until Phase 1: with no prior record, every set the
  // client logged came up gold.
  g('first ever set sets no record', judgeSet({ weight: 135, reps: 10 }, null) === null)
  g('nor does a heavy first set', judgeSet({ weight: 405, reps: 1 }, null) === null)
}

console.log('\nTHE THREE KINDS\n')
{
  const best: PersonalBest = { weight: 185, reps: 8 }
  const cases: Array<[string, number, number, string | null]> = [
    ['heavier bar',            190, 5,  'weight'],
    ['same bar, more reps',    185, 10, 'reps'],
    ['same bar, same reps',    185, 8,  null],
    ['same bar, fewer reps',   185, 6,  null],
    ['lighter bar, many more', 170, 12, 'e1rm'],
    ['lighter bar, fewer',     135, 5,  null],
  ]
  for (const [label, weight, reps, want] of cases) {
    const hit = judgeSet({ weight, reps }, best)
    const got = hit?.kind ?? null
    const ok = got === want
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 26), W(`${weight}x${reps}`, 10), W(got ?? 'none', 8), ok ? '' : `expected ${want ?? 'none'}`)
  }
}

console.log('\nTHE CASE THE OLD MODEL CALLED A REGRESSION\n')
{
  // 85x3 then 80x8. The old model compared top weight and saw a step back.
  const best: PersonalBest = { weight: 85, reps: 3 }
  const hit = judgeSet({ weight: 80, reps: 8 }, best)
  g('80x8 after 85x3 is a record', hit?.kind === 'e1rm', hit?.kind ?? 'none')
  g('and it is not shouted about mid-set', hit?.celebrate === false)
  const e1 = estimate1RM(80, 8)
  const e2 = estimate1RM(85, 3)
  g('because the estimate really is higher', e1 != null && e2 != null && e1 > e2, `${e1} vs ${e2}`)
}

console.log('\nESTIMATE GUARDS\n')
{
  g('high-rep sets do not estimate', estimate1RM(95, 20) === null, String(estimate1RM(95, 20)))
  g('12 reps is the limit and works', typeof estimate1RM(95, 12) === 'number')
  g('zero weight returns nothing', estimate1RM(0, 10) === null)
  g('zero reps returns nothing', estimate1RM(135, 0) === null)
  g('a 20-rep backoff cannot claim a record',
    judgeSet({ weight: 95, reps: 20 }, { weight: 185, reps: 8 }) === null)
  // Bodyweight movements log 0 in the weight box by design.
  g('bodyweight set claims nothing', judgeSet({ weight: 0, reps: 15 }, { weight: 0, reps: 10 }) === null)
}

console.log('\nTYPOS DO NOT SET RECORDS\n')
{
  // Both of these are real rows in production.
  g('125 lb x 125 reps on a bench', judgeSet({ weight: 125, reps: 125 }, { weight: 125, reps: 12 }) === null)
  g('5 lb x 65 (minutes in the rep box)', judgeSet({ weight: 5, reps: 65 }, { weight: 5, reps: 20 }) === null)
  // And the legitimate high-rep work still counts.
  g('40-rep calf raises still count', judgeSet({ weight: 25, reps: 40 }, { weight: 25, reps: 30 })?.kind === 'reps')
  g('50 is the limit and works', judgeSet({ weight: 25, reps: 50 }, { weight: 25, reps: 30 })?.kind === 'reps')
  g('51 does not', judgeSet({ weight: 25, reps: 51 }, { weight: 25, reps: 30 }) === null)
}

console.log('\nWHICH KINDS INTERRUPT THE WORKOUT\n')
{
  const best: PersonalBest = { weight: 185, reps: 8 }
  g('a heavier bar does', judgeSet({ weight: 195, reps: 5 }, best)?.celebrate === true)
  g('more reps does', judgeSet({ weight: 185, reps: 11 }, best)?.celebrate === true)
  g('an estimate does not', judgeSet({ weight: 170, reps: 12 }, best)?.celebrate === false)
}

console.log('\nONE RECORD PER EXERCISE, THE BEST ONE\n')
{
  const bests = { Bench: { weight: 185, reps: 8 }, Squat: { weight: 275, reps: 5 } }
  const sets = [
    { exerciseName: 'Bench', weight: 170, reps: 12 }, // e1rm
    { exerciseName: 'Bench', weight: 190, reps: 6 },  // weight — should win
    { exerciseName: 'Bench', weight: 185, reps: 9 },  // reps
    { exerciseName: 'Squat', weight: 225, reps: 5 },  // nothing
  ]
  const recs = sessionRecords(sets, bests)
  g('one row for Bench', recs.filter((r) => r.exerciseName === 'Bench').length === 1, String(recs.length))
  g('and it is the weight PR', recs.find((r) => r.exerciseName === 'Bench')?.kind === 'weight')
  g('Squat is not listed', !recs.some((r) => r.exerciseName === 'Squat'))
  g('an empty session yields nothing', sessionRecords([], bests).length === 0)
  g('unknown exercises are safe', sessionRecords([{ exerciseName: 'Row', weight: 100, reps: 10 }], bests).length === 0)
}

console.log('\nJUNK IN\n')
{
  const best: PersonalBest = { weight: 185, reps: 8 }
  g('NaN weight', judgeSet({ weight: NaN, reps: 8 }, best) === null)
  g('NaN reps', judgeSet({ weight: 185, reps: NaN }, best) === null)
  g('negative reps', judgeSet({ weight: 185, reps: -3 }, best) === null)
}

console.log('\nRUNNING RECORDS NEED DISTANCE\n')
{
  const mi = (durationSeconds: number, distanceMi: number | null) => ({ durationSeconds, distanceMi })

  // 3 miles in 27:00 = 9:00/mi.
  const best = mi(1620, 3)
  g('faster over the same distance', judgeTimed(mi(1560, 3), best)?.kind === 'e1rm')
  g('and it is celebrated', judgeTimed(mi(1560, 3), best)?.celebrate === true)
  g('slower over the same distance is nothing', judgeTimed(mi(1700, 3), best) === null)
  g('further, even if slower', judgeTimed(mi(2400, 4), best)?.kind === 'reps')

  // The whole reason this function exists: duration alone proves nothing.
  g('a longer session alone is NOT a record', judgeTimed(mi(3600, null), mi(1200, null)) === null)
  g('no previous distance, no comparison', judgeTimed(mi(1560, 3), mi(1620, null)) === null)
  g('first ever run sets no record', judgeTimed(mi(1560, 3), null) === null)

  // A quick half mile must not beat a 3-mile pace.
  g('a sprint does not beat a long run pace', judgeTimed(mi(210, 0.5), best) === null, String(judgeTimed(mi(210, 0.5), best)?.kind))
  // But a slightly shorter run at a better pace counts.
  g('2.8 miles quicker does count', judgeTimed(mi(1400, 2.8), best)?.kind === 'e1rm')

  g('zero distance is rejected', judgeTimed(mi(1560, 0), best) === null)
  g('zero duration is rejected', judgeTimed(mi(0, 3), best) === null)

  const hit = judgeTimed(mi(1560, 3), best)
  g('pace reads as mm:ss', Boolean(hit?.text.includes('8:40')), hit?.text ?? '')
}

console.log('\n' + (fail === 0 ? 'ALL RECORD CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
