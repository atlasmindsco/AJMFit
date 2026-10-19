/**
 * Put one meal photograph in the bucket from the command line.
 *
 * Anthony normally does this at /luffy/meals, which is the point of that
 * screen. This exists for the ones he hands over in conversation, and it
 * enforces the same rules the screen does: the filename becomes the meal id,
 * and the meal has to exist.
 *
 *   node tools/ops/upload-meal-image.mjs --meal=b1 --file="C:/path/to/image.webp"
 *   add --confirm to write
 */
import { readFileSync } from 'node:fs'
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const mealId = String(args.meal || '').toLowerCase()
const filePath = args.file
if (!mealId || !filePath) fail('Need --meal=<id> and --file=<path>.')

const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
const ext = String(filePath).split('.').pop().toLowerCase()
if (!TYPES[ext]) fail(`${ext} is not accepted — use jpg, png or webp.`)

let bytes
try {
  bytes = readFileSync(filePath)
} catch {
  fail(`Could not read ${filePath}`)
}

const MAX = 3 * 1024 * 1024
if (bytes.length > MAX) fail(`${Math.round(bytes.length / 1024)} KB is over the 3 MB ceiling.`)

// The meal has to be real, or the file sits in the bucket matching nothing.
const lib = readFileSync(new URL('../../lib/meal-library.ts', import.meta.url), 'utf8')
const known = [...lib.matchAll(/id: '([a-z0-9]+)'/g)].map((m) => m[1])
if (!known.includes(mealId)) fail(`No meal with id "${mealId}". Known ids: ${known.slice(0, 8).join(', ')}…`)

const nameMatch = new RegExp("id: '" + mealId + "', name: '([^']*)'").exec(lib)
const path = `${mealId}.${ext}`

console.log(`\n  meal    ${mealId} — ${nameMatch ? nameMatch[1] : '(unknown)'}`)
console.log(`  file    ${filePath}`)
console.log(`  as      ${path}  (${Math.round(bytes.length / 1024)} KB, ${TYPES[ext]})\n`)

requireConfirm(args, `upload the photo for ${mealId}`)

// Replace any other extension first, so b1.jpg and b1.webp cannot both exist.
await sb.storage.from('meal-images').remove(Object.keys(TYPES).map((e) => `${mealId}.${e}`))

const { error } = await sb.storage
  .from('meal-images')
  .upload(path, bytes, { upsert: true, contentType: TYPES[ext] })
if (error) fail(error.message)

const { data: pub } = sb.storage.from('meal-images').getPublicUrl(path)
await logAction({
  action: 'upload_meal_image',
  summary: `Added a photo for meal ${mealId}`,
  detail: { meal: mealId, path, bytes: bytes.length },
})
console.log(`\n✔ Uploaded.\n  ${pub.publicUrl}\n`)
