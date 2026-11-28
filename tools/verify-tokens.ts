/**
 * Every colour class names a colour that exists.
 *
 * WHY THIS EXISTS, precisely. The achievement gold was added to the palette
 * under `state`, and all twelve places that used it wrote `brand-gold`.
 * Tailwind does not warn about a class naming a colour it has never heard of.
 * It emits no rule at all, the element inherits whatever colour is above it,
 * and the result renders — in the wrong colour, with no error anywhere.
 *
 * So the PR row shipped with its trophy and its label in a dim inherited navy
 * on a black card, barely legible, while the type-scale check, the contrast
 * check, the type checker and the production build all passed. The contrast
 * check in particular measured #D4AF37 against the studio surfaces and
 * reported 8.98:1, which was true of the colour and irrelevant to the screen,
 * because that colour was never reaching it. A customer saw it before any
 * test did.
 *
 * That is the whole class of bug this closes: a name that looks like a token
 * and is not one fails silently and looks like a design choice. There is no
 * runtime symptom to catch, so it has to be caught in the source.
 *
 * It reads tailwind.config.ts rather than importing it, deliberately — the
 * config is TypeScript with a `satisfies`-shaped export and a plugin array,
 * and a scan that cannot be broken by how the file is written is worth more
 * here than a precise one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

/* ── What the palette actually defines ─────────────────────────────────── */

const config = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8')

/**
 * Pull `group: { name: value, ... }` out of the colors block.
 *
 * Comments inside a group are stripped first, because several of these
 * groups carry long notes that contain words looking exactly like keys.
 */
function groupKeys(group: string): string[] | null {
  const open = config.indexOf(`${group}: {`)
  if (open < 0) return null
  let depth = 0
  let i = config.indexOf('{', open)
  const start = i
  for (; i < config.length; i++) {
    if (config[i] === '{') depth++
    else if (config[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = config
    .slice(start + 1, i)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  return Array.from(body.matchAll(/(?:^|[\s,{])([A-Za-z0-9_]+)\s*:/g), (m) => m[1])
}

/* The custom colour groups. Tailwind's own palette (red-500, gray-200) is not
   checked here: those always exist, and whether they SHOULD be used is
   verify-contrast.ts's business, not this file's. */
const GROUPS = ['brand', 'surface', 'state', 'ink', 'hairline', 'technique']
const palette = new Map<string, string[]>()

console.log('WHAT THE PALETTE DEFINES\n')
for (const g of GROUPS) {
  const keys = groupKeys(g)
  ok(keys !== null && keys.length > 0, `${g}`, keys ? keys.join(' ') : 'NOT FOUND IN CONFIG')
  if (keys) palette.set(g, keys)
}

/* The four that the gold incident turned into fixed points. Each is a colour
   the product refers to by name in prose, in commit messages and in customer
   feedback, so moving one silently is the same mistake again. */
console.log('\nAND THE ONES THAT ARE SPOKEN ABOUT BY NAME\n')
ok(palette.get('brand')?.includes('gold') === true, 'gold is `brand-gold`', 'a record is not a state')
ok(palette.get('state')?.includes('gold') !== true, 'and is NOT also under `state`', 'two homes is how it got lost')
ok(palette.get('brand')?.includes('blueink') === true, 'blueink is `brand-blueink`')
ok(palette.get('state')?.includes('success') === true, 'success is `state-success`')

/* ── What the source asks for ──────────────────────────────────────────── */

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full)
  }
  return out
}

const files: string[] = []
for (const d of ['app', 'components', 'lib']) {
  try {
    walk(join(ROOT, d), files)
  } catch {
    /* A directory that is not there is not a failure. */
  }
}

/* Every Tailwind utility that takes a colour. `shadow` is in because
   `shadow-brand-blue` is a real thing somebody will write one day. */
const UTILITIES =
  'bg|text|border|ring|ring-offset|divide|outline|decoration|accent|caret|fill|stroke|from|via|to|shadow|placeholder'
const CLASS_RE = new RegExp(
  `\\b(?:[a-z-]+:)*(?:${UTILITIES})-(${GROUPS.join('|')})-([a-z0-9]+)(?![a-z0-9-])`,
  'g'
)

const unknown = new Map<string, string[]>()
let checked = 0
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      for (const m of line.matchAll(CLASS_RE)) {
        checked++
        const [, group, name] = m
        if (palette.get(group)?.includes(name)) continue
        /* `ink` and `hairline` carry a DEFAULT, so bare `text-ink` is valid
           and `text-ink-2` is the numbered form the regex already caught. */
        const key = `${group}-${name}`
        if (!unknown.has(key)) unknown.set(key, [])
        unknown.get(key)!.push(`${rel}:${i + 1}`)
      }
    })
}

console.log(`\nEVERY COLOUR CLASS IN ${files.length} FILES NAMES A REAL TOKEN\n`)
console.log(`        ${checked} colour classes read`)
for (const [key, where] of Array.from(unknown.entries())) {
  ok(false, `${key} is not in the palette`, `${where.length} usage${where.length === 1 ? '' : 's'}\n         ${where.slice(0, 8).join('\n         ')}`)
}
ok(unknown.size === 0, 'nothing names a colour that does not exist', unknown.size === 0 ? 'clean' : `${unknown.size} name${unknown.size === 1 ? '' : 's'}`)

/* ── The check can only work if it can see the classes ─────────────────── */
console.log('\nAND THE SCAN ITSELF IS NOT LOOKING AT AN EMPTY ROOM\n')
/* A regex that silently matches nothing would pass this file forever. These
   pin that it is reading real classes out of real screens. */
ok(checked > 200, 'it found a realistic number of colour classes', String(checked))
ok(
  Array.from(files).some((f) => /app[\\/]studio[\\/]programs/.test(f)),
  'including the training screen, which has the most of them'
)

console.log(failed === 0 ? '\nAll token checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
