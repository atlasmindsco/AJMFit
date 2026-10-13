import { readFileSync, writeFileSync } from 'node:fs'

const scaled = JSON.parse(readFileSync('tools/.scaled.json', 'utf8'))
const FOODS = JSON.parse(readFileSync('tools/.foods.json', 'utf8'))
const esc = (s) => s.replace(/'/g, "\'")

const SLOT_OF = {}
const libSrc = readFileSync('lib/meal-library.ts', 'utf8')
for (const m of libSrc.matchAll(/id: '([a-z0-9]+)', name: '[^']*', slot: '(\w+)'/g)) SLOT_OF[m[1]] = m[2]

const order = ['breakfast', 'lunch', 'dinner', 'snack']
const headers = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

let block = 'export const PORTIONS: Record<string, Portion[]> = {\n'
for (const slot of order) {
  block += `  /* ── ${headers[slot]} ${'─'.repeat(Math.max(3, 60 - headers[slot].length))} */\n`
  for (const [id, ps] of Object.entries(scaled)) {
    if (SLOT_OF[id] !== slot) continue
    const inline = ps.map((x) => `p('${x.amount}', '${esc(x.food)}', ${x.grams}, '${x.ref}')`)
    const one = `  ${id}: [${inline.join(', ')}],`
    block += one.length <= 110
      ? one + '\n'
      : `  ${id}: [\n` + ps.map((x) => `    p('${x.amount}', '${esc(x.food)}', ${x.grams}, '${x.ref}'),`).join('\n') + '\n  ],\n'
  }
}
block += '}\n'

let src = readFileSync('lib/meal-portions.ts', 'utf8')
const start = src.indexOf('export const PORTIONS')
const end = src.indexOf('/** "250g Greek yoghurt')
if (start < 0 || end < 0) { console.error('markers', start, end); process.exit(1) }
writeFileSync('lib/meal-portions.ts', src.slice(0, start) + block + '\n' + src.slice(end))

let lib = libSrc
let n = 0
for (const [id, ps] of Object.entries(scaled)) {
  let c = 0, p = 0, cb = 0, f = 0
  for (const x of ps) {
    const r = FOODS[x.ref]; if (!r) continue
    const k = x.grams / 100
    c += r[0] * k; p += r[1] * k; cb += r[2] * k; f += r[3] * k
  }
  const re = new RegExp(`(id: '${id}', name: '[^']*', slot: '\w+', calories: )\d+(, protein: )\d+(, carbs: )\d+(, fats: )\d+`)
  if (!re.test(lib)) { console.error('no macro match', id); process.exit(1) }
  lib = lib.replace(re, `$1${Math.round(c)}$2${Math.round(p)}$3${Math.round(cb)}$4${Math.round(f)}`)
  n++
}
writeFileSync('lib/meal-library.ts', lib)
console.log('portions rewritten, macros derived for', n, 'meals')
