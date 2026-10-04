import { buildBrief, type BriefInput, type BriefSession } from '../lib/client-brief.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 54), detail)
}

const lift = (exerciseName: string, topWeight: number, topReps: number, date = '2026-10-01'): BriefSession => ({
  date,
  exerciseName,
  topWeight,
  topReps,
})

const input = (over: Partial<BriefInput> = {}): BriefInput => ({
  clientName: 'Jamel Vivenzio',
  windowDays: 7,
  sessionDates: ['2026-09-28', '2026-09-30', '2026-10-02'],
  priorSessionDates: ['2026-09-21', '2026-09-23'],
  lifts: [],
  priorLifts: [],
  ...over,
})

console.log('TRAINING VOLUME\n')
{
  const b = buildBrief(input())
  g('counts sessions and compares', b.facts[0] === '3 sessions, up from 2.', b.facts[0])

  const fewer = buildBrief(input({ sessionDates: ['2026-10-02'], priorSessionDates: ['2026-09-21', '2026-09-23'] }))
  g('a drop is stated', fewer.facts[0].includes('down from 2'), fewer.facts[0])
  g('and flagged', fewer.flags.includes('Training frequency dropped'))

  const same = buildBrief(input({ sessionDates: ['a', 'b'], priorSessionDates: ['c', 'd'] }))
  g('unchanged is said plainly', same.facts[0].includes('same as the window before'), same.facts[0])

  const none = buildBrief(input({ sessionDates: [] }))
  g('no sessions is stated', none.facts[0].includes('No sessions'), none.facts[0])
  g('and flagged', none.flags.includes('Did not train in this window'))

  // Duplicate dates are one session, not three.
  const dupes = buildBrief(input({ sessionDates: ['2026-10-02', '2026-10-02', '2026-10-02'], priorSessionDates: [] }))
  g('duplicate dates count once', dupes.facts[0].startsWith('1 session'), dupes.facts[0])
}

console.log('\nLIFTS THAT MOVED\n')
{
  const b = buildBrief(
    input({
      lifts: [lift('Bench', 190, 8), lift('Squat', 225, 5)],
      priorLifts: [lift('Bench', 185, 8), lift('Squat', 235, 5)],
    })
  )
  g('a heavier lift is listed up', b.facts.some((f) => f.startsWith('Up:') && f.includes('Bench 190')), b.facts.join(' | ').slice(0, 70))
  g('a lighter lift is listed down', b.facts.some((f) => f.startsWith('Down:') && f.includes('Squat 225')))
  g('and the backwards one is flagged', b.flags.some((f) => f.includes('went backwards')))

  // Same weight, more reps is progress and must not be missed.
  const reps = buildBrief(input({ lifts: [lift('Bench', 185, 10)], priorLifts: [lift('Bench', 185, 8)] }))
  g('more reps at the same weight counts', reps.facts.some((f) => f.startsWith('Up:')), reps.facts.join(' | '))

  // An exercise with no history to compare is not reported either way.
  const fresh = buildBrief(input({ lifts: [lift('Zercher Squat', 135, 5)], priorLifts: [] }))
  g('a brand-new exercise is not a change', !fresh.facts.some((f) => f.startsWith('Up:') || f.startsWith('Down:')))

  // Unchanged is not news.
  const flat = buildBrief(input({ lifts: [lift('Bench', 185, 8)], priorLifts: [lift('Bench', 185, 8)] }))
  g('an unchanged lift is silent', !flat.facts.some((f) => f.startsWith('Up:') || f.startsWith('Down:')))
}

console.log('\nBODY WEIGHT IS STATED, NEVER CELEBRATED\n')
{
  const b = buildBrief(input({ weightNow: 182.4, weightBefore: 184 }))
  g('weight and delta are stated', b.facts.some((f) => f.includes('182.4') && f.includes('-1.6')), b.facts.join(' | ').slice(0, 60))

  // The nutrition engine treats fast change as something to correct. Nothing
  // here congratulates a rate.
  const fast = buildBrief(input({ weightNow: 176, weightBefore: 184 }))
  g('a fast change is flagged', fast.flags.some((f) => f.includes('8 lb')), fast.flags.join(' | '))
  g('and never praised', !fast.facts.join(' ').match(/great|amazing|well done|congrat/i))

  const noPrior = buildBrief(input({ weightNow: 182 }))
  g('no prior weight still reports', noPrior.facts.some((f) => f.includes('182')))
  g('with no invented delta', !noPrior.facts.some((f) => f.includes('(+') || f.includes('(-')))
}

console.log('\nWHAT THEY SAID ABOUT THEMSELVES\n')
{
  const b = buildBrief(input({ energy: 2, nutritionAdherence: 2, sleep: 1, hunger: 5 }))
  g('scores are listed', b.facts.some((f) => f.startsWith('Reported:')), b.facts.join(' | ').slice(0, 60))
  g('low energy flags', b.flags.includes('Low energy'))
  g('low nutrition flags', b.flags.includes('Nutrition adherence low'))
  g('poor sleep flags', b.flags.includes('Sleep poor'))
  g('high hunger flags the deficit', b.flags.some((f) => f.includes('deficit')))

  const fine = buildBrief(input({ energy: 4, nutritionAdherence: 5, sleep: 4, hunger: 2 }))
  g('good scores raise nothing', fine.flags.length === 0, fine.flags.join(' | '))

  const obstacle = buildBrief(input({ obstacle: 'Work travel all week' }))
  g('an obstacle is flagged to read', obstacle.flags.some((f) => f.includes('obstacle')))
}

console.log('\nTHE DRAFT IS A DRAFT\n')
{
  const b = buildBrief(input({ lifts: [lift('Bench', 190, 8)], priorLifts: [lift('Bench', 185, 8)] }))
  g('it opens with the first name', b.draft?.startsWith('Jamel,'), b.draft ?? 'null')
  g('it carries the session count', b.draft?.includes('3 sessions'), b.draft ?? '')
  g('it names the lift that moved', b.draft?.includes('Bench 190'), b.draft ?? '')

  // Facts only. A coach's name on a template is worse than an honest system
  // message, so the draft must not editorialise.
  g('no praise words', !b.draft?.match(/great|amazing|awesome|crushing|proud/i), b.draft ?? '')
  g('no instruction invented', !b.draft?.match(/you should|next week try|I want you to/i))

  // Nothing happened and nothing was said: there is no honest opening.
  const empty = buildBrief(input({ sessionDates: [], lifts: [], priorLifts: [] }))
  g('an empty week drafts nothing', empty.draft === null, String(empty.draft))

  // But an obstacle alone is enough to have something to respond to.
  const spoke = buildBrief(input({ sessionDates: [], obstacle: 'Hurt my back' }))
  g('an obstacle alone earns a draft', spoke.draft !== null)

  const win = buildBrief(input({ win: 'finally hit 10 pull-ups' }))
  g('a stated win is reflected back', win.draft?.includes('pull-ups'), win.draft ?? '')
}

console.log('\nA MONTHLY WINDOW USES THE SAME MACHINE\n')
{
  const monthly = buildBrief(
    input({
      windowDays: 30,
      sessionDates: Array.from({ length: 14 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`),
      priorSessionDates: Array.from({ length: 9 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`),
      lifts: [lift('Bench', 200, 6)],
      priorLifts: [lift('Bench', 185, 8)],
    })
  )
  g('14 sessions, up from 9', monthly.facts[0] === '14 sessions, up from 9.', monthly.facts[0])
  g('lift progress over a month', monthly.facts.some((f) => f.includes('Bench 200')))
  g('no session count is invented', !monthly.facts.join(' ').includes('undefined'))
}

console.log('\n' + (fail === 0 ? 'ALL BRIEF CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
