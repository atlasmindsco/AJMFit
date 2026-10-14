/**
 * Add one recommendation from the command line.
 *
 * Normally Anthony adds these himself at /luffy/products — that is the whole
 * point of the admin screen. This exists for seeding the first row, and it
 * writes products HIDDEN so nothing reaches a client until he has read it on
 * the screen it will appear on.
 *
 *   node tools/ops/seed-recommendation.mjs --name "..." --url "..." --category Protein --why "..."
 *   add --confirm to write
 */
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const name = args.name
const url = args.url
if (!name || !url) fail('Need --name and --url.')

const row = {
  name,
  category: args.category || 'Protein',
  external_url: url,
  merchant: args.merchant || 'Amway',
  why_recommended: args.why || null,
  what_it_is: args.what || null,
  who_it_suits: args.who || null,
  how_used: args.how || null,
  worth_knowing: args.knowing || null,
  image_url: args.image || null,
  // Hidden. Publishing to clients is Anthony's call, made on the screen the
  // client will see, not a flag on a command line.
  is_active: false,
  sort_order: Number(args.order ?? 0),
}

console.log('\nWould add, HIDDEN from clients:\n')
for (const [k, v] of Object.entries(row)) if (v !== null && v !== '') console.log(`  ${k.padEnd(18)} ${v}`)

requireConfirm(args, `add "${name}" as a hidden recommendation`)

const { error } = await sb.from('product_recommendations').insert(row)
if (error) fail(error.message)

await logAction({
  action: 'seed_recommendation',
  summary: `Added hidden recommendation: ${name}`,
  detail: row,
})
console.log(`\n✔ Added. It is HIDDEN — publish it at /luffy/products when you are happy with the wording.\n`)
