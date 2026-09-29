import { timedTarget, parsePrescribedDuration, isTimedPrescription,
  progressingThisWeek, canComponentProgress, type TimedRole, type TimedSession } from '../lib/conditioning.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 52), detail)
}
const S = (min: number, date = '2026-01-01'): TimedSession =>
  ({ date, durationSeconds: min * 60, distanceMi: null })
const t = (role: TimedRole, hist: TimedSession[], week = 1, canProgress = true, prescribed = 20 * 60) =>
  timedTarget({ role, exerciseName: 'Jogging, Treadmill', prescribedSeconds: prescribed, history: hist, weekInBlock: week, canProgress })
const minsOf = (r: ReturnType<typeof t>) => r.suggestSeconds == null ? null : Math.round(r.suggestSeconds / 60)

console.log('PARSING\n')
g('"20 min" parses', parsePrescribedDuration('20 min') === 1200, `${parsePrescribedDuration('20 min')}`)
g('"45 min" parses', parsePrescribedDuration('45 min') === 2700)
g('"90 sec" parses', parsePrescribedDuration('90 sec') === 90)
g('"8-12" is not timed', parsePrescribedDuration('8-12') === null && !isTimedPrescription('8-12'))
g('"20 min" is timed', isTimedPrescription('20 min'))
g('"1 mile" is timed', isTimedPrescription('1 mile'))

console.log('\nEASY RUNNING / CONDITIONING\n')
g('first ever session just logs', t('conditioning', []).suggestSeconds === 1200 && !t('conditioning', []).isProgression)
g('20 min -> 23 min', minsOf(t('conditioning', [S(20)])) === 23, `${minsOf(t('conditioning', [S(20)]))}`)
g('43 min -> capped at 45', minsOf(t('conditioning', [S(43)])) === 45, `${minsOf(t('conditioning', [S(43)]))}`)
const atCap = t('conditioning', [S(45)])
g('at the ceiling it stops getting longer', minsOf(atCap) === 45 && /same time|pace|ground/i.test(atCap.text), atCap.text.slice(0, 44))
g('builds on what was DONE, not what was prescribed',
  minsOf(t('conditioning', [S(30)], 1, true, 1200)) === 33, `${minsOf(t('conditioning', [S(30)], 1, true, 1200))}`)

console.log('\nLONG RUN\n')
g('week 1: +10%', minsOf(t('endurance', [S(40)], 1)) === 44, `${minsOf(t('endurance', [S(40)], 1))}`)
g('week 3: still climbing', minsOf(t('endurance', [S(40)], 3)) === 44)
const cut = t('endurance', [S(40)], 4)
g('week 4 is a cutback, not a climb', minsOf(cut) === 28 && !cut.isProgression, `${minsOf(cut)} min`)
g('week 8 cuts back too', !t('endurance', [S(40)], 8).isProgression)
g('long run has no 45 min ceiling', minsOf(t('endurance', [S(90)], 1)) === 99, `${minsOf(t('endurance', [S(90)], 1))}`)

console.log('\nNEVER AUTOMATED\n')
for (const role of ['sprint', 'power'] as TimedRole[]) {
  const r = t(role, [S(10)])
  g(`${role}: coach only, no auto progression`, r.coachOnly && !r.isProgression && r.suggestSeconds === null, r.text.slice(0, 40))
}
const mob = t('mobility', [S(10)])
g('mobility does not progress', !mob.isProgression && !mob.coachOnly, mob.text.slice(0, 40))

console.log('\nINTERFERENCE\n')
g('odd weeks progress lifting', progressingThisWeek(1) === 'lifting' && progressingThisWeek(3) === 'lifting')
g('even weeks progress running', progressingThisWeek(2) === 'running' && progressingThisWeek(4) === 'running')
g('running holds on a lifting week', canComponentProgress('running', 1) === false)
const held = t('conditioning', [S(25)], 1, false)
g('a held week repeats and says why', minsOf(held) === 25 && !held.isProgression && /lifting is going up/i.test(held.text), held.text.slice(0, 48))
g('the same slot climbs when it is its week', minsOf(t('conditioning', [S(25)], 2, true)) === 28)

console.log('\nEVERY PATH SAYS SOMETHING USEFUL\n')
const roles: TimedRole[] = ['conditioning', 'endurance', 'mobility', 'sprint', 'power']
g('no empty or placeholder text', roles.every((r) => t(r, [S(20)]).text.length > 25))
g('no NaN in any suggestion', roles.every((r) => { const s = t(r, [S(20)]).suggestSeconds; return s === null || Number.isFinite(s) }))

console.log('\n' + (fail === 0 ? 'ALL CONDITIONING CHECKS PASSED' : `*** ${fail} FAILURES ***`))

console.log('\nROLE INFERENCE + EXPLOSIVE GUARD\n')
{
  const { inferTimedRole, isExplosiveMovement } = await import('../lib/conditioning.ts')
  // The library's own prescriptions: mobility 10 min, conditioning 20, endurance 45.
  const cases: Array<[number, string, string]> = [
    [10 * 60, 'Walking, Treadmill', 'mobility'],
    [20 * 60, 'Jogging, Treadmill', 'conditioning'],
    [45 * 60, 'Trail Running/Walking', 'endurance'],
    [20 * 60, 'Rowing, Stationary', 'conditioning'],
    [10 * 60, 'Carioca Quick Step', 'mobility'],
    [20 * 60, 'Linear Acceleration Wall Drill', 'mobility'],
  ]
  for (const [secs, name, want] of cases) {
    const got = inferTimedRole(secs, name)
    if (got !== want) fail++
    console.log(W(got === want ? '  ok' : '  FAIL', 7), W(name, 34), W(`${secs / 60} min`, 8), got)
  }
  const explosive = ['Single-Cone Sprint Drill', 'Side Hop-Sprint', 'Front Box Jump', 'Lateral Bound', 'Chest Push (multiple response)']
  const lifting = ['Barbell Squat', 'Dumbbell Bench Press', 'Bent Over Barbell Row', 'Plank']
  g('every explosive movement is caught', explosive.every(isExplosiveMovement),
    explosive.filter((e) => !isExplosiveMovement(e)).join(', ') || 'all caught')
  g('no ordinary lift is mistaken for explosive', !lifting.some(isExplosiveMovement),
    lifting.filter(isExplosiveMovement).join(', ') || 'none')
}

console.log('\n' + (fail === 0 ? 'ALL CONDITIONING CHECKS PASSED (incl. inference)' : `*** ${fail} FAILURES ***`))
