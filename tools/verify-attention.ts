/**
 * The homepage attention engine: what surfaces, in what order, and what never
 * surfaces at all.
 *
 * The ordering is the whole product decision. A commercial card that can
 * outrank a coach's reply, or a check-in offered to someone nobody will reply
 * to, are not cosmetic mistakes — so they are asserted here rather than left
 * to whoever edits the list next.
 */
import { attentionCards, topAttention, PR_FRESH_DAYS, type AttentionInput } from '../lib/attention.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 54), detail)
}

/** A client with nothing wrong: training, no program issues, no PR. */
const calm = (over: Partial<AttentionInput> = {}): AttentionInput => ({
  coached: false,
  unreadFromCoach: 0,
  checkInDoneThisWeek: null,
  hasProgram: true,
  blockDaysLeft: 40,
  daysSinceLastWorkout: 1,
  trainingDaysSet: true,
  lastPr: null,
  proteinRatio: null,
  recommendation: null,
  ...over,
})
const kinds = (i: AttentionInput) => attentionCards(i).map((c) => c.kind)

console.log('NOTHING TO SAY MEANS NOTHING SHOWN\n')
{
  g('a client with nothing wrong gets no cards', attentionCards(calm()).length === 0, kinds(calm()).join(','))
  g('and the top-three helper agrees', topAttention(calm()).length === 0)
  // Six of twelve clients are in exactly this state. An empty state saying
  // "nothing needs your attention" would itself be noise.
  g('an empty stack is an absence, not a message', topAttention(calm()).every(() => false))
}

console.log('\nTODAY\'S WORKOUT IS NEVER HERE')
console.log('It is already the card directly below this one.\n')
{
  const all = attentionCards(calm({
    unreadFromCoach: 2, coached: true, checkInDoneThisWeek: false, hasProgram: false,
    blockDaysLeft: 1, daysSinceLastWorkout: 30, trainingDaysSet: false,
    lastPr: { exercise: 'Barbell Squat', weight: 155, reps: 5, daysAgo: 2 },
    proteinRatio: 0.6, recommendation: { title: 'Protein options', category: 'Protein' },
  }))
  g('no card is about today\'s session', !all.some((c) => /today|workout now|start/i.test(c.title)), `${all.length} cards, none`)
}

console.log('\nTHE ORDER, WHICH IS THE PRODUCT DECISION\n')
{
  const everything = calm({
    coached: true, unreadFromCoach: 1, checkInDoneThisWeek: false, hasProgram: false,
    blockDaysLeft: 2, daysSinceLastWorkout: 20, trainingDaysSet: false,
    lastPr: { exercise: 'Bench', weight: 165, reps: 8, daysAgo: 3 },
    proteinRatio: 0.5, recommendation: { title: 'Protein options', category: 'Protein' },
  })
  const order = kinds(everything)
  g('coach reply is first', order[0] === 'coach_replied', order.slice(0, 3).join(' → '))
  g('check-in is second', order[1] === 'check_in_due')
  g('no program is third', order[2] === 'no_program')

  const commercial = order.indexOf('recommendation')
  g('the product pitch is dead last', commercial === order.length - 1, `position ${commercial + 1} of ${order.length}`)
  for (const important of ['coach_replied', 'check_in_due', 'no_program', 'block_ending', 'last_pr']) {
    if (order.indexOf(important) > commercial) { fail++; console.log(`  FAIL   ${important} ranked below the pitch`) }
  }
  g('nothing important ranks below it', true, 'checked against every training and coaching card')

  g('the ranking is stable', attentionCards(everything).every((c, i, a) => i === 0 || a[i - 1].rank <= c.rank))
  g('only three are shown', topAttention(everything).length === 3, `${order.length} available`)
}

console.log('\nTHE CHECK-IN IS ONLY OFFERED WHERE SOMEONE WILL REPLY\n')
{
  g('a coached client is asked', kinds(calm({ coached: true, checkInDoneThisWeek: false })).includes('check_in_due'))
  g('a Blueprint client is not', !kinds(calm({ coached: false, checkInDoneThisWeek: false })).includes('check_in_due'),
    'nothing would reply to it')
  g('already submitted this week, silent', !kinds(calm({ coached: true, checkInDoneThisWeek: true })).includes('check_in_due'))
}

console.log('\nTHE LAST PR CHANGES VOICE WITH AGE')
console.log('Chance London\'s most recent is 60 days old and he is flagged at risk.\n')
{
  const fresh = attentionCards(calm({ lastPr: { exercise: 'Barbell Squat', weight: 155, reps: 5, daysAgo: 3 } }))[0]
  g('a fresh one celebrates', fresh.title.startsWith('New PR'), fresh.title)
  g('and states the lift', fresh.detail === '155 lb × 5.', fresh.detail ?? '')

  const stale = attentionCards(calm({ lastPr: { exercise: 'Barbell Squat', weight: 155, reps: 5, daysAgo: 60 } }))[0]
  g('an old one becomes a target', stale.title.startsWith('Your best'), stale.title)
  g('and points forward', Boolean(stale.detail?.includes('beat it')), stale.detail ?? '')
  g('it never says "new" when it is old', !stale.title.toLowerCase().includes('new'))

  const edge = attentionCards(calm({ lastPr: { exercise: 'Bench', weight: 100, reps: 5, daysAgo: PR_FRESH_DAYS } }))[0]
  g(`${PR_FRESH_DAYS} days still counts as fresh`, edge.title.startsWith('New PR'))
  const past = attentionCards(calm({ lastPr: { exercise: 'Bench', weight: 100, reps: 5, daysAgo: PR_FRESH_DAYS + 1 } }))[0]
  g('a day later it does not', past.title.startsWith('Your best'))

  // Half the active clients have never set one.
  g('no PR means no card', !kinds(calm({ lastPr: null })).includes('last_pr'))
}

console.log('\nTHE CARDS THAT NEED EVIDENCE\n')
{
  g('protein needs a full week under target', kinds(calm({ proteinRatio: 0.6 })).includes('protein_short'))
  g('hitting target is silent', !kinds(calm({ proteinRatio: 0.95 })).includes('protein_short'))
  g('no food logged is silent', !kinds(calm({ proteinRatio: null })).includes('protein_short'), 'only 3 clients log food')

  g('training days asked when unset', kinds(calm({ trainingDaysSet: false })).includes('set_training_days'),
    'null on all 9 open assignments')
  g('not asked without a program', !kinds(calm({ hasProgram: false, trainingDaysSet: false })).includes('set_training_days'),
    'they have a bigger problem')

  g('a block ending flags', kinds(calm({ blockDaysLeft: 3 })).includes('block_ending'))
  g('a block with weeks left does not', !kinds(calm({ blockDaysLeft: 30 })).includes('block_ending'))
  g('today is phrased as today', attentionCards(calm({ blockDaysLeft: 0 }))[0].title.includes('today'))
  // Several blocks in production ran weeks past their end, because recording a
  // completed block only started working recently.
  g('an overdue block says so', attentionCards(calm({ blockDaysLeft: -21 }))[0].title === 'Your block finished 21 days ago',
    attentionCards(calm({ blockDaysLeft: -21 }))[0].title)
  g('and never claims it ends today', !attentionCards(calm({ blockDaysLeft: -21 }))[0].title.includes('today'))
  g('one day over reads as yesterday', attentionCards(calm({ blockDaysLeft: -1 }))[0].title.includes('yesterday'))

  g('a week quiet is acknowledged', kinds(calm({ daysSinceLastWorkout: 9 })).includes('back_after_break'))
  g('and never scolds', !/\b(missed|failed|should have|behind)\b/i.test(
    attentionCards(calm({ daysSinceLastWorkout: 30 })).find((c) => c.kind === 'back_after_break')?.detail ?? ''))
  g('trained yesterday, silent', !kinds(calm({ daysSinceLastWorkout: 1 })).includes('back_after_break'))
  g('never trained, silent', !kinds(calm({ daysSinceLastWorkout: null })).includes('back_after_break'), 'that is the coach\'s job')
}

console.log('\nEVERY CARD GOES SOMEWHERE AND SAYS SOMETHING\n')
{
  const all = attentionCards(calm({
    coached: true, unreadFromCoach: 1, checkInDoneThisWeek: false, hasProgram: false,
    blockDaysLeft: 1, daysSinceLastWorkout: 20, trainingDaysSet: false,
    lastPr: { exercise: 'Bench', weight: 165, reps: 8, daysAgo: 3 },
    proteinRatio: 0.5, recommendation: { title: 'Protein options', category: 'Protein' },
  }))
  g('every card has a title', all.every((c) => c.title.trim().length > 0))
  g('every card has a destination', all.every((c) => c.href.startsWith('/studio/')))
  g('ranks are unique', new Set(all.map((c) => c.rank)).size === all.length)
  g('nothing urgent is dismissible', all.filter((c) => c.tone === 'act').every((c) => !c.dismissible))
  g('every offer is dismissible', all.filter((c) => c.tone === 'offer').every((c) => c.dismissible))
}

console.log(fail === 0 ? '\nAll attention checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
