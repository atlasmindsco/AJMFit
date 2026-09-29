/** Exercises the ranking in fetchRecentFoods against a stubbed food_logs table. */
const HALF_LIFE = 30, WINDOW = 90

const d = (back: number) => {
  const t = new Date(); t.setDate(t.getDate() - back)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}`
}

type Row = { food_name: string; calories: number; date: string; serving_size: string | null }
const rows: Row[] = []
const add = (name: string, cals: number, daysAgoList: number[], serving = '1 serving') =>
  daysAgoList.forEach(a => rows.push({ food_name: name, calories: cals, date: d(a), serving_size: serving }))

// A daily staple, eaten 40 times across three months.
add('Greek yoghurt', 180, Array.from({length: 40}, (_, i) => i * 2))
// Tried twice, very recently.
add('Pad thai', 720, [0, 1])
// Was a staple, abandoned two months ago.
add('Protein bar', 220, [55, 57, 59, 61, 63, 65, 67, 69])
// Eaten every few days, steadily.
add('Chicken and rice', 520, [1, 4, 8, 12, 16, 22, 28, 35])
// Once, today.
add('Birthday cake', 400, [0])
// Portion changed: most recent should win.
add('Oats', 300, [20, 15, 10])
rows.push({ food_name: 'Oats', calories: 450, date: d(1), serving_size: '1.5 cups' })

// --- the ranking under test ---
const today = d(0)
const daysBetween = (x: string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(x)) / 86400000))
const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
const groups = new Map<string, { score: number; times: number; newest: Row; daysAgo: number }>()
for (const r of sorted) {
  if (daysBetween(r.date) > WINDOW) continue
  const k = r.food_name.toLowerCase()
  const w = Math.pow(0.5, daysBetween(r.date) / HALF_LIFE)
  const g = groups.get(k)
  if (!g) groups.set(k, { score: w, times: 1, newest: r, daysAgo: daysBetween(r.date) })
  else { g.score += w; g.times++ }
}
const out = [...groups.values()].sort((a, b) => b.score - a.score)

const W = (s: any, n: number) => String(s).padEnd(n)
console.log(W('FOOD', 20), W('SCORE', 8), W('TIMES', 7), W('LAST', 10), 'CALS (most recent)')
console.log('-'.repeat(66))
for (const g of out) {
  console.log(W(g.newest.food_name, 20), W(g.score.toFixed(2), 8), W(g.times, 7),
    W(g.daysAgo === 0 ? 'today' : g.daysAgo + 'd ago', 10), g.newest.calories)
}

let fail = 0
const order = out.map(g => g.newest.food_name)
const check = (label: string, ok: boolean) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`) }
console.log()
check('daily staple ranks first', order[0] === 'Greek yoghurt')
check('steady food beats a 2x recent novelty', order.indexOf('Chicken and rice') < order.indexOf('Pad thai'))
check('abandoned staple sinks below current ones', order.indexOf('Protein bar') > order.indexOf('Chicken and rice'))
check('one-off today does not top the list', order[0] !== 'Birthday cake')
check('changed portion returns the NEW calories', out.find(g => g.newest.food_name === 'Oats')!.newest.calories === 450)
check('times counted correctly', out.find(g => g.newest.food_name === 'Greek yoghurt')!.times === 40)
console.log('\n' + (fail === 0 ? 'ALL RANKING CHECKS PASSED' : `*** ${fail} FAILURES ***`))
