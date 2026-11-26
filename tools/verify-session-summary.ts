/**
 * Counting a finished session.
 *
 * The screen quotes these numbers back to somebody who was there, so being
 * wrong is worse than being absent — a client who did 24 sets and is told 26
 * stops believing every other figure in the app. What counts is genuinely
 * not obvious: an untouched row is a plan rather than a fact, a drop set is
 * real work, and bodyweight reps move no load.
 */
import {
  sessionTotals,
  prHeadline,
  recordKindLabel,
  recordDetail,
  encouragement,
  type CountedSet,
} from '@/lib/session-summary'
import type { RecordHit } from '@/lib/records'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const set = (weight: string | number | null, reps: string | number | null, logged = true, intensity = false): CountedSet => ({
  weight,
  reps,
  logged,
  isIntensitySet: intensity,
})

console.log('A REAL SESSION ADDS UP\n')
const session = [set(185, 10), set(185, 8), set(185, 8), set(135, 12)]
const t = sessionTotals(session)
console.log(`        185x10, 185x8, 185x8, 135x12`)
ok(t.sets === 4, 'four sets', String(t.sets))
ok(t.reps === 38, 'thirty-eight reps', String(t.reps))
// 1850 + 1480 + 1480 + 1620. Worked out by hand and worth keeping that way:
// a volume figure checked against the function that produced it checks nothing.
ok(t.volume === 6430, 'volume 6430 lb', String(t.volume))

console.log('\nAN UNTICKED ROW IS NOT A SET\n')
/* Every exercise renders its full prescription as empty rows. Counting those
   would report the workout the client was given, not the one they did. */
const partial = sessionTotals([set(185, 10), set(185, 8), set(null, null, false), set(185, 8, false)])
ok(partial.sets === 2, 'two of four ticked', String(partial.sets))
ok(partial.reps === 18, 'and only their reps count', String(partial.reps))

console.log('\nA ROW WITH NO REPS IS NOT A SET EITHER\n')
/* Somebody taps the tick having typed a weight and no reps. It is not a set
   they did; it is a row they touched. */
ok(sessionTotals([set(185, 0), set(185, null)]).sets === 0, 'zero and null reps both ignored')
ok(sessionTotals([set(185, 0)]).volume === 0, 'and contribute no volume')

console.log('\nINTENSITY WORK COUNTS TOWARDS WHAT YOU DID\n')
/* A drop set is reps performed and weight moved. The distinction between it
   and a working set matters to the progression engine, not to "how much did
   I do today". */
const withDrop = sessionTotals([set(185, 8), set(95, 15, true, true)])
ok(withDrop.sets === 2, 'the drop set is a set', String(withDrop.sets))
ok(withDrop.reps === 23, 'and its reps count', String(withDrop.reps))

console.log('\nBODYWEIGHT ADDS REPS AND NO LOAD\n')
/* Counting a client's own mass would make a push-up day read heavier than a
   squat day, and the app has no reliable bodyweight for most people. */
const bw = sessionTotals([set(0, 20), set(null, 15)])
ok(bw.sets === 2, 'two sets', String(bw.sets))
ok(bw.reps === 35, 'thirty-five reps', String(bw.reps))
ok(bw.volume === 0, 'no volume', String(bw.volume))

console.log('\nTHE ROWS ARRIVE AS STRINGS, BECAUSE THEY COME FROM TEXT BOXES\n')
/* This is the real shape. An empty box is "" and must not become a zero-rep
   set; a typed number is "185" and must count. Typing these as numbers in
   the lib and casting at the call site would move the parsing somewhere
   nobody tests. */
const typed = sessionTotals([set('185', '10'), set('185', '8'), set('', ''), set('0', '12')])
ok(typed.sets === 3, 'three rows had reps', String(typed.sets))
ok(typed.reps === 30, 'and their reps add up', String(typed.reps))
ok(typed.volume === 3330, 'the bodyweight row adds no load', String(typed.volume))
ok(sessionTotals([set('', '')]).sets === 0, 'an empty row is not a set')
ok(sessionTotals([set('abc', 'xyz')]).sets === 0, 'and neither is a row of nonsense')

console.log('\nNOTHING LOGGED READS AS NOTHING, NOT AS AN ERROR\n')
for (const [label, rows] of [
  ['empty session', []],
  ['all rows untouched', [set(185, 10, false), set(185, 10, false)]],
] as Array<[string, CountedSet[]]>) {
  const r = sessionTotals(rows)
  ok(r.sets === 0 && r.reps === 0 && r.volume === 0, label, JSON.stringify(r))
}

console.log('\nTHE PR CARD SAYS HOW MANY\n')
const rec = (exerciseName: string, over: Partial<RecordHit> = {}): { exerciseName: string } & RecordHit => ({
  exerciseName,
  kind: 'weight',
  celebrate: true,
  value: 225,
  previous: 205,
  text: '',
  ...over,
})
ok(prHeadline([]) === null, 'no records, no card')
ok(prHeadline([rec('Squat')]) === '1 New PR', 'singular', String(prHeadline([rec('Squat')])))
ok(prHeadline([rec('Squat'), rec('Bench')]) === '2 New PRs', 'plural', String(prHeadline([rec('Squat'), rec('Bench')])))

console.log('\nEACH KIND IS NAMED IN THE CLIENT\'S WORDS\n')
for (const [kind, want] of [
  ['weight', 'Heaviest lift'],
  ['reps', 'Most reps at this weight'],
  ['e1rm', 'Strongest set'],
] as Array<[RecordHit['kind'], string]>) {
  ok(recordKindLabel(kind) === want, `${kind} → "${want}"`, recordKindLabel(kind))
}

console.log('\nTHE DETAIL USES THE RIGHT UNIT FOR THE RIGHT RECORD\n')
/* A weight record improves by pounds and a rep record by reps. One template
   for both would print "+4 lb" about four extra repetitions. */
const weightPR = recordDetail(rec('Barbell Squat', { kind: 'weight', value: 225, previous: 205 }))
ok(weightPR.previous === '205 lb' && weightPR.now === '225 lb', 'weight in lb', `${weightPR.previous} → ${weightPR.now}`)
ok(weightPR.improvement === '+20 lb', 'gain in lb', String(weightPR.improvement))

const repPR = recordDetail(rec('Pull-Up', { kind: 'reps', value: 12, previous: 8 }))
ok(repPR.previous === '8 reps' && repPR.now === '12 reps', 'reps in reps', `${repPR.previous} → ${repPR.now}`)
ok(repPR.improvement === '+4 reps', 'gain in reps', String(repPR.improvement))
ok(!repPR.improvement?.includes('lb'), 'and never in pounds')

console.log('\nIT WILL NOT INVENT A GAIN\n')
/* judgeSet already refuses to call a first attempt a record. If one ever
   reached here, "+70 lb" about somebody's baseline would be a lie. */
ok(recordDetail(rec('New Lift', { previous: 0, value: 70 })).improvement === null, 'no previous figure, no claim')
ok(recordDetail(rec('Flat', { previous: 100, value: 100 })).improvement === null, 'no gain, no claim')

console.log('\nTHE NO-RECORD LINE NEVER CONSOLES\n')
/* Most sessions set no record, and most of those are the ones that actually
   build somebody. This must not read as "better luck next time". */
const seen = new Set<string>()
for (const seed of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12']) {
  const line = encouragement(seed)
  seen.add(line)
  ok(line.length > 0 && line.length <= 32, `"${line}"`, `${line.length} chars`)
  ok(!/record|PR\b|next time|almost|try|unlucky|but /i.test(line), '  says nothing about what did not happen')
}
ok(seen.size >= 3, 'the line varies between sessions', `${seen.size} distinct`)

console.log('\nAND IT DOES NOT CHANGE WHILE THEY READ IT\n')
/* Random would re-roll on every React render. */
ok(encouragement('workout-abc') === encouragement('workout-abc'), 'same session, same line')
ok(encouragement('') === encouragement(''), 'even with an empty seed')

console.log('\nNOTHING ODD THROWS\n')
for (const [label, run] of [
  ['NaN weight', () => sessionTotals([set(NaN, 10)]).reps],
  ['negative reps', () => sessionTotals([set(100, -5)]).sets],
  ['enormous numbers', () => sessionTotals([set(1e9, 1e6)]).volume],
  ['empty seed', () => encouragement('').length],
] as Array<[string, () => number]>) {
  let got: string
  try {
    got = String(run())
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(failed === 0 ? '\nAll session-summary checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
