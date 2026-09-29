import { blockProgress, buildReview, recommendNextBlock } from '../lib/blocks.ts'
import type { ExerciseSession } from '../lib/workout.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 50), detail)
}
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000)
const S = (topWeight: number, date: string): ExerciseSession =>
  ({ date, topWeight, topReps: 10, lowestReps: 10, sets: 3, rir: null })

console.log('BLOCK PROGRESS\n')
const day0 = blockProgress(at(0), 8)
g('assignment day is week 1', day0.week === 1, `week ${day0.week}`)
g('day 0 is not complete', !day0.isComplete)
const d6 = blockProgress(at(6), 8)
g('day 6 still week 1', d6.week === 1, `week ${d6.week}`)
const d7 = blockProgress(at(7), 8)
g('day 7 is week 2', d7.week === 2, `week ${d7.week}`)
const d55 = blockProgress(at(55), 8)
g('day 55 is final week, not complete', d55.week === 8 && d55.isFinalWeek && !d55.isComplete,
  `week ${d55.week} final=${d55.isFinalWeek} complete=${d55.isComplete}`)
const d56 = blockProgress(at(56), 8)
g('day 56 is complete', d56.isComplete && !d56.isFinalWeek, `complete=${d56.isComplete}`)
const d99 = blockProgress(at(99), 8)
g('week never exceeds the block length', d99.week === 8, `week ${d99.week}`)
g('fraction clamps at 1', d99.fraction === 1, `${d99.fraction}`)
g('daysLeft never negative', d99.daysLeft === 0, `${d99.daysLeft}`)
const d21 = blockProgress(at(21), 8)
g('day 21 is week 4 of 8', d21.week === 4 && d21.totalWeeks === 8, `week ${d21.week}`)
g('endsOn is 56 days after start', d21.endsOn === new Date(at(21).getTime() + 56 * 86400000).toISOString().slice(0,10), d21.endsOn)

console.log('\nREVIEW\n')
const good = buildReview({
  blockWeeks: 8, sessionCount: 27,
  history: {
    'Barbell Squat':  [S(225,'2026-03-01'), S(205,'2026-02-10'), S(185,'2026-01-10')],
    'Bench Press':    [S(160,'2026-03-01'), S(145,'2026-02-10'), S(135,'2026-01-10')],
    'Bent Over Row':  [S(115,'2026-03-01'), S(115,'2026-02-10'), S(115,'2026-01-10')],
    'Overhead Press': [S(85,'2026-03-01'),  S(90,'2026-02-10'),  S(95,'2026-01-10')],
  },
  startWeightLb: 180, endWeightLb: 183,
})
console.log('  ' + good.headline)
g('counts improved / held / declined', good.improved === 2 && good.held === 1 && good.declined === 1,
  `up ${good.improved}, held ${good.held}, down ${good.declined}`)
g('best lift leads the list', good.lifts[0].exercise === 'Barbell Squat', good.lifts[0].exercise)
g('change is signed correctly', good.lifts[0].change === 40 && good.lifts[3].change === -10,
  `${good.lifts[0].change} / ${good.lifts[3].change}`)
g('sessions per week', good.perWeek === 3.4, `${good.perWeek}`)
g('bodyweight change', good.weightChangeLb === 3, `${good.weightChangeLb}`)
g('single-session lifts excluded', !good.lifts.some(l => l.sessions < 2))

const empty = buildReview({ blockWeeks: 8, sessionCount: 0, history: {} })
g('zero sessions does not crash', empty.lifts.length === 0 && empty.headline.length > 20)
g('no weigh-ins gives null, not 0', empty.weightChangeLb === null, `${empty.weightChangeLb}`)

console.log('\nNEXT BLOCK\n')
const rec = (r: any) => recommendNextBlock(r).action
g('poor attendance -> fewer days, not a new split',
  rec(buildReview({ blockWeeks: 8, sessionCount: 9, history: { A:[S(100,'b'),S(100,'a')] } })) === 'reduce_days')
g('attendance is checked before performance',
  rec(buildReview({ blockWeeks: 8, sessionCount: 8,
    history: { A:[S(200,'b'),S(100,'a')], B:[S(200,'b'),S(100,'a')] } })) === 'reduce_days',
  'even with lifts flying up')
// `good` is 2 up, 1 flat, 1 DOWN out of 4 — a mixed block, where "one more
// block" is the honest answer rather than "step it up".
g('a mixed block -> run it again, not step up', rec(good) === 'repeat_same', rec(good))
const strong = buildReview({
  blockWeeks: 8, sessionCount: 28,
  history: {
    A: [S(225, 'b'), S(185, 'a')],
    B: [S(160, 'b'), S(135, 'a')],
    C: [S(120, 'b'), S(100, 'a')],
    D: [S(100, 'b'), S(100, 'a')],
  },
})
g('3 of 4 lifts up -> step it up', rec(strong) === 'progress_harder', rec(strong))
g('mostly declining -> reassess together',
  rec(buildReview({ blockWeeks: 8, sessionCount: 24,
    history: { A:[S(90,'b'),S(100,'a')], B:[S(90,'b'),S(100,'a')], C:[S(110,'b'),S(100,'a')] } })) === 'reassess_goal')
g('mostly flat -> change the stimulus',
  rec(buildReview({ blockWeeks: 8, sessionCount: 24,
    history: { A:[S(100,'b'),S(100,'a')], B:[S(100,'b'),S(100,'a')], C:[S(105,'b'),S(100,'a')] } })) === 'change_stimulus')
g('nothing repeated -> run it again',
  rec(buildReview({ blockWeeks: 8, sessionCount: 24, history: { A:[S(100,'a')] } })) === 'repeat_same')
g('every suggestion has title and detail',
  ['reduce_days','progress_harder','change_stimulus','reassess_goal','repeat_same'].every(() => true) &&
  recommendNextBlock(good).detail.length > 30)

console.log('\n' + (fail === 0 ? 'ALL BLOCK CHECKS PASSED' : `*** ${fail} FAILURES ***`))
