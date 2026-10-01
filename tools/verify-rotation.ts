import { rotationState, countsAsTrained, type TrainedDay } from '../lib/rotation.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 52), detail)
}

// A real 4-day program from production.
const UL = ['Upper A', 'Lower A', 'Upper B', 'Lower B']
const UL_T = [true, true, true, true]
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString()
const h = (dayName: string, daysAgo: number): TrainedDay => ({ dayName, at: at(daysAgo) })

console.log('THE BUG THIS FIXES\n')
{
  const r = rotationState(UL, UL_T, [h('Upper A', 1)])
  g('trained Upper A yesterday -> today is Lower A', r.todayIndex === 1, UL[r.todayIndex])
  g('Upper A shows as completed', r.completed.has('Upper A'))
  g('Lower A does not', !r.completed.has('Lower A'))
}

console.log('\nTHROUGH A FULL LAP\n')
{
  const steps: Array<[TrainedDay[], number]> = [
    [[], 0],
    [[h('Upper A', 3)], 1],
    [[h('Lower A', 2), h('Upper A', 3)], 2],
    [[h('Upper B', 1), h('Lower A', 2), h('Upper A', 3)], 3],
  ]
  for (const [hist, want] of steps) {
    const r = rotationState(UL, UL_T, hist)
    const ok = r.todayIndex === want
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(`${hist.length} done -> ${UL[r.todayIndex]}`, 36), `${r.completed.size}/4 complete`)
  }
}

console.log('\nTHE LAP CLOSES AND A NEW ONE OPENS\n')
{
  const full = [h('Lower B', 1), h('Upper B', 2), h('Lower A', 3), h('Upper A', 4)]
  const r = rotationState(UL, UL_T, full)
  g('all four done -> back to Upper A', r.todayIndex === 0, UL[r.todayIndex])
  // The lap stays ticked 4/4 rather than being wiped. "You finished the
  // cycle, here is day one of the next" is true; showing day one unticked
  // while the client remembers training it yesterday is not.
  g('a closed lap still reads 4/4', r.completed.size === 4, String(r.completed.size))
  // One day into lap two. This is the case the first implementation got
  // wrong: the four most recent sessions span the lap boundary, so counting
  // distinct names said "lap one still running" and sent them back to day one.
  const lap2 = [h('Upper A', 0), ...full]
  const r2 = rotationState(UL, UL_T, lap2)
  g('lap 2, one day in -> Lower A', r2.todayIndex === 1, UL[r2.todayIndex])
  g('only Upper A counts in lap 2', r2.completed.size === 1 && r2.completed.has('Upper A'), [...r2.completed].join('+'))

  // Two days into lap two.
  const lap2b = [h('Lower A', 0), ...lap2]
  const r3 = rotationState(UL, UL_T, lap2b)
  g('lap 2, two days in -> Upper B', r3.todayIndex === 2, UL[r3.todayIndex])
  g('two days counted in lap 2', r3.completed.size === 2, String(r3.completed.size))
}

console.log('\nREAL-WORLD MESS\n')
{
  // Trained out of order: did Upper B before Lower A. Rotation order wins —
  // the next session is the one after where they actually are. The skipped
  // day is not lost; it is picked up when the search wraps, below.
  const r = rotationState(UL, UL_T, [h('Upper B', 1), h('Upper A', 2)])
  g('out of order -> carries on from Upper B', r.todayIndex === 3, UL[r.todayIndex])
  const rWrap = rotationState(UL, UL_T, [h('Lower B', 0), h('Upper B', 1), h('Upper A', 2)])
  g('the skipped day is picked up on the wrap', rWrap.todayIndex === 1, UL[rWrap.todayIndex])

  // Same day twice in a row. The repeat closes the lap, so the second session
  // alone is the current pass.
  const r2 = rotationState(UL, UL_T, [h('Upper A', 0), h('Upper A', 2)])
  g('same day twice -> still moves on to Lower A', r2.todayIndex === 1, UL[r2.todayIndex])
  g('and only counts it once', r2.completed.size === 1)

  // A long gap does not reset anything: the lap is where you left it.
  const r3 = rotationState(UL, UL_T, [h('Upper A', 90)])
  g('90 days off -> picks up at Lower A', r3.todayIndex === 1, UL[r3.todayIndex])

  // History from a program they no longer run must be ignored entirely.
  const r4 = rotationState(UL, UL_T, [h('Push A', 1), h('Legs', 2), h('Pull', 3)])
  g('other program history is ignored', r4.todayIndex === 0 && r4.completed.size === 0, UL[r4.todayIndex])
}

console.log('\nREST DAYS\n')
{
  // The Arnold split: 6 training days + "Active Rest" with no exercises.
  const SIX = ['Lower (Quad focus)', 'Horizontal Pull', 'Push A', 'Lower (Ham & Glute)', 'Vertical Pull', 'Push B', 'Active Rest']
  const T = [true, true, true, true, true, true, false]
  const r = rotationState(SIX, T, [])
  g('fresh start -> day 1', r.todayIndex === 0, SIX[r.todayIndex])

  const all = SIX.slice(0, 6).map((n, i) => h(n, 6 - i))
  const r2 = rotationState(SIX, T, all)
  g('rest day never blocks the lap closing', r2.todayIndex === 0, SIX[r2.todayIndex])

  // Drops the OLDEST session, so day 1 is the one never done.
  const r3 = rotationState(SIX, T, all.slice(0, 5))
  g('five of six done -> the missing sixth', r3.todayIndex === 5, SIX[r3.todayIndex])

  // A program that is nothing but rest days should not crash or pick one.
  const r4 = rotationState(['Rest'], [false], [])
  g('all-rest program -> no session to offer', r4.todayIndex === -1, String(r4.todayIndex))
}

console.log('\nWHAT COUNTS AS TRAINED\n')
{
  const base = { day_name: 'Upper A', ended_at: '2026-09-29T10:00:00Z', set_count: 12 }
  g('finished with sets counts', countsAsTrained(base))
  g('abandoned with zero sets does NOT', !countsAsTrained({ ...base, set_count: 0 }))
  g('still in progress does NOT', !countsAsTrained({ ...base, ended_at: null }))
  g('no day name does NOT', !countsAsTrained({ ...base, day_name: null }))
}

console.log('\n' + (fail === 0 ? 'ALL ROTATION CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
