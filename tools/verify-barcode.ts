import { offMacros, parseServingGrams } from '../lib/food-recognition.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 54), detail)
}

console.log('THE REPORTED CASE: A SCANNED PROTEIN BAGEL\n')
{
  // Per-100g data, no serving weight. 17.5% of Open Food Facts products in a
  // sample look like this, and every one of them used to log as 0 cal 0 protein.
  const m = offMacros(
    { 'energy-kcal_100g': 250, proteins_100g: 20, carbohydrates_100g: 40, fat_100g: 3 },
    null
  )
  g('does not come back null', m !== null)
  g('protein is NOT zero', (m?.protein ?? 0) > 0, `${m?.protein}g`)
  g('calories are NOT zero', (m?.calories ?? 0) > 0, `${m?.calories}`)
  g('and it says the numbers are per 100 g', m?.basis === 'per100', String(m?.basis))
  g('with the weight stated', m?.grams === 100, String(m?.grams))
}

console.log('\nONE BASIS FOR ALL FOUR NUMBERS\n')
{
  // Calories per serving sitting beside protein per 100g described two
  // different amounts of food in the same row of four numbers.
  const m = offMacros(
    { 'energy-kcal_serving': 190, proteins_100g: 20, carbohydrates_100g: 40, fat_100g: 3 },
    null
  )
  g('mixed data falls back to per 100 g', m?.basis === 'per100', String(m?.basis))
  g('protein is the per-100g figure', m?.protein === 20, String(m?.protein))
  // The per-serving calorie figure must NOT be carried over onto per-100g
  // macros, and the answer must not be a zero either: 4/4/9 gives 267.
  g('calories are derived, not zero', (m?.calories ?? 0) > 0, `${m?.calories}`)
  g('calories are NOT the per-serving 190', m?.calories !== 190, `${m?.calories}`)
  g('4/4/9 of 20p 40c 3f is 267', Math.round(m?.calories ?? 0) === 267, String(Math.round(m?.calories ?? 0)))

  const full = offMacros(
    { 'energy-kcal_serving': 190, proteins_serving: 15, carbohydrates_serving: 30, fat_serving: 2 },
    85
  )
  g('complete per-serving data is used as-is', full?.basis === 'serving' && full?.calories === 190)
}

console.log('\nSCALING TO A KNOWN SERVING\n')
{
  const m = offMacros(
    { 'energy-kcal_100g': 250, proteins_100g: 20, carbohydrates_100g: 40, fat_100g: 3 },
    85
  )
  g('85 g of a 250/100g product is 212 cal', Math.round(m?.calories ?? 0) === 213, String(Math.round(m?.calories ?? 0)))
  g('protein scales with it', Math.round((m?.protein ?? 0) * 10) / 10 === 17, String(m?.protein))
  g('and it reports a serving basis', m?.basis === 'serving')
}

console.log('\nNO DATA IS NOT ZERO DATA\n')
{
  g('empty nutriments returns null', offMacros({}, null) === null)
  g('null, not a zero-filled object', offMacros({}, 85) === null)
  // Calories alone is not enough to call it nutrition.
  g('calories with no macros at all returns null', offMacros({ 'energy-kcal_100g': 250 }, null) === null)
  // But calories plus any one macro is real.
  g('calories plus protein is usable', offMacros({ 'energy-kcal_100g': 250, proteins_100g: 20 }, null) !== null)
  g('calories plus fat is usable', offMacros({ 'energy-kcal_100g': 250, fat_100g: 9 }, null) !== null)
}

console.log('\nREADING A WEIGHT OUT OF THE LABEL TEXT\n')
{
  const cases: Array<[string | undefined, number | null]> = [
    ['1 bagel (95 g)', 95],
    ['1 bagel (95g)', 95],
    ['90.0g', 90],
    ['100 g', 100],
    ['1 portion (45 g)', 45],
    ['250 ml', 250],
    ['2 oz', 56.7],
    // A bare number could be grams, slices or pieces. Guessing would invent a
    // serving weight and scale every macro by it. Open Food Facts really does
    // carry entries like this.
    ['13', null],
    ['1 bagel', null],
    ['', null],
    [undefined, null],
  ]
  for (const [text, want] of cases) {
    const got = parseServingGrams(text)
    const ok = want === null ? got === null : Math.abs((got ?? 0) - want) < 0.05
    if (!ok) fail++
    console.log(W(ok ? '  ok' : '  FAIL', 7), W(JSON.stringify(text ?? null), 22), W(String(got), 10), ok ? '' : `expected ${want}`)
  }
}

console.log('\nA PARSED WEIGHT RESCUES A BROKEN PRODUCT\n')
{
  // serving_quantity missing, but the label text still names the weight.
  const grams = parseServingGrams('1 bagel (95 g)')
  const m = offMacros({ 'energy-kcal_100g': 250, proteins_100g: 20, carbohydrates_100g: 40, fat_100g: 3 }, grams)
  g('weight recovered from the text', grams === 95)
  g('so it reports a real serving, not per-100g', m?.basis === 'serving', String(m?.basis))
  g('scaled to the bagel', Math.round(m?.protein ?? 0) === 19, String(m?.protein))
}

console.log('\n' + (fail === 0 ? 'ALL BARCODE CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
