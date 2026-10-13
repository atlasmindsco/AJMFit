import { readFileSync, writeFileSync } from 'node:fs'
import { MEALS } from '../lib/meal-library.ts'
import { PORTIONS } from '../lib/meal-portions.ts'

const FOODS: Record<string, [number, number, number, number]> = JSON.parse(
  readFileSync(new URL('./.foods.json', import.meta.url), 'utf8')
)

const calc = (ps: Array<{ grams: number; ref: string }>) => {
  let c = 0, p = 0, cb = 0, f = 0
  for (const x of ps) {
    const r = FOODS[x.ref]; if (!r) continue
    const k = x.grams / 100
    c += r[0] * k; p += r[1] * k; cb += r[2] * k; f += r[3] * k
  }
  return { cal: Math.round(c), pro: Math.round(p), carb: Math.round(cb), fat: Math.round(f) }
}

// Only "NNNg" / "NNNml" portions scale. Eggs, scoops, slices, tins stay whole.
const scalable = (a: string) => /^\d+(\.\d+)?\s*(g|ml)$/.test(a.trim())
const roundTo = (n: number) => (n >= 100 ? Math.round(n / 10) * 10 : Math.round(n / 5) * 5)

const out: Record<string, any[]> = {}
const report: string[] = []

for (const meal of MEALS) {
  const ps = PORTIONS[meal.id].map((x) => ({ ...x }))
  const fixedCal = calc(ps.filter((x) => !scalable(x.amount))).cal
  const flex = ps.filter((x) => scalable(x.amount))
  const flexCal = calc(flex).cal

  if (flex.length && flexCal > 0) {
    const want = Math.max(0, meal.calories - fixedCal)
    const k = want / flexCal
    for (const x of flex) {
      const next = Math.max(5, roundTo(x.grams * k))
      x.grams = next
      x.amount = `${next}${x.amount.trim().endsWith('ml') ? 'ml' : 'g'}`
    }
  }
  const got = calc(ps)
  out[meal.id] = ps
  const drift = Math.round(((got.cal - meal.calories) / meal.calories) * 100)
  report.push(`${meal.id.padEnd(4)} ${meal.name.slice(0, 36).padEnd(37)} ${String(meal.calories).padStart(4)} -> ${String(got.cal).padStart(4)} cal (${drift > 0 ? '+' : ''}${drift}%)  ${got.pro}p ${got.carb}c ${got.fat}f`)
}

writeFileSync(new URL('./.scaled.json', import.meta.url), JSON.stringify(out, null, 2))
console.log(report.join('\n'))
