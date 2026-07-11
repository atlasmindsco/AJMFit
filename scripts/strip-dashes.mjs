/**
 * Removes em/en dashes from website source copy (voice rule: dashes = AI slop).
 * Rules:
 *   1. digit[dash]digit  -> hyphen   ("30–45 min" -> "30-45 min")
 *   2. remaining em/en dashes (and HTML entities) -> ", " with comma cleanup
 * Scope: app/ + components/ + lib/ .ts/.tsx files. ISSA mentions are untouched.
 * Run: node scripts/strip-dashes.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const files = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d)))
const DASH = /—|–|&mdash;|&ndash;|&#8212;|&#8211;|&#x2014;|&#x2013;/g

let changed = 0
let total = 0
for (const path of files) {
  const src = readFileSync(path, 'utf8')
  const hits = src.match(DASH)
  if (!hits) continue
  const out = src
    // rule 1: numeric ranges -> hyphen
    .replace(/(\d)\s*(?:—|–|&ndash;|&#8211;|&#x2013;)\s*(?=\d)/g, '$1-')
    // rule 2: prose dashes -> comma
    .replace(/\s*(?:—|–|&mdash;|&ndash;|&#8212;|&#8211;|&#x2014;|&#x2013;)\s*/g, ', ')
    // cleanup: no space before comma, collapse doubles
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
  if (out !== src) {
    writeFileSync(path, out, 'utf8')
    changed++
    total += hits.length
    console.log(`${path.slice(ROOT.length + 1)}: ${hits.length}`)
  }
}
console.log(`\nfiles changed: ${changed} | dashes removed: ${total}`)
