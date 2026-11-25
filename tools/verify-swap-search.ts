/**
 * Searching the library for a substitute.
 *
 * The rule that has to hold is the one about not trapping people: the swap
 * search SORTS and never filters. A client replacing a squat who types
 * "curl" is doing something deliberate, and an app that decides they cannot
 * have it has stopped being a tool. Everything else here is about putting
 * the plausible answers first without removing the rest.
 */
import { groupForMuscle, rankForSwap, resultsHeading } from '@/lib/swap-search'
import { MUSCLE_GROUPS, type LibraryExercise } from '@/lib/builder-rules'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const ex = (
  name: string,
  equipment: string,
  primary: string,
  mechanic: string | null = 'compound'
): LibraryExercise => ({
  name,
  images: [],
  primaryMuscles: [primary],
  equipment,
  category: 'strength',
  mechanic,
  force: 'push',
  level: 'intermediate',
})

console.log('WHICH CHIP TO OPEN ON\n')
/* The library has seventeen muscles and no "back" at all — it is lats,
   middle back, lower back and traps. Nobody thinks "middle back" when they
   reach for a row. */
ok(groupForMuscle('chest') === 'chest', 'chest', String(groupForMuscle('chest')))
ok(groupForMuscle('lats') === 'back', 'lats are Back', String(groupForMuscle('lats')))
ok(groupForMuscle('middle back') === 'back', 'so is middle back')
ok(groupForMuscle('traps') === 'back', 'and traps')
ok(groupForMuscle('quadriceps') === 'legs', 'quads are Legs')
ok(groupForMuscle('glutes') === 'legs', 'so are glutes')
ok(groupForMuscle('biceps') === 'arms', 'biceps are Arms')
ok(groupForMuscle('triceps') === 'arms', 'and triceps')
ok(groupForMuscle('abdominals') === 'core', 'abdominals are Core')
ok(groupForMuscle('shoulders') === 'shoulders', 'shoulders')
ok(groupForMuscle('QUADRICEPS') === 'legs', 'case does not matter')
ok(groupForMuscle('  lats ') === 'back', 'nor do stray spaces')

console.log('\nAND IT ADMITS WHEN IT DOES NOT KNOW\n')
ok(groupForMuscle(null) === null, 'null')
ok(groupForMuscle(undefined) === null, 'undefined')
ok(groupForMuscle('') === null, 'empty')
ok(groupForMuscle('spleen') === null, 'a muscle the library does not have')

console.log('\nEVERY LIBRARY MUSCLE MAPS SOMEWHERE\n')
/* If a muscle is in MUSCLE_GROUPS it must resolve, or the chip that claims
   to cover it silently does not. */
for (const g of MUSCLE_GROUPS) {
  for (const m of g.muscles) {
    ok(groupForMuscle(m) === g.key, `${m} → ${g.label}`, String(groupForMuscle(m)))
  }
}

console.log('\nIT SORTS AND NEVER FILTERS — THE RULE THE TAB DEPENDS ON\n')
const library = [
  ex('Barbell Curl', 'barbell', 'biceps', 'isolation'),
  ex('Cable Crossover', 'cable', 'chest', 'isolation'),
  ex('Dumbbell Bench Press', 'dumbbell', 'chest'),
  ex('Machine Chest Press', 'machine', 'chest'),
  ex('Push-Ups', 'body only', 'chest'),
]
const bench = { equipment: 'barbell', mechanic: 'compound', primaryMuscle: 'chest', excludeName: 'Barbell Bench Press' }

const ranked = rankForSwap(library, bench)
ok(ranked.length === library.length, 'nothing is removed', `${ranked.length} of ${library.length}`)
ok(
  ranked.some((e) => e.name === 'Barbell Curl'),
  'a bicep curl is still reachable while replacing a bench press'
)

console.log('\nBUT THE PLAUSIBLE ONES COME FIRST\n')
console.log('        ' + ranked.map((e) => e.name).join(' · '))
ok(ranked[0].name === 'Dumbbell Bench Press', 'same muscle and mechanic wins', ranked[0].name)
ok(ranked[ranked.length - 1].name === 'Barbell Curl', 'the unrelated one sinks', ranked[ranked.length - 1].name)

console.log('\nTHE MUSCLE OUTRANKS THE EQUIPMENT\n')
/* This check exists because the first version of rankForSwap had it the
   other way round, on the reasoning that people swap when a piece of kit is
   unavailable. True about why they are here, wrong about what to show them:
   it put Barbell Curl at the top of the list for replacing Barbell Bench
   Press, because both are barbells. */
const curlTrap = rankForSwap(
  [ex('Barbell Curl', 'barbell', 'biceps', 'isolation'), ex('Dumbbell Bench Press', 'dumbbell', 'chest')],
  bench
)
ok(curlTrap[0].name === 'Dumbbell Bench Press', 'a chest press beats a bicep curl for replacing a bench press', curlTrap[0].name)

/* Equipment still breaks a tie between two otherwise equal options. */
const offTheRack = rankForSwap(
  [ex('Barbell Front Squat', 'barbell', 'quadriceps'), ex('Dumbbell Goblet Squat', 'dumbbell', 'quadriceps')],
  { equipment: 'dumbbell', mechanic: 'compound', primaryMuscle: 'quadriceps' }
)
ok(offTheRack[0].name === 'Dumbbell Goblet Squat', 'same muscle both ways, so equipment decides', offTheRack[0].name)

console.log('\nIT NEVER OFFERS THE EXERCISE BEING REPLACED\n')
const withSelf = rankForSwap([...library, ex('Barbell Bench Press', 'barbell', 'chest')], bench)
ok(!withSelf.some((e) => e.name === 'Barbell Bench Press'), 'excluded')
ok(
  !rankForSwap([ex('barbell BENCH press', 'barbell', 'chest')], bench).length,
  'and the exclusion is not case-sensitive'
)

console.log('\nEQUAL SCORES KEEP THEIR ORDER\n')
/* Without a stable tie-break the list reshuffles between renders while
   somebody is reading it. */
const tied = [ex('Alpha', 'cable', 'chest', 'isolation'), ex('Beta', 'cable', 'chest', 'isolation')]
ok(rankForSwap(tied, bench).map((e) => e.name).join() === 'Alpha,Beta', 'first pass')
ok(rankForSwap(tied, bench).map((e) => e.name).join() === 'Alpha,Beta', 'and again')

console.log('\nNO CONTEXT AT ALL CHANGES NOTHING\n')
ok(
  rankForSwap(library, {}).map((e) => e.name).join() === library.map((e) => e.name).join(),
  'an empty context leaves the library order alone'
)

console.log('\nTHE HEADING SAYS WHICH LIST YOU ARE LOOKING AT\n')
ok(resultsHeading(6, false) === '6 exercises', 'browsing', resultsHeading(6, false))
ok(resultsHeading(1, false) === '1 exercise', 'singular', resultsHeading(1, false))
ok(resultsHeading(3, true) === '3 matches', 'searching', resultsHeading(3, true))
ok(resultsHeading(1, true) === '1 match', 'one match', resultsHeading(1, true))
ok(resultsHeading(0, true) === 'Nothing matches that', 'nothing found while searching')
ok(resultsHeading(0, false) === 'Nothing here', 'nothing found while browsing')

console.log('\nNOTHING ODD THROWS\n')
for (const [label, run] of [
  ['empty library', () => rankForSwap([], bench).length],
  ['no mechanic on either side', () => rankForSwap([ex('X', 'cable', 'chest', null)], { equipment: 'cable' }).length],
  ['blank names', () => rankForSwap([ex('', 'cable', 'chest')], { excludeName: '' }).length],
] as Array<[string, () => number]>) {
  let got: string
  try {
    got = String(run())
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(failed === 0 ? '\nAll swap-search checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
