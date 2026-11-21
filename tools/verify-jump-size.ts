/**
 * How big a jump is, relative to what is in the client's hands.
 *
 * The increment table has two numbers: 5 lb upper, 10 lb lower, chosen by a
 * regex on the exercise name. Nothing else is consulted. Measured against the
 * 1,371 sets clients have actually logged:
 *
 *     40%   +10 on a  25 lb median   Dumbbell Lunges
 *     25%   +5  on a  20 lb median   Side Lateral Raise
 *      4%   +5  on a 125 lb median   Barbell Bench Press
 *
 * Thirty-two of the sixty exercises clients log would get a jump worth more
 * than a tenth of the weight they are using. A lateral raise going 20 to 25
 * is not progression, it is a failed set with a warm-up before it.
 *
 * So the LIFT sets the patience, not the lifter. A client cannot answer "how
 * experienced are you" in a way the app can trust — three features have
 * already broken on self-reported fields nobody fills in — but "how big is
 * this jump for you" is measured from the weight they just lifted.
 */
import { nextTarget } from '@/lib/progression'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const ctx = { level: 'beginner' as const, daysSinceLast: 3, bodyWeightLb: 180 }

/** n sessions at the top of the range, same weight, newest first. */
const topping = (weight: number, reps: number, n: number, rir: number | null = null) =>
  Array.from({ length: n }, (_, i) => ({
    topWeight: weight,
    topReps: reps,
    lowestReps: reps,
    rir,
    at: `2026-11-${String(20 - i * 3).padStart(2, '0')}`,
  }))

const ask = (name: string, range: string, history: unknown[]) =>
  nextTarget(name, range, ctx, history as never)

console.log('A SMALL JUMP STILL GOES UP AFTER ONE GOOD SESSION\n')
// Nothing changes for somebody lifting heavy. +5 on a 125 lb bench is 4%.
const bench = ask('Barbell Bench Press - Medium Grip', '8-12', topping(125, 12, 1))
console.log(`        125 lb bench, 1 session at the top -> ${bench?.verdict} ${bench?.suggestedWeight}`)
ok(bench?.verdict === 'add_load', 'the bench goes up', String(bench?.verdict))
ok(bench?.suggestedWeight === 130, 'to 130', String(bench?.suggestedWeight))

console.log('\nA BIG ONE WAITS FOR THREE\n')
// +5 on a 20 lb lateral raise is 25%.
for (const n of [1, 2]) {
  const r = ask('Side Lateral Raise', '12-15', topping(20, 15, n))
  ok(r?.verdict !== 'add_load', `${n} session${n === 1 ? '' : 's'} at the top is not enough`, String(r?.verdict))
}
const third = ask('Side Lateral Raise', '12-15', topping(20, 15, 3))
console.log(`        20 lb lateral raise, 3 sessions at the top -> ${third?.verdict} ${third?.suggestedWeight}`)
ok(third?.verdict === 'add_load', 'the third one earns it', String(third?.verdict))
ok(third?.suggestedWeight === 25, 'and it goes to 25', String(third?.suggestedWeight))

console.log('\nA MODERATE ONE WAITS FOR TWO\n')
// +10 on a 155 lb squat is 6.5%.
ok(ask('Barbell Squat', '5', topping(155, 5, 1))?.verdict !== 'add_load', 'one session is not enough')
ok(ask('Barbell Squat', '5', topping(155, 5, 2))?.verdict === 'add_load', 'two is')

console.log('\nTHE CLIENT IS NEVER STRANDED WHILE THEY WAIT\n')
/* The important one. Holding the load back must not mean saying nothing —
   somebody topping the range gets told to keep topping it. */
const waiting = ask('Side Lateral Raise', '12-15', topping(20, 15, 1))
console.log(`        -> ${waiting?.verdict}: "${waiting?.text}"`)
ok(waiting != null, 'there is still advice')
ok(waiting?.addLoad === false, 'and it is not to add load')
ok((waiting?.text ?? '').length > 10, 'and it says something')

console.log('\nDUMBBELLS GO UP IN FIVES, PER HAND\n')
/* The single largest error in the old table. A 10 lb jump on a dumbbell lift
   is not a jump, it is skipping a rung — the next pair up IS +5 each.
   Dumbbell Lunges sit at a 25 lb median in the logs, so +10 was a 40%
   overload in one step. */
const lunge = ask('Dumbbell Lunges', '8-12', topping(40, 12, 3))
console.log(`        40 lb dumbbell lunges -> ${lunge?.suggestedWeight}`)
ok(lunge?.suggestedWeight === 45, 'a dumbbell lower-body lift takes 5, not 10', String(lunge?.suggestedWeight))

const barbellLunge = ask('Barbell Walking Lunge', '8-12', topping(135, 12, 3))
ok(
  barbellLunge?.suggestedWeight === 145,
  'and a BARBELL lower-body lift still takes 10',
  String(barbellLunge?.suggestedWeight)
)

console.log('\nAND ROUND TO WHAT THE RACK ACTUALLY HOLDS\n')
// 2.5 is right for a bar and meaningless for a dumbbell rack.
const dbPress = ask('Dumbbell Shoulder Press', '8-12', topping(22.5, 12, 3))
ok(
  dbPress?.suggestedWeight != null && dbPress.suggestedWeight % 5 === 0,
  'a dumbbell suggestion is a multiple of five',
  String(dbPress?.suggestedWeight)
)
const bar = ask('Barbell Bench Press - Medium Grip', '8-12', topping(125, 12, 1))
ok(
  bar?.suggestedWeight != null && bar.suggestedWeight % 2.5 === 0,
  'a barbell suggestion is a multiple of 2.5',
  String(bar?.suggestedWeight)
)

console.log('\nA STALL IS CALLED WITHOUT ANYBODY RATING THEIR EFFORT\n')
/* The branch required rir <= 1 — proof they were working hard. RIR is on 56
   of 1,371 sets, four per cent, so it never fired and a client grinding the
   same weight for two months was told to keep pushing toward the top of the
   range forever. */
const stuckNoRir = ask('Arnold Dumbbell Press', '8-12', topping(20, 10, 6))
console.log(`        6 flat sessions, no RIR -> ${stuckNoRir?.verdict}`)
ok(stuckNoRir?.verdict === 'change_exercise', 'it fires', String(stuckNoRir?.verdict))
ok(
  !(stuckNoRir?.text ?? '').includes('giving it everything'),
  'and does not claim they were working hard, because nobody said so',
  stuckNoRir?.text ?? ''
)

const stuckWithRir = ask('Arnold Dumbbell Press', '8-12', topping(20, 10, 4, 1))
ok(stuckWithRir?.verdict === 'change_exercise', 'with a rating it fires sooner', String(stuckWithRir?.verdict))
ok(
  (stuckWithRir?.text ?? '').includes('giving it everything'),
  'and then it can say they were working hard',
  stuckWithRir?.text ?? ''
)

console.log('\nBUT ADDING REPS AT THE SAME WEIGHT IS NOT A STALL\n')
/* Caught by replaying all 1,371 logged sets through both versions. Gating on
   flat WEIGHT alone told nine clients to swap an exercise they were steadily
   improving at — because double progression, the thing rep ranges exist to
   make possible, looks exactly like a flat weight. */
const climbingReps = [12, 11, 10, 9, 8, 7].map((reps, i) => ({
  topWeight: 20,
  topReps: reps,
  lowestReps: reps,
  rir: null,
  at: `2026-11-${String(20 - i * 3).padStart(2, '0')}`,
}))
const r = ask('Arnold Dumbbell Press', '8-12', climbingReps)
console.log(`        20 lbs for 7,8,9,10,11,12 reps -> ${r?.verdict}`)
ok(r?.verdict !== 'change_exercise', 'that client is getting stronger, not stuck', String(r?.verdict))

console.log(failed === 0 ? '\nAll jump-size checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
