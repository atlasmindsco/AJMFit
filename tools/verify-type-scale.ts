/**
 * The type scale, enforced instead of described.
 *
 * tailwind.config.ts has carried a comment since October saying "11px is
 * below what anyone should have to read on a phone; 12px is the practical
 * minimum". At the time it was written there were already twenty-one
 * `text-[9px]` labels in the product, and one at 6px. A rule nothing checks
 * is a preference, and the PR badge on the workout screen — 9px with a 10px
 * trophy — is what a preference looks like after a year.
 *
 * So this is a source scan rather than a function test. It reads what the
 * components actually say and fails the build on:
 *
 *   1. Any arbitrary pixel font size. The scale has a name for every job;
 *      reaching past it is how the three-pixel band happened.
 *   2. Any tap target declared smaller than 44px by an explicit h-[Npx].
 *
 * It deliberately does NOT fail on the legacy named steps (2xs, xs, sm).
 * Those are 433 usages migrating screen by screen through the audit's
 * phases 4 and 7, and a check that is red for weeks is a check people learn
 * to run with --force.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DIRS = ['app', 'components', 'lib']

/** Below this, text is not for reading. See the role scale in the config. */
const FLOOR_PX = 13
/** Platform minimum hit area. */
const TAP_PX = 44

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full)
  }
  return out
}

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const files: string[] = []
for (const d of DIRS) {
  try {
    walk(join(ROOT, d), files)
  } catch {
    // A directory that is not there is not a failure.
  }
}

console.log(`SCANNING ${files.length} FILES\n`)

/* ── 1. No arbitrary pixel font sizes ─────────────────────────────────── */
const sizeHits: string[] = []
const tapHits: string[] = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  lines.forEach((line, i) => {
    const where = `${relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}`

    for (const m of line.matchAll(/text-\[([0-9.]+)px\]/g)) {
      sizeHits.push(`${where}  text-[${m[1]}px]`)
    }

    /* An explicit height below the tap minimum on something that is clearly
       a control. Only h-[Npx] — the numeric scale (h-8, h-10) is left alone
       because it is used for plenty that is not tappable, and a scan that
       guesses would be noise. */
    for (const m of line.matchAll(/\bh-\[([0-9.]+)px\]/g)) {
      const px = Number(m[1])
      if (px > 0 && px < TAP_PX && /onClick|<button|role="button"/.test(line)) {
        tapHits.push(`${where}  h-[${m[1]}px] on a control`)
      }
    }
  })
}

console.log('NO ARBITRARY PIXEL FONT SIZES\n')
console.log(`        the scale has a name for every job: metric title heading body label caption badge`)
ok(sizeHits.length === 0, 'nothing reaches past the scale', sizeHits.length ? `\n         ${sizeHits.join('\n         ')}` : 'clean')

console.log('\nNO CONTROL DECLARES ITSELF SMALLER THAN A THUMB\n')
ok(tapHits.length === 0, `no explicit height under ${TAP_PX}px on a control`, tapHits.length ? `\n         ${tapHits.join('\n         ')}` : 'clean')

/* ── 2. The config still says what this file assumes ──────────────────── */
console.log('\nTHE SCALE ITSELF\n')
const config = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8')
const steps: Array<[string, string]> = [
  ['metric', '2rem'],
  ['title', '1.5rem'],
  ['heading', '1.25rem'],
  ['body', '1.0625rem'],
  ['label', '0.9375rem'],
  ['caption', '0.8125rem'],
  ['badge', '0.8125rem'],
]
for (const [name, rem] of steps) {
  const re = new RegExp(`${name}:\\s*\\['${rem.replace('.', '\\.')}'`)
  ok(re.test(config), `${name} is ${rem} (${Math.round(parseFloat(rem) * 16)}px)`)
}
ok(
  /caption: \['0\.8125rem'/.test(config),
  `the floor is ${FLOOR_PX}px and caption sits on it`
)

/* The gap rule. Two steps within 2px cannot express hierarchy — that is the
   whole diagnosis behind this scale, and it would be quietly undone by
   somebody "just nudging" one of them. */
console.log('\nEVERY STEP IS AT LEAST 2px FROM THE NEXT\n')
const px = steps.filter(([n]) => n !== 'badge').map(([n, r]) => [n, Math.round(parseFloat(r) * 16)] as [string, number])
for (let i = 0; i < px.length - 1; i++) {
  const gap = px[i][1] - px[i + 1][1]
  ok(gap >= 2, `${px[i][0]} (${px[i][1]}px) → ${px[i + 1][0]} (${px[i + 1][1]}px)`, `${gap}px apart`)
}

console.log(
  failed === 0 ? '\nAll type-scale checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
