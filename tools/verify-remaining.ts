/**
 * "Can I eat this?" — and the one branch that must never break.
 *
 * Food led with `1,320 / 2,500 kcal` and printed the remainder underneath in
 * 12px grey. The two numbers swap places; no arithmetic is new. What IS new
 * is that the remainder is now the headline, so the over-target case went
 * from a quiet grey afterthought to the biggest thing on the screen — and a
 * negative number, or a cheerful "0 left" at 2,840 eaten, would be the app
 * lying to someone about their day.
 */
import { remaining, eatenLine } from '@/lib/remaining'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log('THE ORDINARY CASE\n')
const mid = remaining(1320, 2500)
console.log(`        1,320 of 2,500 -> "${mid?.label}"`)
ok(mid?.left === 1180, 'the number a client wants is the subtraction they were doing', String(mid?.left))
ok(mid?.isOver === false, 'not over')
ok(mid?.label === '1,180 left', 'and it reads as a sentence fragment, with a comma', mid?.label)
ok(
  eatenLine(1320, 2500) === 'of 2,500 · 1,320 eaten',
  'the old headline survives as the quiet line',
  eatenLine(1320, 2500)
)

console.log('\nOVER TARGET IS SAID PLAINLY\n')
/* The branch this file exists for. Never a negative, never "0 left" when
   somebody is 340 over, never a bar quietly pinned at 100%. */
const over = remaining(2840, 2500)
console.log(`        2,840 of 2,500 -> "${over?.label}"`)
ok(over?.isOver === true, 'it knows', String(over?.isOver))
ok(over?.over === 340, 'by how much', String(over?.over))
ok(over?.left === 0, 'and left is zero, not negative', String(over?.left))
ok(over?.label === '340 over', 'the words say over, not left', over?.label)
ok(!String(over?.label).includes('-'), 'no minus sign reaches a client', over?.label)

console.log('\nEXACTLY ON TARGET IS NOT OVER\n')
const exact = remaining(2500, 2500)
ok(exact?.isOver === false, 'hitting the number exactly is not a warning', String(exact?.isOver))
ok(exact?.left === 0, 'and nothing is left', String(exact?.left))
ok(exact?.label === '0 left', 'which is what it says', exact?.label)

console.log('\nTHE START OF THE DAY\n')
// At 8am "2,500 left" is as useful as "120 left" at 8pm. The old headline
// read "0 / 2,500", which is a true statement about nothing.
const fresh = remaining(0, 2500)
ok(fresh?.left === 2500, 'nothing eaten yet means the whole target is left', String(fresh?.left))
ok(fresh?.label === '2,500 left', 'said as a number anyone can act on', fresh?.label)

console.log('\nMACROS USE THE SAME RULE\n')
ok(remaining(128, 180)?.left === 52, 'protein', String(remaining(128, 180)?.left))
ok(remaining(140, 250)?.left === 110, 'carbs', String(remaining(140, 250)?.left))
ok(remaining(52, 70)?.left === 18, 'fat', String(remaining(52, 70)?.left))
ok(remaining(84, 70)?.label === '14 over', 'and a macro can go over too', String(remaining(84, 70)?.label))

console.log('\nNO TARGET MEANS NO COUNTDOWN\n')
/* A client who has not finished nutrition setup has no goal. Inventing one,
   or counting down from zero, would be worse than showing them the plain
   total they logged. */
for (const [label, target] of [
  ['null', null],
  ['undefined', undefined],
  ['zero', 0],
  ['negative', -500],
  ['not a number', Number.NaN],
] as Array<[string, number | null | undefined]>) {
  ok(remaining(1320, target) === null, `a ${label} target returns null`, String(remaining(1320, target)))
}

console.log('\nAND NOTHING LOGGED ODDLY BREAKS IT\n')
for (const [label, eaten, expect] of [
  ['a negative total', -100, 2500],
  ['a fractional total', 1320.4, 1180],
  ['NaN', Number.NaN, 2500],
] as Array<[string, number, number]>) {
  let got: number | string
  try {
    got = remaining(eaten, 2500)?.left ?? -1
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(got === expect, label, String(got))
}

console.log('\nROUNDING NEVER LEAVES A FLOAT ON SCREEN\n')
// 0.1 + 0.2 territory. A client should never read "1179.9999999 left".
const messy = remaining(1320.0000001, 2500.0000002)
ok(Number.isInteger(messy?.left), 'the number is whole', String(messy?.left))
ok(!String(messy?.label).includes('.'), 'and so is the label', messy?.label)

console.log(failed === 0 ? '\nAll remaining checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
