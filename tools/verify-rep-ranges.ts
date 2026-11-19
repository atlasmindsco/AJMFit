/**
 * The mapping that will rewrite 240 real prescriptions.
 *
 * Two things have to hold. Nobody may end up doing less work than their
 * program asked for yesterday, and nothing that is not a plain rep count may
 * be touched at all — a 45-second plank quietly becoming "45-50" would be
 * nonsense a client would meet mid-session.
 */
import { rangeFor, formatRange, targetRirFor } from '@/lib/rep-ranges'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log('THE FLOOR NEVER DROPS — nobody trains lighter than yesterday\n')
for (const n of [1, 3, 5, 6, 8, 10, 12, 15, 20]) {
  const r = rangeFor(String(n))
  if (r === null) {
    ok(n === 1, `${n} reps is left alone`, 'a single stays a single')
    continue
  }
  ok(r.min === n, `${n} reps keeps ${n} as the floor`, formatRange(r))
}

console.log('\nEVERY PRESCRIPTION IN THE CATALOG MAPS TO A FAMILIAR RANGE\n')
const expected: Array<[string, string | null]> = [
  ['1', null],
  ['3', '3-5'],
  ['5', '5-7'],
  ['6', '6-8'],
  ['8', '8-12'],
  ['10', '10-12'],
  ['12', '12-15'],
  ['15', '15-20'],
  ['20', '20-25'],
]
for (const [input, want] of expected) {
  const r = rangeFor(input)
  const got = r ? formatRange(r) : null
  ok(got === want, `${input} -> ${want ?? 'unchanged'}`, got ?? 'unchanged')
}

console.log('\nNOTHING THAT IS NOT A REP COUNT IS TOUCHED\n')
for (const s of ['45 sec', '10 min', '1 min', '20 min', '45 min', '1 mile', '30 sec']) {
  ok(rangeFor(s) === null, `"${s}" is left alone`)
}
for (const s of ['8-12', '15-20', '12–15']) {
  ok(rangeFor(s) === null, `"${s}" is already a range and is left alone`)
}
for (const s of ['', '  ', 'AMRAP', '0']) {
  ok(rangeFor(s) === null, `"${s}" produces nothing rather than guessing`)
}

console.log('\nAN UNMAPPED NUMBER STILL RESOLVES, AND STILL KEEPS ITS FLOOR\n')
for (const n of [7, 9, 11, 13, 14, 18, 30]) {
  const r = rangeFor(String(n))
  ok(r !== null && r.min === n && r.max > n, `${n} -> ${r ? formatRange(r) : 'null'}`)
}

console.log('\nHEAVY LOW-REP WORK KEEPS ITS FIXED PRESCRIPTION\n')
// Five sets of five at three minutes' rest is a linear strength protocol:
// the reps are fixed on purpose and the load is what progresses.
ok(rangeFor('5', 180) === null, '5 reps at 180s rest is left alone', 'the 5x5')
ok(rangeFor('5', 150) === null, '5 reps at 150s rest is left alone')
ok(rangeFor('3', 180) === null, '3 reps at 180s rest is left alone')
ok(rangeFor('1', 180) === null, 'a heavy single is left alone')
console.log('  — and the rule does not spill onto everything else:')
const widened: Array<[string, number]> = [
  ['5', 90],
  ['6', 150],
  ['8', 120],
  ['10', 90],
  ['12', 75],
]
for (const [reps, rest] of widened) {
  const r = rangeFor(reps, rest)
  ok(r !== null, `${reps} reps at ${rest}s rest still gets a range`, r ? formatRange(r) : 'null')
}
ok(rangeFor('5') !== null, 'without a rest time the heavy rule cannot fire', 'the safe direction')

console.log('\nEVERY RANGE IS A RANGE THE DATABASE WILL ACCEPT\n')
let bad = 0
for (let n = 1; n <= 40; n++) {
  const r = rangeFor(String(n))
  if (r && !(r.min >= 1 && r.max >= r.min)) bad++
}
ok(bad === 0, 'min >= 1 and max >= min for every input 1..40', `${bad} violations`)

console.log('\nEFFORT TARGETS MATCH THE GUIDANCE ALREADY IN THE APP\n')
ok(targetRirFor('strength') === 2, 'strength leaves 2 in reserve', String(targetRirFor('strength')))
ok(targetRirFor('muscle') === 2, 'muscle leaves 2', String(targetRirFor('muscle')))
ok(targetRirFor('lean_out') === 3, 'lean out leaves 3', String(targetRirFor('lean_out')))
ok(targetRirFor(null) === 2, 'a program with no goal gets the middle value', String(targetRirFor(null)))
for (const g of ['strength', 'muscle', 'lean_out', null, undefined, 'nonsense']) {
  const v = targetRirFor(g as string)
  ok(v >= 0 && v <= 5, `${String(g)} is inside the column's bounds`, String(v))
}

console.log(
  failed === 0 ? '\nAll rep-range checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
