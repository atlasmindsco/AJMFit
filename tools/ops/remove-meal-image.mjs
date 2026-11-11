/**
 * Take a meal's photograph back off.
 *
 * The admin page at /luffy/meals does this with one click, which is the
 * right way when you are already looking at the grid. This is for the ones
 * handed over in conversation, and for pulling several at once after a batch
 * turns out to show the wrong food — which is exactly what it was written
 * for: three snack photos cut from a contact sheet that showed granola where
 * the meal says almonds, cookies where it says a protein bar, and no pitta
 * where it says pitta.
 *
 * A card with no photo falls back to a clean text layout, so removing one is
 * never worse than leaving a picture that contradicts the portion list under
 * it.
 *
 *   node tools/ops/remove-meal-image.mjs --meals=s4,s6,s9
 *   add --confirm to write
 */
import { readFileSync } from 'node:fs'
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

const ids = String(args.meals || args.meal || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
if (!ids.length) fail('Need --meals=<id>[,<id>...]')

// The meal has to be real, or a typo silently removes nothing and reports
// success.
const lib = readFileSync(new URL('../../lib/meal-library.ts', import.meta.url), 'utf8')
const known = [...lib.matchAll(/id: '([a-z0-9]+)'/g)].map((m) => m[1])
const names = new Map(
  [...lib.matchAll(/id: '([a-z0-9]+)', name: '([^']*)'/g)].map((m) => [m[1], m[2]])
)
for (const id of ids) {
  if (!known.includes(id)) fail(`No meal with id "${id}".`)
}

// Only report what is actually there.
const { data: listing, error: listErr } = await sb.storage
  .from('meal-images')
  .list('', { limit: 200 })
if (listErr) fail(listErr.message)
const present = new Set((listing ?? []).map((f) => f.name))

console.log('')
let found = 0
for (const id of ids) {
  const hit = EXTENSIONS.map((e) => `${id}.${e}`).find((p) => present.has(p))
  if (hit) found++
  console.log(`  ${hit ? 'remove' : 'absent'}  ${id.padEnd(4)} ${names.get(id) ?? ''}${hit ? `  (${hit})` : ''}`)
}
console.log('')

if (!found) fail('None of those meals has a photo.')

requireConfirm(args, `remove ${found} meal photo(s)`)

const paths = []
for (const id of ids) for (const e of EXTENSIONS) paths.push(`${id}.${e}`)
const { error } = await sb.storage.from('meal-images').remove(paths)
if (error && !/not found/i.test(error.message ?? '')) fail(error.message)

await logAction({
  action: 'remove_meal_image',
  summary: `Removed meal photo(s): ${ids.join(', ')}`,
})

console.log(`✔ Removed ${found}. Those cards fall back to the text layout.\n`)
