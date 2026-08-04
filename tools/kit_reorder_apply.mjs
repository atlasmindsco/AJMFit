// kit_reorder_apply.mjs — Realign the LIVE "Brains & Gains — Welcome" Kit
// sequence to course order (issue #1..#51) by PERMUTING existing rendered
// content between positional slots. No re-rendering, no deletes: each slot keeps
// its id/position/delay; only its subject+preview+content are swapped to the
// issue that belongs at that position. Welcome (position 0) is never touched.
//
//   node tools/kit_reorder_apply.mjs           # dry run: print the remap plan
//   node tools/kit_reorder_apply.mjs --apply    # execute, then verify
import { readFileSync } from 'node:fs'

const ROOT = 'C:/Users/Dbibil/OneDrive/Documents/AI Projects/AJMFit'
const SEQ = 2800010
const APPLY = process.argv.includes('--apply')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function key() {
  for (const l of readFileSync(ROOT + '/.env.local', 'utf8').split(/\r?\n/)) {
    if (l.startsWith('KIT_API_KEY=')) return l.slice('KIT_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
  }
  throw new Error('no KIT_API_KEY in .env.local')
}
const K = key()
const H = { 'X-Kit-Api-Key': K, 'Content-Type': 'application/json' }

async function getEmail(id) {
  const r = await fetch(`https://api.kit.com/v4/sequences/${SEQ}/emails/${id}`, { headers: H })
  if (!r.ok) throw new Error(`GET ${id} -> HTTP ${r.status}: ${await r.text()}`)
  return (await r.json()).email
}
async function patchEmail(id, body) {
  const r = await fetch(`https://api.kit.com/v4/sequences/${SEQ}/emails/${id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`PATCH ${id} -> HTTP ${r.status}: ${await r.text()}`)
  return r.status
}

// .bak = the sequence's ORIGINAL (interleaved) order == its physical positions.
// items[i] is position i+1: num it currently serves + the email id at that slot.
const bak = JSON.parse(readFileSync(ROOT + '/newsletter-content/queue.json.bak', 'utf8'))
const posEntries = bak.items                       // index i -> position i+1
const idByNum = Object.fromEntries(bak.items.map((it) => [it.num, it.seq_email_id]))
const N = posEntries.length                        // 51

// Snapshot every issue's CURRENT live content, keyed by issue number.
console.log(`Snapshotting ${N} live emails...`)
const snap = {}
for (const it of bak.items) {
  const e = await getEmail(it.seq_email_id)
  snap[it.num] = { subject: e.subject, preview_text: e.preview_text, content: e.content }
  await sleep(80)
}

// Remap plan: position p should serve issue num=p.
console.log(`\n${'POS'.padStart(3)}  ${'CURRENT (old)'.padEnd(46)}  ->  NEW (issue #p)`)
console.log('-'.repeat(104))
const jobs = []
for (let p = 1; p <= N; p++) {
  const targetId = posEntries[p - 1].seq_email_id   // email physically at position p
  const oldNum = posEntries[p - 1].num
  const src = snap[p]                                // content of issue #p
  jobs.push({ p, targetId, src })
  const oldS = `#${String(oldNum).padStart(2)} ${snap[oldNum].subject}`.slice(0, 46)
  const newS = `#${String(p).padStart(2)} ${src.subject}`
  const changed = oldNum === p ? '  (unchanged)' : ''
  console.log(`${String(p).padStart(3)}  ${oldS.padEnd(46)}  ->  ${newS}${changed}`)
}

if (!APPLY) {
  console.log('\nDRY RUN — nothing sent. Re-run with --apply to execute.')
  process.exit(0)
}

console.log('\nApplying...')
for (const { p, targetId, src } of jobs) {
  const code = await patchEmail(targetId, { subject: src.subject, preview_text: src.preview_text, content: src.content })
  console.log(`  pos ${String(p).padStart(2)} [id ${targetId}] <- #${p} "${src.subject}" -> HTTP ${code}`)
  await sleep(80)
}

// Verify: re-fetch the list and confirm each position's subject == issue #p's subject.
console.log('\nVerifying...')
const listRes = await fetch(`https://api.kit.com/v4/sequences/${SEQ}/emails`, { headers: H })
const live = (await listRes.json()).emails
let ok = 0, bad = 0
for (let p = 1; p <= N; p++) {
  const liveEmail = live.find((e) => e.position === p)
  const want = snap[p].subject
  if (liveEmail && liveEmail.subject === want) ok++
  else { bad++; console.log(`  MISMATCH pos ${p}: got "${liveEmail?.subject}" want "${want}"`) }
}
console.log(`\nDone. ${ok}/${N} positions correct${bad ? `, ${bad} MISMATCH` : ''}. Welcome (pos 0) untouched.`)
