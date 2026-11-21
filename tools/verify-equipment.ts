/**
 * What a home client is assumed to own, and the default that could break 34
 * programs overnight.
 *
 * The library records one equipment value per exercise. It says `dumbbell`
 * for Dumbbell Bench Press and `body only` for Pullups, so a bench and a bar
 * are invisible to every check in the app. Measured against the live library:
 * 34 of 34 home programs need a bench or an elevated surface, 31 of 34 need a
 * pull-up bar, and a client with only dumbbells loses a quarter of every home
 * program.
 *
 * The most dangerous line here is the default. If a missing answer is read as
 * "owns nothing" rather than "owns everything", every existing client wakes
 * up to a substituted program they never asked for. That is what the first
 * section checks.
 */
import {
  needs,
  swapFor,
  NEEDS,
  INSTEAD,
  REQUIRED_AT_HOME,
  ASKED_AT_HOME,
  KIT_LABELS,
  type Kit,
} from '@/lib/equipment'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

console.log('AN UNANSWERED QUESTION MEANS THEY HAVE IT\n')
/* Every client on the platform right now has never been asked. None of their
   programs may change. */
for (const [label, has] of [
  ['never asked', {}],
  ['asked, said nothing', { bench: undefined }],
  ['a null from the database', { bench: null as unknown as boolean }],
] as Array<[string, Partial<Record<Kit, boolean>>]>) {
  let changed = 0
  for (const name of Object.keys(NEEDS)) if (swapFor(name, has)) changed++
  ok(changed === 0, `${label}: nothing is substituted`, `${changed} would change`)
}
ok(swapFor('Dumbbell Bench Press', { bench: true }) === null, 'and saying yes changes nothing either')

console.log('\nONLY AN EXPLICIT NO SUBSTITUTES ANYTHING\n')
const noBench = swapFor('Dumbbell Bench Press', { bench: false })
console.log(`        no bench -> ${noBench?.name}  (${noBench?.because})`)
ok(noBench != null, 'a client who said no gets a substitute')
ok(noBench?.name === 'Dumbbell Floor Press', 'and it is the floor press', noBench?.name)
ok(/bench/.test(noBench?.because ?? ''), 'and they are told why', noBench?.because)

console.log('\nEVERY BENCH EXERCISE HAS A SUBSTITUTE\n')
// A client who says no bench must still get a complete program. A slot with
// nothing in it is worse than the exercise they could not do.
const benchOnes = Object.keys(NEEDS).filter((n) => NEEDS[n] === 'bench')
ok(benchOnes.length === 6, 'there are six of them', String(benchOnes.length))
for (const name of benchOnes) {
  const swap = swapFor(name, { bench: false })
  ok(swap != null, `${name.slice(0, 44)} -> ${swap?.name ?? 'NOTHING'}`)
}

console.log('\nTHE PULL-UP BAR IS REQUIRED, NOT SUBSTITUTED\n')
/* Anthony's decision. Chin-Up and Pullups have no honest replacement: the
   only four exercises tagged `lats` a dumbbells-only client can do are all
   stretches, and the library holds no band exercises for the back at all. So
   home programs state the bar up front instead of quietly handing someone a
   row and calling it a vertical pull. */
ok(REQUIRED_AT_HOME.indexOf('pullup_bar') !== -1, 'it is stated as a requirement')
ok(ASKED_AT_HOME.indexOf('pullup_bar') === -1, 'and therefore not asked about')
for (const name of ['Chin-Up', 'Pullups', 'Inverted Row']) {
  ok(needs(name) === 'pullup_bar', `${name} needs the bar`, String(needs(name)))
  ok(
    swapFor(name, { pullup_bar: false }) === null,
    `and is never quietly swapped for something else`,
    String(swapFor(name, { pullup_bar: false })?.name)
  )
}
ok(ASKED_AT_HOME.indexOf('bench') !== -1, 'the bench is the one that gets asked')

console.log('\nINVERTED ROW IS IN THE TABLE, AND NO NAME PATTERN FINDS IT\n')
/* The reason this file is a table rather than a regex. Inverted Row is tagged
   `body only`, needs a bar or a table edge, and the name-matching I used to
   measure the problem did not flag it — so the 34-of-34 and 31-of-34 figures
   are floors, not exact counts. */
ok(needs('Inverted Row') === 'pullup_bar', 'listed explicitly', String(needs('Inverted Row')))
ok(!/pull.?up|chin.?up|bench|incline|decline/i.test('Inverted Row'), 'and its name says nothing about either')

console.log('\nEVERY SUBSTITUTE IS A REAL LIBRARY EXERCISE\n')
// Checked against public/exercises/exercises.json. A typo here puts an
// exercise in a client's program that the app cannot draw, cue or progress.
const LIBRARY_CHECKED = [
  'Dumbbell Floor Press',
  'Dumbbell Shoulder Press',
  'One-Arm Dumbbell Row',
  'Pushups',
  'Lying Dumbbell Tricep Extension',
  'Dumbbell Lying Rear Lateral Raise',
]
for (const name of Object.keys(INSTEAD)) {
  ok(LIBRARY_CHECKED.indexOf(INSTEAD[name]) !== -1, `${INSTEAD[name]} exists`, INSTEAD[name])
}

console.log('\nA SUBSTITUTE NEVER NEEDS THE THING IT REPLACED\n')
// The obvious own goal: swapping a bench exercise for another bench exercise.
for (const name of Object.keys(INSTEAD)) {
  ok(needs(INSTEAD[name]) === null, `${INSTEAD[name]} needs nothing extra`, String(needs(INSTEAD[name])))
}

console.log('\nAND NOTHING ELSE IN THE LIBRARY IS TOUCHED\n')
for (const name of ['Barbell Squat', 'Dumbbell Lunges', 'Plank', 'Side Lateral Raise', '']) {
  ok(needs(name) === null, `${name || '(empty name)'} needs nothing`, String(needs(name)))
  ok(swapFor(name, { bench: false, pullup_bar: false }) === null, `and is never swapped`)
}

console.log('\nEVERY KIT HAS WORDS A CLIENT CAN READ\n')
for (const kit of ['bench', 'pullup_bar'] as Kit[]) {
  ok(Boolean(KIT_LABELS[kit]), kit, KIT_LABELS[kit])
}

console.log(failed === 0 ? '\nAll equipment checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
