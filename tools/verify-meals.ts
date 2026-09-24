import { MEALS, filterMeals, fitsPattern, swapsFor } from '../lib/meal-library.ts'
import { DEFAULT_PREFERENCES, ALLERGENS, EATING_PATTERNS, type Allergen } from '../lib/food-preferences.ts'

const W=(s:any,n:number)=>String(s).padEnd(n)
let fail = 0

console.log(`Library: ${MEALS.length} meals\n`)
console.log('=== eating patterns ===')
for (const p of EATING_PATTERNS) {
  const meals = filterMeals({ ...DEFAULT_PREFERENCES, eatingPattern: p.value })
  const slots = ['breakfast','lunch','dinner','snack'].map(s => meals.filter(m=>m.slot===s).length)
  console.log(W(p.label,18), W(`${meals.length} meals`,10), `b${slots[0]} l${slots[1]} d${slots[2]} s${slots[3]}`)
  if (slots.some(n => n === 0)) { console.log(`   *** ${p.label} has an empty slot ***`); fail++ }
}

console.log('\n=== leak check: does any filtered meal violate its pattern? ===')
const VIOLATE: Record<string,string[]> = {
  vegan: ['red_meat','poultry','pork','fish','shellfish','dairy','eggs','honey'],
  vegetarian: ['red_meat','poultry','pork','fish','shellfish'],
  pescatarian: ['red_meat','poultry','pork'],
  halal: ['pork'],
}
for (const [pattern, banned] of Object.entries(VIOLATE)) {
  for (const m of filterMeals({ ...DEFAULT_PREFERENCES, eatingPattern: pattern as any })) {
    const bad = m.contains.filter(c => banned.includes(c))
    if (bad.length) { console.log(`   *** LEAK: ${pattern} shows "${m.name}" containing ${bad.join(',')} ***`); fail++ }
  }
}
// kosher: no pork, no shellfish, no meat+dairy together
for (const m of filterMeals({ ...DEFAULT_PREFERENCES, eatingPattern: 'kosher' })) {
  const meat = m.contains.includes('red_meat') || m.contains.includes('poultry')
  if (m.contains.includes('pork') || m.contains.includes('shellfish') || (meat && m.contains.includes('dairy'))) {
    console.log(`   *** LEAK: kosher shows "${m.name}" (${m.contains.join(',')}) ***`); fail++
  }
}
console.log(fail === 0 ? '   no leaks' : '')

console.log('\n=== allergens: every meal shown must be free of the flagged allergen ===')
for (const a of ALLERGENS) {
  const meals = filterMeals({ ...DEFAULT_PREFERENCES, allergens: [a.value] })
  const leak = meals.filter(m => m.allergens.includes(a.value))
  console.log(W(a.label,16), W(`${meals.length} left`,10), leak.length ? `*** ${leak.length} LEAKS ***` : 'clean')
  if (leak.length) fail++
}

console.log('\n=== worst case: vegan + 4 allergens ===')
const worst = filterMeals({ ...DEFAULT_PREFERENCES, eatingPattern: 'vegan', allergens: ['soy','peanuts','wheat_gluten','sesame'] as Allergen[] })
console.log(`   ${worst.length} meals survive:`, worst.map(m=>m.name).join(' | ') || '(none)')

console.log('\n=== swaps stay inside the filter ===')
const prefs = { ...DEFAULT_PREFERENCES, eatingPattern: 'vegetarian' as const, allergens: ['dairy'] as Allergen[] }
const pool = filterMeals(prefs)
let swapFail = 0
for (const m of pool) {
  for (const s of swapsFor(m, prefs)) {
    if (!pool.find(p => p.id === s.id)) { console.log(`   *** swap ${s.name} not in filtered pool ***`); swapFail++ }
    if (s.slot !== m.slot) { console.log(`   *** swap slot mismatch ***`); swapFail++ }
  }
}
console.log(swapFail === 0 ? `   all swaps valid across ${pool.length} meals` : '')
fail += swapFail

console.log('\n=== macro sanity: do stated macros match stated calories? ===')
for (const m of MEALS) {
  const sum = m.protein*4 + m.carbs*4 + m.fats*9
  const drift = Math.abs(sum - m.calories) / m.calories * 100
  if (drift > 12) { console.log(`   *** ${m.name}: macros sum to ${sum}, states ${m.calories} (${drift.toFixed(0)}% off) ***`); fail++ }
}
console.log(fail === 0 ? '   all within 12%' : '')
console.log(fail === 0 ? '\nALL MEAL LIBRARY CHECKS PASSED' : `\n*** ${fail} FAILURES ***`)
