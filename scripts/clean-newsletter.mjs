/**
 * Cleans the Brains & Gains Kit sequence emails:
 *   - removes "ISSA" / "ISSA-certified" references (tacky)
 *   - removes em/en dashes (— –) by rewriting to commas, not hyphens (AI-slop)
 * Applies to subject, preview_text, and HTML body of all 52 emails.
 *
 * DRY RUN by default (prints before/after, changes nothing).
 * Pass --apply to push the cleaned versions back (published).
 *   node scripts/clean-newsletter.mjs           # dry run
 *   node scripts/clean-newsletter.mjs --apply    # write + publish
 */
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const SEQ = 2800010
const BASE = 'https://api.kit.com/v4'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const H = { 'X-Kit-Api-Key': env.KIT_API_KEY, 'Content-Type': 'application/json' }

// ---- transforms ----
function stripIssa(s) {
  return s
    // header tagline (in every email)
    .replace(/The ISSA cert, one Thursday at a time/gi, 'One Thursday at a time')
    .replace(/\bThe ISSA cert\b/gi, 'Weekly lessons')
    // bare terminal credential in the welcome sign-off (don't touch the footer "… Personal Trainer")
    .replace(/AJMfit\s*[—–]\s*ISSA Certified(?!\s+Personal)/gi, 'AJMFit')
    // drop the tacky "ISSA" brand token; KEEP the legit "Certified Personal Trainer" / "certified trainer" / "principle"
    .replace(/\bISSA[-\s]/gi, '')
    .replace(/\bISSA\b\s*/gi, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\bthe\s+the\b/gi, 'the')
}
function stripDashes(s) {
  return s
    // em/en dash + HTML entities, with surrounding whitespace, -> comma
    .replace(/\s*(?:—|–|&mdash;|&ndash;|&#8212;|&#8211;|&#x2014;|&#x2013;)\s*/gi, ', ')
    .replace(/\s*,\s*,\s*/g, ', ') // collapse any doubled commas
    .replace(/\s+,/g, ',')
}
function clean(s) {
  if (!s) return s
  return stripDashes(stripIssa(s))
}
function textSnippet(html, n = 160) {
  const t = (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
  return t.slice(0, n)
}

// ---- fetch all emails (with content) ----
const listRes = await fetch(`${BASE}/sequences/${SEQ}/emails?per_page=100&include_content=true`, { headers: H })
if (!listRes.ok) { console.error('list failed', listRes.status, await listRes.text()); process.exit(1) }
let emails = (await listRes.json()).emails ?? []

// If content wasn't included, fetch per email.
if (emails.length && emails[0].content == null) {
  console.log('(fetching content per email…)')
  const filled = []
  for (const e of emails) {
    const r = await fetch(`${BASE}/sequences/${SEQ}/emails/${e.id}`, { headers: H })
    filled.push(r.ok ? (await r.json()).email ?? e : e)
  }
  emails = filled
}

const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : Infinity })()
const stripText = (h) => (h || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const ctx = (text, re, n) => [...text.matchAll(re)].slice(0, n).map((m) => m[0])

let changed = 0, issaHits = 0, dashHits = 0, applied = 0, samplesShown = 0
for (const e of emails) {
  const newSubject = clean(e.subject)
  const newPreview = clean(e.preview_text)
  const newContent = clean(e.content || '')
  const blob = `${e.subject} ${e.preview_text} ${e.content}`
  if (/\bISSA\b/i.test(blob)) issaHits++
  if (/—|–|&mdash;|&ndash;|&#821[12];|&#x201[34];/i.test(blob)) dashHits++

  const isChanged = newSubject !== e.subject || newPreview !== e.preview_text || newContent !== (e.content || '')
  if (!isChanged) continue
  changed++

  if (!APPLY && samplesShown < 3) {
    samplesShown++
    const t = stripText(e.content)
    console.log(`\n#${e.position} [id ${e.id}] "${e.subject}"`)
    if (newSubject !== e.subject) console.log(`  subject: "${e.subject}"\n        -> "${newSubject}"`)
    if (newPreview !== e.preview_text) console.log(`  preview: "${e.preview_text}"\n        -> "${newPreview}"`)
    for (const c of ctx(t, /.{0,40}ISSA.{0,40}/g, 3)) console.log(`  ISSA: …${c}…\n     -> …${clean(c)}…`)
    for (const c of ctx(t, /.{0,30}[—–].{0,30}/g, 3)) console.log(`  dash: …${c}…\n     -> …${clean(c)}…`)
  }

  if (APPLY && applied < LIMIT) {
    const upd = await fetch(`${BASE}/sequences/${SEQ}/emails/${e.id}`, {
      method: 'PUT', headers: H,
      body: JSON.stringify({ subject: newSubject, preview_text: newPreview, content: newContent, published: true }),
    })
    applied++
    console.log(`apply #${e.position} [id ${e.id}]: HTTP ${upd.status}${upd.ok ? ' ok' : ' ' + (await upd.text()).slice(0, 160)}`)
  }
}

console.log(`\n=== ${APPLY ? `APPLIED ${applied}${LIMIT !== Infinity ? ` (limit ${LIMIT})` : ''}` : 'DRY RUN'} ===`)
console.log(`emails: ${emails.length} | to change: ${changed} | had ISSA: ${issaHits} | had dash: ${dashHits}`)
if (!APPLY) console.log('Re-run with --apply (add --limit 1 to test one first).')
process.exit(0)
