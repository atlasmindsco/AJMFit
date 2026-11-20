/**
 * What a first-timer is offered, now that anybody can be one.
 *
 * The beginner path has existed for a while and had never run: it keyed off
 * an onboarding answer that no client has ever given, so every client who
 * picked a program was treated as experienced. The picker asks directly now,
 * which means these rules are reachable for the first time and worth pinning
 * down.
 */
import { splitsFor, isValidSplitForDays, SPLIT_OPTIONS, DAYS_TO_SPLIT } from '@/lib/splits'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log('A FIRST-TIMER IS NEVER OFFERED A SPRINTING OR RUNNING TRACK\n')
for (const days of [2, 3, 4, 5, 6]) {
  const offered = splitsFor(days, 'muscle', true)
  const advanced = offered.filter((o) => o.advanced)
  ok(advanced.length === 0, `${days} days: nothing advanced`, advanced.map((o) => o.key).join(', ') || 'clean')
}

console.log('\nAND SOMEBODY ALREADY TRAINING STILL SEES THEM\n')
const forExperienced = [4, 5, 6].flatMap((d) => splitsFor(d, 'muscle', false)).filter((o) => o.advanced)
ok(forExperienced.length > 0, 'the hybrid tracks are still reachable', `${forExperienced.length} of them`)

console.log('\nEVERY DAY COUNT STILL HAS SOMETHING TO OFFER A FIRST-TIMER\n')
// The picker caps a first-timer at 3 or 4 days, so those two must never come
// back empty — an empty list there is a dead end with no program at the end.
for (const days of [3, 4]) {
  const offered = splitsFor(days, 'muscle', true)
  ok(offered.length > 0, `${days} days offers at least one split`, offered.map((o) => o.label).join(', '))
}

console.log('\nAND FOR EVERY GOAL, AT EVERY DAY COUNT A CLIENT CAN PICK\n')
let empty = 0
for (const days of [2, 3, 4, 5, 6]) {
  for (const goal of ['muscle', 'strength', 'lean_out'] as const) {
    for (const isNew of [true, false]) {
      // A first-timer only ever sees 3 and 4.
      if (isNew && days !== 3 && days !== 4) continue
      if (splitsFor(days, goal, isNew).length === 0) {
        empty++
        console.log(`        EMPTY: ${days} days, ${goal}, ${isNew ? 'new' : 'experienced'}`)
      }
    }
  }
}
ok(empty === 0, 'no combination a client can reach comes back empty', `${empty} empty`)

console.log('\nTHE RECOMMENDED SPLIT IS A REAL ONE\n')
for (const [days, key] of Object.entries(DAYS_TO_SPLIT)) {
  ok(isValidSplitForDays(Number(days), key), `${days} days recommends ${key}`)
}

console.log('\nTHE FIRST OPTION AT EACH DAY COUNT IS NEVER AN ADVANCED TRACK\n')
// It is the one that gets picked when the picker does not ask, so it has to
// be the safe one.
for (const [days, opts] of Object.entries(SPLIT_OPTIONS)) {
  ok(!opts[0].advanced, `${days} days leads with ${opts[0].key}`)
}

console.log(failed === 0 ? '\nAll split checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
