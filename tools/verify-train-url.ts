/**
 * The Train tab's address, checked both ways.
 *
 * This is what makes the phone's back gesture work, so the thing that must
 * hold is the round trip: a place written to the address and read back has to
 * be the same place, or back and forward land somewhere the client did not
 * ask for.
 */
import { HOME_PLACE, placeToQuery, queryToPlace, samePlace, type TrainPlace } from '@/lib/train-url'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const place = (p: Partial<TrainPlace>): TrainPlace => ({ ...HOME_PLACE, ...p })

console.log('ROUND TRIP — every screen survives being written down and read back\n')
const places: Array<[string, TrainPlace]> = [
  ['the week', HOME_PLACE],
  ['a day', place({ view: 'workout', day: 2 })],
  ['day zero', place({ view: 'workout', day: 0 })],
  ['an exercise', place({ view: 'exercise', day: 1, exercise: 'Barbell Squat' })],
  ['the builder', place({ view: 'builder' })],
  ['my programs', place({ view: 'myPrograms' })],
  ['the chooser', place({ view: 'startFrom' })],
]
for (const [label, p] of places) {
  const back = queryToPlace(placeToQuery(p))
  ok(samePlace(back, p), label, placeToQuery(p) || '(no query)')
}

console.log('\nEXERCISE NAMES — the library is full of punctuation\n')
for (const name of [
  'Barbell Bench Press - Medium Grip',
  'Stiff-Legged Dumbbell Deadlift',
  'Butt Lift (Bridge)',
  '3/4 Sit-Up',
  '90/90 Hamstring',
]) {
  const p = place({ view: 'exercise', day: 0, exercise: name })
  const back = queryToPlace(placeToQuery(p))
  ok(back.exercise === name, name, back.exercise ?? 'lost')
}

console.log('\nTHE DASHBOARD LINK — ?day=N has always meant "open that session"\n')
const deep = queryToPlace('?day=3')
ok(deep.view === 'workout' && deep.day === 3, 'bare ?day=3 opens the session', `${deep.view} day ${deep.day}`)
ok(placeToQuery(deep) === '?view=workout&day=3', 'and normalises on arrival', placeToQuery(deep))

console.log('\nRUBBISH IN THE ADDRESS — a bookmark, a typo, a hand-edited URL\n')
const bad: Array<[string, string, string]> = [
  ['', 'empty', 'preview'],
  ['?day=', 'an empty day', 'preview'],
  ['?view=nonsense', 'unknown screen', 'preview'],
  ['?view=workout', 'a day screen with no day', 'preview'],
  ['?view=exercise&day=1', 'an exercise screen with no exercise', 'workout'],
  ['?day=-4', 'a negative day', 'preview'],
  ['?day=abc', 'a day that is not a number', 'preview'],
  ['?tab=program', 'a link saved when the week had sub-tabs', 'preview'],
  ['?view=workout&day=2.7', 'a fractional day', 'preview'],
]
for (const [q, label, want] of bad) {
  const p = queryToPlace(q)
  ok(p.view === want, `${label} lands on ${want}`, `${q || '(empty)'} -> ${p.view}`)
}

console.log('\nNO SURPRISE QUERY STRINGS\n')
ok(placeToQuery(HOME_PLACE) === '', 'the week has a bare address', `"${placeToQuery(HOME_PLACE)}"`)
ok(
  placeToQuery(place({ view: 'builder', day: 4 })) === '?view=builder',
  'a day left over from earlier is not carried into the builder',
  placeToQuery(place({ view: 'builder', day: 4 }))
)
ok(
  queryToPlace('?tab=program&view=myPrograms').view === 'myPrograms',
  'a retired tab parameter is ignored, not fought with',
  queryToPlace('?tab=program&view=myPrograms').view
)

console.log(
  failed === 0 ? '\nAll Train address checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
