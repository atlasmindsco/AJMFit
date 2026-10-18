import { supa, parseArgs, requireConfirm, logAction, fail } from './ops/_lib.mjs'
const args = parseArgs()
const sb = supa()
const B = 'https://www.amway.com/medias/'

// Full URLs, read off each product page. The ?context= is required — the bare
// path 400s — and it carries a checksum, so these cannot be constructed from
// the product id and had to be collected one page at a time.
const images = {
  '128154': B + '128154-en-US-690px-01?context=bWFzdGVyfGltYWdlc3wyNTYwNjR8aW1hZ2UvcG5nfHN5cy1tYXN0ZXIvaW1hZ2VzL2gyYy9oNzYvOTk3MjUxMjEyOTA1NC8xMjgxNTQtZW4tVVMtNjkwcHgtMDF8OTc1YzJjNjVlNGZmNzFkNDE4MDBjZjI1Nzc3YmMzNGM3MDhkMDI1YTNkODllODIyNmY4MjUxZWNmYzcwMTYwMA',
  '128156': B + '128156-en-US-690px-01?context=bWFzdGVyfGltYWdlc3wyMzAzOTl8aW1hZ2UvcG5nfHN5cy1tYXN0ZXIvaW1hZ2VzL2hjOC9oMWYvOTk3MjUxODkxMjAzMC8xMjgxNTYtZW4tVVMtNjkwcHgtMDF8ZDUyZmQwYWE3M2EyNjFkN2IwNjQwYjkyZTNiYWJhZmNkZjhjM2Q3YjcxZjMwMzU5Yjc0ODZjNGVmODUwY2NmOA',
  '128463': B + '128463-en-US-690px-01?context=bWFzdGVyfGltYWdlc3wyOTMyNTZ8aW1hZ2UvcG5nfHN5cy1tYXN0ZXIvaW1hZ2VzL2hhYy9oOWUvMTAzNjk4MzM0MzUxNjYvMTI4NDYzLWVuLVVTLTY5MHB4LTAxfGUwMTRmYmY4MjZhNTM5Yzg5MzE0YWI0ODM1OTk5Y2YzOGE4N2M3MjJjM2E5MDZiNTVmZjM0ZDY1YTg0YzVlOTE',
  '316375': B + '316375-en-US-690px-01?context=bWFzdGVyfGltYWdlc3w4NDg1N3xpbWFnZS9wbmd8c3lzLW1hc3Rlci9pbWFnZXMvaGEwL2gzNS85Njc3MzMyMTg1MTE4LzMxNjM3NS1lbi1VUy02OTBweC0wMXw3NDY5NmEyOTQ5ZmU0ZjJjOGQ3ZDU1OGFjYzc5ZGYwMzczNTljMjczYzNhZjczNmU3YzMzMjMzZTUwZDJmZDJi',
  '126754': B + '126754-en-US-690px-01?context=bWFzdGVyfGltYWdlc3w3OTM5NXxpbWFnZS9wbmd8aW1hZ2VzL2g3MS9oODkvOTQ2OTMxNTk3MzE1MC5wbmd8OWMyMzBhMmFlZDk0NTIwNDE3NjAwMTVhZjEwY2ZhNTBmMGQ5MTcxOTIxZDk5MWI2MDFhMmMxM2RjNTNmNTViMQ',
  '106964': B + '106964-en-US-690px-01?context=bWFzdGVyfGltYWdlc3w0Mzk4ODh8aW1hZ2UvcG5nfGltYWdlcy9oZDkvaDQ2Lzk0OTM4NDc3NjkxMTgucG5nfDU0YTMzYWFiZDg2YmY0NDk3NmUwYzM5NmMyYTE1ZWMzNzJjMzVkZTliMTA3Y2NjOWVkMzg4MTdiOTM0YjAyOTc',
}

const { data: rows } = await sb.from('product_recommendations').select('id, name, external_url, image_url')
const plan = []
for (const r of rows ?? []) {
  const m = /-p-(\d+)/.exec(r.external_url || '')
  if (!m || !images[m[1]]) continue
  if (r.image_url) continue
  plan.push({ id: r.id, name: r.name, url: images[m[1]] })
}

console.log(`\n${plan.length} products to give an image:\n`)
for (const p of plan) console.log(`  ${p.name}`)
if (!plan.length) { console.log('Nothing to do.\n'); process.exit(0) }

requireConfirm(args, `set image_url on ${plan.length} products`)
for (const p of plan) {
  const { error } = await sb.from('product_recommendations').update({ image_url: p.url }).eq('id', p.id)
  if (error) fail(`${p.name}: ${error.message}`)
}
await logAction({ action: 'set_product_images', summary: `Set product images on ${plan.length} recommendations`, detail: { names: plan.map(p=>p.name) } })
console.log(`\n✔ Set ${plan.length}.\n`)
