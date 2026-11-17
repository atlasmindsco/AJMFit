/**
 * The home screen's one question: is today a training day, and how is the
 * week going. Both answers are shown to every client every morning, so the
 * edge cases matter more than the ordinary ones.
 */
import { todayShape, weeklyTarget, weekLine } from '@/lib/today'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

/** A date that falls on the given weekday. 2026-11-15 is a Sunday. */
const on = (dow: number) => new Date(2026, 10, 15 + dow, 9, 0, 0)

console.log('REST DAYS — training Mon, Tue, Thu, Fri\n')
const mtwf = [1, 2, 4, 5]
const cases: Array<[number, boolean, string | null]> = [
  [0, true, 'tomorrow'],   // Sunday  -> Monday
  [1, false, null],        // Monday
  [2, false, null],        // Tuesday
  [3, true, 'tomorrow'],   // Wednesday -> Thursday
  [4, false, null],        // Thursday
  [5, false, null],        // Friday
  [6, true, 'Monday'],     // Saturday -> Monday, two days out
]
for (const [dow, rest, label] of cases) {
  const s = todayShape(mtwf, on(dow))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]
  ok(s.rest === rest && s.nextLabel === label, `${day}: ${rest ? `rest, next ${label}` : 'training day'}`,
     `${s.rest ? 'rest' : 'train'}${s.nextLabel ? ', ' + s.nextLabel : ''}`)
}

console.log('\nWRAPPING THE WEEKEND — training Monday only\n')
for (const dow of [2, 3, 4, 5, 6]) {
  const s = todayShape([1], on(dow))
  ok(s.rest && s.nextLabel === 'Monday', `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]} points at Monday`, String(s.nextLabel))
}
ok(todayShape([1], on(0)).nextLabel === 'tomorrow', 'Sunday says tomorrow, not Monday', String(todayShape([1], on(0)).nextLabel))

console.log('\nNOBODY IS TOLD TO REST WHEN WE DO NOT KNOW\n')
ok(todayShape(null, on(0)).rest === false, 'never asked -> no rest day')
ok(todayShape([], on(0)).rest === false, 'empty answer -> no rest day')
ok(todayShape([0, 1, 2, 3, 4, 5, 6], on(3)).rest === false, 'trains every day -> no rest day')
ok(todayShape([9, 9], on(3)).rest === false, 'nonsense days -> no rest day, no spin')

console.log('\nHOW MANY SESSIONS THE WEEK IS MEANT TO HOLD\n')
ok(weeklyTarget([1, 3, 5], 4) === 3, 'their own answer beats the template', String(weeklyTarget([1, 3, 5], 4)))
ok(weeklyTarget(null, 4) === 4, 'falls back to the program', String(weeklyTarget(null, 4)))
ok(weeklyTarget([], 4) === 4, 'an empty answer falls back too', String(weeklyTarget([], 4)))
ok(weeklyTarget(null, null) === null, 'nothing to go on -> say nothing', String(weeklyTarget(null, null)))

console.log('\nTHE WEEK LINE\n')
ok(weekLine(0, 4) === '0 of 4 sessions this week', 'none yet', String(weekLine(0, 4)))
ok(weekLine(2, 4) === '2 of 4 sessions this week', 'partway', String(weekLine(2, 4)))
ok(weekLine(4, 4) === 'All 4 sessions done this week', 'finished', String(weekLine(4, 4)))
ok(weekLine(5, 4) === 'All 4 sessions done this week', 'over the target reads as done, never 5 of 4', String(weekLine(5, 4)))
ok(weekLine(1, 1) === 'Session done this week', 'a one-day week does not say "All 1"', String(weekLine(1, 1)))
ok(weekLine(0, null) === null, 'no target -> no line', String(weekLine(0, null)))

console.log(failed === 0 ? '\nAll today checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
