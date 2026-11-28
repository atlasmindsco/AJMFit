/**
 * The accessibility rules that are about STRUCTURE rather than colour.
 *
 * Contrast has its own file, because contrast is arithmetic. These are the
 * three things that cannot be measured from a palette and that this codebase
 * has actually got wrong:
 *
 *   1. A button with nothing in it but an icon, and no label. To anyone using
 *      a screen reader that is a control called "button" that does something
 *      unknown. Three existed.
 *   2. `focus:outline-none` with nothing put back. It cancels the global
 *      focus ring, so a keyboard user loses track of where they are — and
 *      because it is a mouse user's convenience, the person who writes it
 *      never sees the damage.
 *   3. An animation that nothing switches off under `prefers-reduced-motion`.
 *      The app ran six animations and the rule covered one. Two of the five it
 *      missed, `ping` and `pulse`, never stop. "Reduce motion" is a medical
 *      setting, and this is a fitness app whose users are often moving.
 *
 * Source scans, like verify-type-scale. A real audit needs a person with a
 * screen reader; this catches the regressions that a person would have to
 * find twice.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx$/.test(entry)) out.push(full)
  }
  return out
}

/* The screens used at arm's length, by a client mid-set or a coach at a desk.
   The marketing site is a separate surface and is not swept here. */
const DIRS = ['app/studio', 'app/luffy', 'components/studio', 'components/admin', 'components/chat']
const files: string[] = []
for (const d of DIRS) {
  try {
    walk(join(ROOT, d), files)
  } catch {
    /* Absent directory is not a failure. */
  }
}
const where = (file: string, index: number, src: string) =>
  `${relative(ROOT, file).replace(/\\/g, '/')}:${src.slice(0, index).split('\n').length}`

/* ── 1. Every control says what it is ──────────────────────────────────── */
console.log(`SCANNING ${files.length} SCREENS\n`)
console.log('EVERY BUTTON HAS SOMETHING A SCREEN READER CAN SAY\n')

let buttons = 0
const nameless: string[] = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g)) {
    buttons++
    const [, attrs, inner] = m
    if (/aria-label|aria-labelledby|title=/.test(attrs)) continue
    /* Strip tags and JSX expressions; whatever text is left is the name. */
    const text = inner.replace(/<[^>]*>/g, ' ').replace(/\{[^{}]*\}/g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length > 0) continue
    /* A `{...}` child that is not an icon probably renders words at runtime,
       which this scan cannot see; those are left alone rather than guessed at. */
    if (/\{/.test(inner) && !/^\s*<svg/.test(inner.trim())) continue
    nameless.push(where(file, m.index!, src))
  }
}
console.log(`        ${buttons} buttons`)
ok(
  nameless.length === 0,
  'no icon-only button without a label',
  nameless.length ? `\n         ${nameless.join('\n         ')}` : 'clean'
)

/* ── 2. Nothing removes the focus ring without replacing it ───────────── */
console.log('\nA KEYBOARD USER CAN SEE WHERE THEY ARE\n')
/* `focus:outline-none` is fine when something else marks focus on the same
   element — in this app that is always a border colour. What is not fine is
   removing the ring and putting nothing back, which is how two inputs on the
   training screen ended up with no focus state at all. */
const bareOutline: string[] = []
let suppressed = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  src.split(/\r?\n/).forEach((line, i) => {
    if (!/focus:outline-none/.test(line)) return
    suppressed++
    if (/focus:border|focus-visible:|focus:ring|focus:bg|focus:shadow/.test(line)) return
    bareOutline.push(`${relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}`)
  })
}
console.log(`        ${suppressed} elements suppress the default ring`)
ok(
  bareOutline.length === 0,
  'each of them marks focus some other way',
  bareOutline.length ? `\n         ${bareOutline.join('\n         ')}` : 'clean'
)
/* The substitute must be full strength. It was brand-blue at 50% opacity,
   which measures 1.92:1 against the field — see verify-contrast. A focus
   indicator at half opacity is a focus indicator nobody can find. */
const faint: string[] = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  src.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(/focus:border-[a-z-]+\/([0-9]+)/g)) {
      if (Number(m[1]) < 100) faint.push(`${relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}  ${m[0]}`)
    }
  })
}
ok(
  faint.length === 0,
  'and none of them is a translucent border',
  faint.length ? `${faint.length}\n         ${faint.slice(0, 8).join('\n         ')}` : 'clean'
)

/* ── 3. Motion stops when the phone asks it to ────────────────────────── */
console.log('\nREDUCED MOTION IS HONOURED\n')
const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'the rule exists at all')
/* A blanket rule, not a list of animation names. The list is what failed:
   it covered `fade-up` and missed `ping`, `pulse`, `bounce`, `marquee` and
   `spin`, because a list only ever covers what existed when it was written. */
ok(/animation-duration:\s*0\.0*1m?s\s*!important/.test(block), 'it kills animation by duration, not by name')
ok(/transition-duration:\s*0\.0*1m?s\s*!important/.test(block), 'and transitions too')
ok(/\*,\s*\*::before,\s*\*::after/.test(block.slice(0, 400)), 'applied to everything, so a new animation is covered the day it is added')
/* The one exception, stated so that nobody "fixes" it later: a spinner that
   stops spinning reads as a frozen app, which is worse than the motion. */
ok(/\.animate-spin\s*\{[^}]*animation:\s*spin/.test(block), 'with the loading spinner deliberately kept, slowed', 'stopped reads as frozen')

console.log(failed === 0 ? '\nAll accessibility checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
