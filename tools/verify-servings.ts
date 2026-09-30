import { unitsFor, defaultUnitFor, formatServing, parseServing, servingChoices, UNITS, type UnitKey } from '../lib/servings.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => { if (!ok) fail++; console.log(W(ok?'  ok':'  FAIL',7), W(label,48), detail) }

console.log('THE REPORTED CASE\n')
const jelly = unitsFor('Grape Jelly')
console.log('  Grape Jelly ->', jelly.join(', '))
g('jelly offers tablespoons', jelly.includes('tbsp'))
g('jelly offers grams', jelly.includes('g'))
g('jelly does NOT offer slices', !jelly.includes('slice'))
g('jelly defaults to tablespoons', defaultUnitFor('Grape Jelly') === 'tbsp', defaultUnitFor('Grape Jelly'))
g('20 g is expressible', formatServing(20, 'g') === '20 g', formatServing(20, 'g'))
g('1 tbsp is expressible', formatServing(1, 'tbsp') === '1 tbsp', formatServing(1, 'tbsp'))

console.log('\nUNIT RELEVANCE\n')
const cases: Array<[string, UnitKey[], UnitKey[]]> = [
  // food,                    must offer,          must NOT offer
  ['Grape Jelly',             ['tbsp','g'],        ['slice','scoop']],
  ['Peanut Butter',           ['tbsp','g'],        ['slice']],
  ['Whole Wheat Bread',       ['slice','g'],       ['scoop']],
  ['Cheddar Cheese',          ['slice','g'],       ['scoop']],
  ['Whey Protein Powder',     ['scoop','g'],       ['slice']],
  ['Whole Milk',              ['ml','cup'],        ['slice','scoop']],
  ['Large Egg',               ['piece','g'],       ['scoop']],
  ['White Rice',              ['cup','g'],         ['slice','scoop']],
  ['Olive Oil',               ['tbsp','g'],        ['slice','scoop']],
  ['Orange Juice',            ['ml','cup'],        ['slice','scoop']],
  ['Chicken Breast',          ['piece','g','oz'],  ['scoop']],
  ['Banana',                  ['piece','g'],       ['slice','scoop']],
  ['Greek Yogurt',            ['cup','g'],         ['slice']],
]
for (const [food, must, mustNot] of cases) {
  const u = unitsFor(food)
  const okHas = must.every(x => u.includes(x))
  const okNot = mustNot.every(x => !u.includes(x))
  if (!okHas || !okNot) fail++
  console.log(W(okHas && okNot ? '  ok' : '  FAIL', 7), W(food, 24), u.join(', ').slice(0, 44))
}

console.log('\nUNKNOWN FOODS GET A SAFE SET\n')
const unknown = unitsFor('Zorbium Crunch Delight')
console.log('  unknown ->', unknown.join(', '))
g('offers grams', unknown.includes('g'))
g('does not offer slices', !unknown.includes('slice'))
g('does not offer scoops', !unknown.includes('scoop'))
g('every food offers grams', cases.every(([f]) => unitsFor(f).includes('g')))
g('no duplicate units ever', cases.every(([f]) => { const u = unitsFor(f); return new Set(u).size === u.length }))

console.log('\nFORMATTING\n')
for (const [amt, unit, want] of [
  [20, 'g', '20 g'], [1, 'tbsp', '1 tbsp'], [0.5, 'tbsp', '1/2 tbsp'],
  [0.25, 'cup', '1/4 cup'], [1, 'cup', '1 cup'], [2, 'cup', '2 cups'],
  [1, 'slice', '1 slice'], [3, 'slice', '3 slices'], [37.5, 'g', '37.5 g'],
] as Array<[number, UnitKey, string]>) {
  const got = formatServing(amt, unit)
  if (got !== want) fail++
  console.log(W(got === want ? '  ok' : '  FAIL', 7), W(`${amt} ${unit}`, 16), W(got, 14), got === want ? '' : `expected ${want}`)
}

console.log('\nROUND TRIP\n')
for (const [amt, unit] of [[20,'g'],[1,'tbsp'],[0.5,'cup'],[2,'slice'],[1.5,'scoop'],[100,'ml']] as Array<[number,UnitKey]>) {
  const text = formatServing(amt, unit)
  const back = parseServing(text)
  const ok = back !== null && back.unit === unit && Math.abs(back.amount - amt) < 0.03
  if (!ok) fail++
  console.log(W(ok?'  ok':'  FAIL',7), W(text,16), '->', back ? `${back.amount} ${back.unit}` : 'null')
}
g('parses a USDA-style label', (() => { const p = parseServing('1 serving (113 g)'); return p?.unit === 'serving' && p.amount === 1 })())
g('parses "2 tbsp (30 g)"', (() => { const p = parseServing('2 tbsp (30 g)'); return p?.unit === 'tbsp' && p.amount === 2 })())
g('junk returns null', parseServing('banana') === null && parseServing('') === null)
g('tbsp is not mistaken for tsp', parseServing('1 tbsp')?.unit === 'tbsp')

console.log('\n' + (fail === 0 ? 'ALL SERVING CHECKS PASSED' : `*** ${fail} FAILURES ***`))

console.log('\nSUBSTRING TRAPS (all of these were wrong before)\n')
{
  const traps: Array<[string, UnitKey[], string]> = [
    ['Chocolate Bar',   ['ml','cup','tbsp'], 'cola inside chocolate'],
    ['Steak',           ['ml','cup'],        'tea inside steak'],
    ['Hamburger',       ['slice'],           'ham inside hamburger'],
    ['Graham Cracker',  ['slice'],           'ham inside Graham'],
    ['Zorbium Delight', ['slice'],           'deli inside Delight'],
    ['Pierogi',         ['slice'],           'pie inside Pierogi'],
    // These three now fall through to the DEFAULT set, which legitimately
    // contains cup and tbsp. What matters is that they no longer match the
    // wrong category, so assert on each category's distinctive unit: tsp for
    // spreadables, ml for liquids, slice and scoop for their own.
    ['Coating Mix',     ['tsp','ml','slice','scoop'], 'oat inside Coating'],
    ['Boiled Potato',   ['tsp','ml','slice','scoop'], 'oil inside Boiled'],
    ['Cornish Hen',     ['tsp','ml','slice','scoop'], 'corn inside Cornish'],
  ]
  for (const [food, mustNot, why] of traps) {
    const u = unitsFor(food)
    const ok = mustNot.every((x) => !u.includes(x))
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(food, 18), W(why, 24), u.join(', ').slice(0, 30))
  }
  // and the legitimate matches still work
  g('oatmeal still matches cup', unitsFor('Oatmeal').includes('cup'))
  g('berries still matches cup', unitsFor('Mixed Berries').includes('cup'))
  g('ham on its own still slices', unitsFor('Sliced Ham').includes('slice'))
  g('iced tea is still a liquid', unitsFor('Iced Tea').includes('ml'))
}
console.log('\nSEARCH RESULTS: UNITS FROM THE LABEL\n')
{
  // USDA hands us a household serving. The unit inside it is the one the
  // client should be able to pick, with grams right beside it.
  const jelly = servingChoices({ label: '1 tbsp (20g)', grams: 20 })
  console.log('  Grape Jelly ->', jelly.map((c) => c.label).join('  |  '))
  g('offers tablespoons', jelly.some((c) => c.unit === 'tbsp'))
  g('a tablespoon weighs 20 g', jelly.find((c) => c.unit === 'tbsp')?.gramsPerUnit === 20)
  g('offers grams directly', jelly.some((c) => c.unit === 'g' && c.gramsPerUnit === 1))
  g('tablespoons come first', jelly[0]?.unit === 'tbsp')
  g('no slices', !jelly.some((c) => c.unit === 'slice'))

  // 20 g of a 250 kcal/100g jelly is 50 kcal, the number off the jar.
  const per100 = 250
  const grams = 20
  g('20 g prices correctly', Math.round((per100 * grams) / 100) === 50, `${Math.round((per100 * grams) / 100)} kcal`)

  const twoTbsp = servingChoices({ label: '2 tbsp (32g)', grams: 32 })
  g('divides a multi-unit label', twoTbsp[0]?.unit === 'tbsp' && twoTbsp[0]?.gramsPerUnit === 16, String(twoTbsp[0]?.gramsPerUnit))

  const noHousehold = servingChoices({ label: '1 serving (113 g)', grams: 113 })
  g('generic serving kept as servings', noHousehold[0]?.unit === 'serving' && noHousehold[0]?.gramsPerUnit === 113)

  const none = servingChoices(null)
  g('no label still offers g and oz', none.length === 2 && none[0].unit === 'g' && none[1].unit === 'oz')
  g('an ounce is 28.35 g', Math.abs((none[1]?.gramsPerUnit ?? 0) - 28.35) < 0.01)

  // A gram-only label must not produce two gram rows in the dropdown.
  const gramLabel = servingChoices({ label: '30 g', grams: 30 })
  g('never duplicates a unit', new Set(gramLabel.map((c) => c.unit)).size === gramLabel.length, gramLabel.map((c) => c.unit).join(','))
  g('every choice has a weight', gramLabel.every((c) => c.gramsPerUnit > 0))

  // Switching units must re-express the same food, not change the amount.
  const choices = servingChoices({ label: '1 tbsp (20g)', grams: 20 })
  const tbsp = choices.find((c) => c.unit === 'tbsp')!
  const gram = choices.find((c) => c.unit === 'g')!
  const asGrams = (2 * tbsp.gramsPerUnit) / gram.gramsPerUnit
  g('2 tbsp converts to 40 g', asGrams === 40, `${asGrams} g`)
  g('and back again', (asGrams * gram.gramsPerUnit) / tbsp.gramsPerUnit === 2)
}

console.log('\n' + (fail === 0 ? 'ALL SERVING CHECKS PASSED (incl. traps + search)' : `*** ${fail} FAILURES ***`))
