/**
 * Every tier promise must be backed by something.
 *
 * TIER_EXPERIENCE is shown to paying clients, and three of its Full
 * Experience bullets described behaviour that did not exist — a mid-week
 * pulse nothing sent, a four-week rebuild contradicted by eight-week blocks,
 * a monthly review nothing produced. Each had a flag in the interface and
 * zero consumers in the codebase, which is a shape a test can catch.
 *
 * So: every field declared on TierExperience must be read somewhere outside
 * the file that declares it. A flag with no consumer is a promise with no
 * mechanism, and that is how a client ends up paying for something the
 * product does not do.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TIER_EXPERIENCE, isCoached } from '../lib/tiers.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 52), detail)
}

/* Every .ts/.tsx under the app, minus the file that declares the promises. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !full.endsWith(join('lib', 'tiers.ts'))) out.push(full)
  }
  return out
}

const files = ['app', 'lib', 'components'].flatMap((d) => sources(d))
const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n')

console.log('EVERY DECLARED PROMISE IS READ SOMEWHERE\n')
{
  // The structural fields — the ones that claim the product behaves a certain
  // way. `includes` and `headline` are prose and are checked separately.
  const fields = ['responseHours', 'weeklyCheckIn', 'coachInitiates', 'programReview']
  for (const field of fields) {
    const used = corpus.includes(field)
    g(`${field} has a consumer`, used, used ? '' : 'declared but nothing reads it')
  }

  // The flag that caused this: it must not come back without a mechanism.
  const declared = Object.keys(TIER_EXPERIENCE.blueprint)
  g('midWeekPulse is gone', !declared.includes('midWeekPulse'), 'nothing ever sent one')
}

console.log('\nTHE TIERS DIFFER IN WAYS THE PRODUCT ENFORCES\n')
{
  const bp = TIER_EXPERIENCE.blueprint
  const ac = TIER_EXPERIENCE.accelerator
  const fe = TIER_EXPERIENCE['full-experience']

  g('blueprint promises no reply window', bp.responseHours === null, 'self-guided')
  g('accelerator does', ac.responseHours !== null, `${ac.responseHours}h`)
  g('full experience is faster', (fe.responseHours ?? 99) < (ac.responseHours ?? 99), `${fe.responseHours}h vs ${ac.responseHours}h`)

  g('only coached tiers check in', !bp.weeklyCheckIn && ac.weeklyCheckIn && fe.weeklyCheckIn)
  g('isCoached agrees', !isCoached('blueprint') && isCoached('accelerator') && isCoached('full-experience'))

  // The difference clients pay the most for: not waiting to be noticed.
  g('only full experience moves first', !bp.coachInitiates && !ac.coachInitiates && fe.coachInitiates)
}

console.log('\nTHE PROSE CLAIMS NOTHING THE PRODUCT CONTRADICTS\n')
{
  const all = Object.entries(TIER_EXPERIENCE)
  for (const [name, t] of all) {
    g(`${name} says something`, t.includes.length >= 3 && Boolean(t.headline.trim()), `${t.includes.length} bullets`)
  }

  // Each of these was a real bullet that no code backed. If one returns, it
  // needs a mechanism first — see the note at the top of lib/tiers.ts.
  const retired = ['mid-week', 'midweek', 'four weeks', 'monthly written', 'rebuilt every']
  const offenders: string[] = []
  for (const [name, t] of all) {
    for (const line of [...t.includes, t.headline, t.programReview]) {
      for (const phrase of retired) {
        if (line.toLowerCase().includes(phrase)) offenders.push(`${name}: "${line}"`)
      }
    }
  }
  g('no retired promise has returned', offenders.length === 0, offenders[0] ?? '')

  // Blocks are eight weeks. A tier claiming a different cadence contradicts
  // the schema default and the library the programs were written for.
  const weeksClaim = all.filter(([, t]) =>
    /\b(four|4|six|6)[- ]week/i.test([...t.includes, t.programReview].join(' '))
  )
  g('nobody claims a block length we do not run', weeksClaim.length === 0, weeksClaim.map(([n]) => n).join(', '))

  // Every tier must be distinguishable, or the pricing is a fiction.
  const texts = all.map(([, t]) => t.includes.join('|'))
  g('every tier reads differently', new Set(texts).size === texts.length)
}

console.log(fail === 0 ? '\nAll tier promise checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
