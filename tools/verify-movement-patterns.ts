/**
 * The movement-pattern table, checked against the exercise library it
 * describes and the catalog it will be used to judge.
 *
 * The failure that matters is a prescribed exercise with no entry, because it
 * would silently fall through to the guesser and a program could then be
 * reported as covering a pattern it does not train.
 */
import { readFileSync } from 'node:fs'
import {
  patternFor,
  isKnownExercise,
  prescribedNames,
  ESSENTIAL_PATTERNS,
  PATTERN_LABELS,
  type MovementPattern,
} from '@/lib/movement-patterns'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

interface LibEntry {
  name: string
  primaryMuscles?: string[]
  force?: string | null
  mechanic?: string | null
  category?: string | null
}
const lib: LibEntry[] = JSON.parse(
  readFileSync(new URL('../public/exercises/exercises.json', import.meta.url), 'utf8')
)
const byName = new Map(lib.map((e) => [e.name, e]))

console.log('EVERY NAMED EXERCISE IS A REAL ONE\n')
const unknown = prescribedNames().filter((n) => !byName.has(n))
ok(unknown.length === 0, 'every name in the table exists in the exercise library', unknown.join(', ') || 'all found')

console.log('\nEVERY LABEL IS A REAL PATTERN\n')
const patterns = new Set<MovementPattern>(prescribedNames().map((n) => patternFor(n)))
let labelled = 0
patterns.forEach((p) => {
  if (PATTERN_LABELS[p]) labelled++
})
ok(labelled === patterns.size, 'every pattern used has a human label', `${patterns.size} patterns`)

console.log('\nTHE SIX ESSENTIALS ARE ALL REPRESENTED IN THE TABLE\n')
for (const p of ESSENTIAL_PATTERNS) {
  const n = prescribedNames().filter((name) => patternFor(name) === p).length
  ok(n > 0, `${PATTERN_LABELS[p]}`, `${n} exercises`)
}

console.log('\nTHE DISTINCTIONS THE LIBRARY COULD NOT MAKE\n')
// These pairs are identical on muscle, force and mechanic. Being able to tell
// them apart is the whole reason this file exists.
const pairs: Array<[string, string]> = [
  ['Barbell Bench Press - Medium Grip', 'Standing Military Press'],
  ['Barbell Squat', 'Barbell Deadlift'],
  ['Bent Over Barbell Row', 'Wide-Grip Lat Pulldown'],
  ['Barbell Squat', 'Barbell Walking Lunge'],
]
for (const [a, b] of pairs) {
  ok(
    patternFor(a) !== patternFor(b),
    `${a} and ${b} are told apart`,
    `${patternFor(a)} vs ${patternFor(b)}`
  )
}

console.log('\nTHE GUESSER IS ONLY FOR EXERCISES NOBODY HAS PRESCRIBED\n')
ok(isKnownExercise('Barbell Squat'), 'a prescribed exercise is named, not guessed')
ok(!isKnownExercise('Zercher Squat'), 'an unprescribed one is not claimed as named')
ok(patternFor('Zercher Squat') === 'squat', 'and the guesser still gets it right', patternFor('Zercher Squat'))
ok(patternFor("Farmer's Walk") === 'carry', 'a carry is recognised', patternFor("Farmer's Walk"))
ok(patternFor('Overhead Press') === 'vertical_press', 'an overhead press is recognised')
ok(patternFor('Nonsense Movement 9000') === 'other', 'something unrecognisable returns other, not a guess')

console.log('\nTHE GUESSER NEVER THROWS, WHATEVER THE LIBRARY SAYS\n')
let threw = 0
for (const e of lib) {
  try {
    patternFor(e.name, {
      primaryMuscle: e.primaryMuscles?.[0] ?? null,
      force: e.force ?? null,
      mechanic: e.mechanic ?? null,
      category: e.category ?? null,
    })
  } catch {
    threw++
  }
}
ok(threw === 0, `all ${lib.length} library exercises classify without error`, `${threw} threw`)

console.log('\nHOW MUCH OF THE LIBRARY THE GUESSER CAN PLACE\n')
const placed = lib.filter((e) => {
  const p = patternFor(e.name, {
    primaryMuscle: e.primaryMuscles?.[0] ?? null,
    category: e.category ?? null,
  })
  return p !== 'other'
}).length
console.log(`        ${placed} of ${lib.length} (${Math.round((placed / lib.length) * 100)}%) land on a pattern`)
console.log('        The rest return "other", which is honest rather than wrong.')

console.log(
  failed === 0 ? '\nAll movement-pattern checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
