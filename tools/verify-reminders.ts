import {
  dueReminder,
  daysBetween,
  mondayOf,
  localDateFor,
  localHourFor,
  DEFAULT_PREFS,
  type ClientSnapshot,
} from '../lib/reminders.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 54), detail)
}

const client = (over: Partial<ClientSnapshot> = {}): ClientSnapshot => ({
  userId: 'u1',
  coached: false,
  lastWorkoutDate: '2026-10-01',
  signedUpAt: '2026-01-01T00:00:00Z',
  checkInWeeks: [],
  trainingDays: null,
  prefs: { ...DEFAULT_PREFS },
  ...over,
})

console.log('THE QUIET LADDER\n')
{
  // Last workout 1 Oct 2026 (a Thursday).
  const rungs: Array<[string, number, string | null]> = [
    ['2026-10-01', 0, null],
    ['2026-10-02', 1, null],
    ['2026-10-03', 2, null],
    ['2026-10-04', 3, null],
    ['2026-10-05', 4, 'quiet_4d'],
    ['2026-10-06', 5, null],
    ['2026-10-07', 6, null],
    ['2026-10-08', 7, 'quiet_7d'],
    ['2026-10-09', 8, null],
    ['2026-10-11', 10, null],
    ['2026-10-21', 20, null],
  ]
  for (const [today, days, want] of rungs) {
    const r = dueReminder(client(), today)
    const got = r?.kind ?? null
    const ok = got === want
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(`day ${days}`, 10), W(got ?? 'silence', 14), ok ? '' : `expected ${want ?? 'silence'}`)
  }
}

console.log('\nIT STOPS, AND THAT IS THE POINT\n')
{
  g('day 10 is silent (the coach has it)', dueReminder(client(), '2026-10-11') === null)
  g('day 30 is silent', dueReminder(client(), '2026-10-31') === null)
  g('day 100 is silent', dueReminder(client({ lastWorkoutDate: '2026-06-01' }), '2026-09-09') === null)
}

console.log('\nONE SEND PER SPELL, NOT ONE PER DAY\n')
{
  // The occurrence key is the last workout date, so the database can refuse a
  // repeat. Without it the day-4 nudge fires every day from day four onward.
  const a = dueReminder(client({ lastWorkoutDate: '2026-10-01' }), '2026-10-05')
  g('keyed by the last workout', a?.occurrenceKey === '2026-10-01', a?.occurrenceKey ?? '')

  // Trained again, then went quiet again: a NEW spell, a new key, so the
  // client correctly gets another nudge.
  const b = dueReminder(client({ lastWorkoutDate: '2026-10-20' }), '2026-10-24')
  g('a later spell gets its own key', b?.occurrenceKey === '2026-10-20', b?.occurrenceKey ?? '')
  g('and the two keys differ', a?.occurrenceKey !== b?.occurrenceKey)
}

console.log('\nNEVER-TRAINED CLIENTS ARE NOT NUDGED\n')
{
  // Four of eleven live clients. There is no "last time you trained" to refer
  // to, the problem is usually setup, and the coach is already told on day 3.
  const never = client({ lastWorkoutDate: null, signedUpAt: '2026-01-01T00:00:00Z' })
  g('never trained -> no automated nudge', dueReminder(never, '2026-10-05') === null)
  g('still silent much later', dueReminder(never, '2026-12-25') === null)
}

console.log('\nTHE WEEKLY CHECK-IN\n')
{
  // 2026-10-04 is a Sunday; 2026-10-05 a Monday. The week they own is the
  // Monday of 2026-09-28.
  // A recent check-in, so the three-missed-weeks give-up rule does not fire.
  const coached = client({ coached: true, lastWorkoutDate: '2026-10-03', checkInWeeks: ['2026-09-21'] })
  const sun = dueReminder(coached, '2026-10-04')
  g('Sunday asks', sun?.kind === 'check_in_due', sun?.kind ?? 'silence')
  g('for the week that is ending', sun?.occurrenceKey === '2026-09-28:ask', sun?.occurrenceKey ?? '')

  // Monday follows up once. A different key, so both can send.
  const mon = dueReminder(client({ coached: true, lastWorkoutDate: '2026-10-04', checkInWeeks: ['2026-09-21'] }), '2026-10-05')
  g('Monday follows up', mon?.occurrenceKey === '2026-10-05:followup', mon?.occurrenceKey ?? '')

  g('Tuesday is silent', dueReminder(client({ coached: true, lastWorkoutDate: '2026-10-05', checkInWeeks: ['2026-09-28'] }), '2026-10-06') === null)
  g('Saturday is silent', dueReminder(client({ coached: true, lastWorkoutDate: '2026-10-09', checkInWeeks: ['2026-09-28'] }), '2026-10-10') === null)

  // Already checked in: nothing to ask for.
  const done = client({ coached: true, lastWorkoutDate: '2026-10-03', checkInWeeks: ['2026-09-28'] })
  g('already checked in -> silence', dueReminder(done, '2026-10-04') === null)

  // Blueprint clients are never asked, because nothing offers them a check-in.
  const bp = client({ coached: false, lastWorkoutDate: '2026-10-03', checkInWeeks: ['2026-09-21'] })
  g('Blueprint is never asked', dueReminder(bp, '2026-10-04') === null)
}

console.log('\nTHE ASK STOPS TOO\n')
{
  // Simulating against the live roster caught this: a coached client 168 days
  // in with no sessions would have been asked twice a week forever.
  const neverTrained = client({ coached: true, lastWorkoutDate: null })
  g('never trained -> never asked to check in', dueReminder(neverTrained, '2026-10-04') === null)

  // Three consecutive ignored weeks and the app stops. The coach already has
  // them flagged at_risk after two.
  const ignored = client({ coached: true, lastWorkoutDate: '2026-10-03', checkInWeeks: [] })
  g('three weeks ignored -> stops asking', dueReminder(ignored, '2026-10-04') === null)

  // Answered recently, so the ask continues as normal.
  const answered = client({
    coached: true,
    lastWorkoutDate: '2026-10-03',
    checkInWeeks: ['2026-09-21'],
  })
  g('a recent check-in keeps the ask alive', dueReminder(answered, '2026-10-04')?.kind === 'check_in_due')

  // Two missed weeks is still within the limit.
  const twoMissed = client({
    coached: true,
    lastWorkoutDate: '2026-10-03',
    checkInWeeks: ['2026-09-14'],
  })
  g('two missed weeks still asks', dueReminder(twoMissed, '2026-10-04')?.kind === 'check_in_due')
}

console.log('\nTRAINING OUTRANKS THE CHECK-IN\n')
{
  // Quiet four days AND a check-in due on the same Sunday: one message, and it
  // is the one about the thing they actually came for.
  const both = client({ coached: true, lastWorkoutDate: '2026-09-30', checkInWeeks: ['2026-09-21'] })
  const r = dueReminder(both, '2026-10-04')
  g('one reminder, not two', r !== null && typeof r.kind === 'string')
  g('and it is the training one', r?.kind === 'quiet_4d', r?.kind ?? 'none')
}

console.log('\nPREFERENCES ARE OBEYED\n')
{
  const noTraining = client({ prefs: { ...DEFAULT_PREFS, training: false } })
  g('training off -> no quiet nudge', dueReminder(noTraining, '2026-10-05') === null)

  const noCheckIns = client({ coached: true, lastWorkoutDate: '2026-10-03', checkInWeeks: ['2026-09-21'], prefs: { ...DEFAULT_PREFS, check_ins: false } })
  g('check-ins off -> no ask', dueReminder(noCheckIns, '2026-10-04') === null)

  // With training off, a coached client can still be asked to check in.
  const onlyCheckIns = client({ coached: true, lastWorkoutDate: '2026-09-30', checkInWeeks: ['2026-09-21'], prefs: { ...DEFAULT_PREFS, training: false } })
  g('the switches are independent', dueReminder(onlyCheckIns, '2026-10-04')?.kind === 'check_in_due')
}

console.log('\nDATES AND TIMEZONES\n')
{
  g('whole days between dates', daysBetween('2026-10-01', '2026-10-05') === 4)
  g('same day is zero', daysBetween('2026-10-05', '2026-10-05') === 0)
  g('across a month boundary', daysBetween('2026-09-28', '2026-10-05') === 7)
  g('garbage is zero, not NaN', daysBetween('nonsense', '2026-10-05') === 0)

  g('Monday of a Sunday is 6 days back', mondayOf('2026-10-04') === '2026-09-28', mondayOf('2026-10-04'))
  g('Monday of a Monday is itself', mondayOf('2026-10-05') === '2026-10-05')
  g('Monday of a Wednesday', mondayOf('2026-10-07') === '2026-10-05')

  // A client five hours behind UTC is on the previous day late at night.
  const lateUtc = new Date('2026-10-06T02:00:00Z')
  g('New York is still on the 5th', localDateFor('America/New_York', lateUtc) === '2026-10-05', localDateFor('America/New_York', lateUtc))
  g('UTC is on the 6th', localDateFor(null, lateUtc) === '2026-10-06')
  g('a bad timezone falls back safely', localDateFor('Not/AZone', lateUtc) === '2026-10-06')

  g('local hour in New York', localHourFor('America/New_York', lateUtc) === 22, String(localHourFor('America/New_York', lateUtc)))
  g('a bad timezone still gives an hour', localHourFor('Not/AZone', lateUtc) === 2)
}


console.log('\nTRAINING DAYS\n')
{
  // 2026-10-06 is a Tuesday (weekday 2).
  const tueThuSat = client({ trainingDays: [2, 4, 6], lastWorkoutDate: '2026-10-05' })
  g('a training day reminds', dueReminder(tueThuSat, '2026-10-06')?.kind === 'training_day')
  g('a rest day is silent', dueReminder(tueThuSat, '2026-10-07') === null)

  // A reminder to do what you have just done is how an app teaches you to
  // ignore it.
  const done = client({ trainingDays: [2, 4, 6], lastWorkoutDate: '2026-10-06' })
  g('already trained today -> silent', dueReminder(done, '2026-10-06') === null)

  // Nobody asked: silence rather than guessing wrong four days a week.
  g('no schedule -> no training reminder',
    dueReminder(client({ trainingDays: null, lastWorkoutDate: '2026-10-05' }), '2026-10-06') === null)
  g('declined to say -> still silent',
    dueReminder(client({ trainingDays: [], lastWorkoutDate: '2026-10-05' }), '2026-10-06') === null)

  g('keyed by the day', dueReminder(tueThuSat, '2026-10-06')?.occurrenceKey === '2026-10-06')

  // "You train Tuesdays and it is Tuesday" is more specific than "you have not
  // trained for four days", so it wins.
  const alsoQuiet = client({ trainingDays: [2], lastWorkoutDate: '2026-10-02' })
  g('training day outranks the quiet ladder', dueReminder(alsoQuiet, '2026-10-06')?.kind === 'training_day')

  const off = client({ trainingDays: [2], lastWorkoutDate: '2026-10-05', prefs: { ...DEFAULT_PREFS, training: false } })
  g('the training switch silences it', dueReminder(off, '2026-10-06') === null)
}

console.log('\nWEEKLY SUMMARY\n')
{
  // 2026-10-05 is a Monday.
  const trained = client({ lastWorkoutDate: '2026-10-03', sessionsThisWeek: 4, sessionsLastWeek: 3 })
  g('Monday with sessions sends', dueReminder(trained, '2026-10-05')?.kind === 'weekly_summary')
  g('keyed by the week', dueReminder(trained, '2026-10-05')?.occurrenceKey === '2026-10-05')
  g('Tuesday sends no summary', dueReminder(trained, '2026-10-06')?.kind !== 'weekly_summary')

  // Telling someone who did not train that they did not train is the guilt
  // message this ladder exists to avoid; the quiet rungs already cover them.
  const idle = client({ lastWorkoutDate: '2026-09-20', sessionsThisWeek: 0, sessionsLastWeek: 0 })
  g('no sessions -> no summary', dueReminder(idle, '2026-10-05')?.kind !== 'weekly_summary')

  const off = client({ lastWorkoutDate: '2026-10-03', sessionsThisWeek: 4, prefs: { ...DEFAULT_PREFS, progress: false } })
  g('the progress switch silences it', dueReminder(off, '2026-10-05')?.kind !== 'weekly_summary')
}
console.log('\n' + (fail === 0 ? 'ALL REMINDER CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
