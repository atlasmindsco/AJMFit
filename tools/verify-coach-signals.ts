import { stalledLifts, stallSummary } from '../lib/coach-signals.ts'
import type { ExerciseSession } from '../lib/workout.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 52), detail)
}

const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
const s = (topWeight: number, topReps: number, daysAgo: number, rir: number | null = null): ExerciseSession =>
  ({ date: ago(daysAgo), topWeight, topReps, lowestReps: topReps, rir }) as ExerciseSession

console.log('THE CLIENT WHO TURNS UP AND GETS NOWHERE\n')
{
  // Three sessions going backwards: the cut_back verdict.
  const declining = [s(170, 8, 3), s(175, 8, 7), s(180, 8, 11), s(185, 9, 15)]
  const r = stalledLifts({ history: { 'Barbell Bench Press': declining }, prescriptions: { 'Barbell Bench Press': '8-10' } })
  g('a lift going backwards is surfaced', r.length === 1, `${r.length} found`)
  g('and named as cut_back', r[0]?.verdict === 'cut_back', r[0]?.verdict ?? 'none')
  g('carrying the engine’s own sentence', Boolean(r[0]?.text?.length))

  // Flat at the top of the range with nothing left in the tank.
  const stuck = [s(185, 10, 3, 0), s(185, 10, 10, 1), s(185, 10, 17, 0), s(185, 10, 24, 1), s(185, 10, 31, 0), s(185, 10, 38, 1)]
  const r2 = stalledLifts({ history: { 'Barbell Squat': stuck }, prescriptions: { 'Barbell Squat': '8-10' }, level: 'beginner' })
  g('a real plateau is surfaced', r2.some((x) => x.verdict === 'change_exercise'), r2[0]?.verdict ?? 'none')
}

console.log('\nWHAT MUST NOT BE FLAGGED\n')
{
  // Climbing normally.
  const climbing = [s(190, 9, 3), s(185, 9, 10), s(180, 8, 17)]
  g('a progressing lift is silent', stalledLifts({ history: { Bench: climbing } }).length === 0)

  // One session down is an off day, not a stall.
  const oneDown = [s(180, 8, 3), s(185, 9, 10), s(180, 8, 17)]
  g('one session down is silent', stalledLifts({ history: { Bench: oneDown } }).length === 0)

  // A single session has nothing to compare.
  g('a first-ever session is silent', stalledLifts({ history: { Bench: [s(135, 10, 2)] } }).length === 0)
  g('no history at all is silent', stalledLifts({ history: {} }).length === 0)
}

console.log('\nSTALE LIFTS ARE NOT STALLS\n')
{
  // Going backwards, but nobody has trained it in two months. That client is
  // quiet, which is a louder and separate signal.
  const old = [s(170, 8, 60), s(175, 8, 67), s(180, 8, 74), s(185, 9, 81)]
  g('a lift abandoned 60 days ago is silent', stalledLifts({ history: { Bench: old } }).length === 0)

  const recent = [s(170, 8, 12), s(175, 8, 19), s(180, 8, 26), s(185, 9, 33)]
  g('12 days ago still counts', stalledLifts({ history: { Bench: recent } }).length === 1)

  // The boundary that caught the first version out: past 14 days the engine
  // returns 'returning' for everything, so a wider window finds nothing.
  const layoff = [s(170, 8, 16), s(175, 8, 23), s(180, 8, 30), s(185, 9, 37)]
  g('16 days ago is a layoff, not a stall', stalledLifts({ history: { Bench: layoff } }).length === 0)
}

console.log('\nORDERING: WORST FIRST\n')
{
  const declining = [s(170, 8, 2), s(175, 8, 9), s(180, 8, 16), s(185, 9, 23)]
  const stuck = [s(185, 10, 1, 0), s(185, 10, 8, 1), s(185, 10, 15, 0), s(185, 10, 22, 1), s(185, 10, 29, 0), s(185, 10, 36, 1)]
  const r = stalledLifts({
    history: { Squat: stuck, Bench: declining },
    prescriptions: { Squat: '8-10', Bench: '8-10' },
  })
  g('both are found', r.length === 2, `${r.length}`)
  g('going backwards ranks above stuck', r[0]?.verdict === 'cut_back', r.map((x) => x.verdict).join(' then '))
}

console.log('\nTHE DASHBOARD LINE\n')
{
  const declining = [s(170, 8, 2), s(175, 8, 9), s(180, 8, 16), s(185, 9, 23)]
  const one = stalledLifts({ history: { 'Barbell Bench Press': declining } })
  g('one lift names it', stallSummary(one) === 'Barbell Bench Press going backwards at 170 lb', String(stallSummary(one)))

  const stuck = [s(185, 10, 1, 0), s(185, 10, 8, 1), s(185, 10, 15, 0), s(185, 10, 22, 1), s(185, 10, 29, 0), s(185, 10, 36, 1)]
  const two = stalledLifts({ history: { 'Barbell Bench Press': declining, Squat: stuck } })
  g('several lifts count the rest', String(stallSummary(two)).includes('+1 more'), String(stallSummary(two)))
  g('no lifts gives no line', stallSummary([]) === null)
}

console.log('\nTIMED AND BODYWEIGHT WORK\n')
{
  // A run has no rep range, so the engine returns null and nothing is flagged.
  const run = [s(0, 0, 3), s(0, 0, 10)]
  g('timed work cannot stall-flag', stalledLifts({ history: { 'Treadmill Run': run }, prescriptions: { 'Treadmill Run': '20 min' } }).length === 0)
}

console.log('\n' + (fail === 0 ? 'ALL COACH SIGNAL CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
