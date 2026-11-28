/**
 * Can the words be read.
 *
 * A client said some of the text was hard to see. The first fix raised the
 * font sizes — 2xs from 11 to 12, xs from 13 to 14, then a whole role scale
 * with a 13px floor — and it helped and did not finish the job, because half
 * the problem was never the size. A colour picked for a button and then used
 * as a caption is short of contrast at any size, and no amount of enlarging
 * repairs it.
 *
 * This checks the pairings the product actually uses, at the sizes it
 * actually sets them, against WCAG 2.1 AA. Two things make it worth having
 * rather than an afterthought:
 *
 *   - It measures the BLEND for translucent text. Most of the studio's text
 *     is white at an alpha over a near-black, and "white at 50%" has no
 *     ratio of its own.
 *   - It uses WCAG's real definition of large text (24px, or 18.66px bold),
 *     not the one people assume. A 13px uppercase label in an extra-bold
 *     weight looks substantial and is small text, so it owes the full 4.5:1.
 *     Several of this app's labels are exactly that, and they are the ones
 *     that were failing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { judge, over, ratio, isLargeText, parseHex, luminance } from '@/lib/contrast'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

/* The surfaces text sits on. Three dark ones in the client studio and the
   trainer portal; two light ones on the marketing site. */
const BASE = '#111111'
const RAISED = '#1C1C1C'
const OVERLAY = '#1A1A1A'
const WHITE = '#FFFFFF'
const OFFWHITE = '#F4F6F9'

const BLUE = '#1A7BFF'
const BLUEINK = '#4D9AFF'
const ORANGE = '#F76B16'
const GOLD = '#D4AF37'
const SUCCESS = '#22C55E'
const WARNING = '#F59E0B'
const DANGER = '#EF4444'
const NAVY = '#1B2D50'

console.log('THE ARITHMETIC ITSELF\n')
/* Pinned against values anybody can check against a published calculator,
   because every assertion below is only as good as this. */
ok(ratio('#000000', '#FFFFFF') === 21, 'black on white is 21:1', String(ratio('#000000', '#FFFFFF')))
ok(ratio('#FFFFFF', '#FFFFFF') === 1, 'a colour on itself is 1:1')
ok(Math.abs(ratio('#777777', '#FFFFFF')! - 4.48) < 0.01, 'mid grey on white is 4.48:1', ratio('#777777', '#FFFFFF')!.toFixed(2))
ok(luminance('#FFFFFF') === 1, 'white has luminance 1')
ok(luminance('#000000') === 0, 'black has luminance 0')
ok(parseHex('#abc') !== null && parseHex('#AABBCC')!.r === parseHex('#abc')!.r, 'three-digit hex expands')
ok(parseHex('nonsense') === null && ratio('nonsense', '#fff') === null, 'and junk returns null rather than a number')

console.log('\nWCAG LARGE TEXT IS SMALLER THAN PEOPLE THINK\n')
ok(isLargeText(24, false), '24px regular is large')
ok(isLargeText(19, true), '19px bold is large')
ok(!isLargeText(18, true), 'but 18px bold is not', 'the line is 18.66')
ok(!isLargeText(17, false), 'body text is not large')
ok(!isLargeText(13, true), 'and a 13px bold uppercase label is small text, however heavy it looks')

console.log('\nTHE INK SCALE, WHICH IS MOST OF THE TEXT IN THE PRODUCT\n')
/* The four tiers from app/globals.css, measured as the blend that actually
   reaches the eye. ink-4 is the floor and is used for captions at 13px, so
   it is checked at 13px — the hardest case it is put to. */
for (const [name, alpha] of [['ink', 0.95], ['ink-2', 0.78], ['ink-3', 0.62], ['ink-4', 0.5]] as Array<[string, number]>) {
  for (const [sname, surface] of [['base', BASE], ['raised', RAISED], ['overlay', OVERLAY]] as Array<[string, string]>) {
    const blend = over(WHITE, alpha, surface)!
    const v = judge(blend, surface, 13, true)!
    ok(v.level !== 'fail', `${name} on ${sname} at 13px`, `${v.ratio}:1 ${v.level}`)
  }
}

console.log('\nTHE COLOUR THAT WAS ACTUALLY FAILING\n')
/* This is the finding, and it is narrower than it first looked — which is the
   argument for measuring rather than eyeballing.
   Brand blue as small text clears AA on the darkest surface, #111, by a
   whisker (4.78:1), and fails on BOTH of the raised ones (4.32 and 4.41). The
   studio's cards are raised surfaces, so nearly every blue caption, "Today"
   eyebrow and blue link in the client app sat on one of the two that fail. A
   colour that is only legible on one of three surfaces is not a text colour,
   so the swap is to brand-blueink everywhere rather than per-surface
   cherry-picking nobody could maintain. */
ok(judge(BLUE, BASE, 13, true)!.level !== 'fail', 'brand-blue scrapes AA on #111', `${judge(BLUE, BASE, 13, true)!.ratio}:1 — and only there`)
for (const [sname, surface] of [['raised #1C1C1C', RAISED], ['overlay #1A1A1A', OVERLAY]] as Array<[string, string]>) {
  const bad = judge(BLUE, surface, 13, true)!
  ok(bad.level === 'fail', `brand-blue as small text on ${sname} fails, as documented`, `${bad.ratio}:1`)
}
for (const [sname, surface] of [['base', BASE], ['raised', RAISED], ['overlay', OVERLAY]] as Array<[string, string]>) {
  const good = judge(BLUEINK, surface, 13, true)!
  ok(good.level !== 'fail', `brand-blueink clears it on ${sname}`, `${good.ratio}:1 ${good.level}`)
}

console.log('\nTHE PRIMARY BUTTON, WHICH IS A SEPARATE AND LARGER PROBLEM\n')
/* WHITE ON THE BRAND BLUE FILL IS 3.95:1. Not fixed here, and not hidden.
   That is the most-clicked element in the product — Start, Log Set, Save,
   Share, the marketing CTA — and at the sizes it is actually set in, it
   passes only because of how WCAG defines large text:

     16px bold (`text-base`, the Start button)  → small text, needs 4.5 → FAILS
     20px bold (`text-heading`, Share and Done) → large text, needs 3.0 → passes

   So the same button component is compliant or not depending on which size
   class it was given, which is not a thing anyone can be expected to track.
   The fix is one line — make the fill #0F5FE0, the shade already in the
   palette as `bluedark`, which takes white to 5.63:1 — but it changes the
   colour of the primary button on every screen including the marketing site,
   and that is a brand decision rather than a code one. It is in the report,
   with the numbers.
   These assertions pin the problem so it cannot quietly drift further, and
   will need updating the day the fill changes. */
ok(judge(WHITE, BLUE, 16, true)!.level === 'fail', 'white on brand-blue at 16px bold fails AA', `${judge(WHITE, BLUE, 16, true)!.ratio}:1 — needs 4.5`)
ok(judge(WHITE, BLUE, 20, true)!.level !== 'fail', 'and passes at 20px bold only because that counts as large', `${judge(WHITE, BLUE, 20, true)!.ratio}:1 — needs 3.0`)
ok(judge(WHITE, '#0F5FE0', 16, true)!.level !== 'fail', 'the one-line fix, for the record: white on brand-bluedark', `${judge(WHITE, '#0F5FE0', 16, true)!.ratio}:1`)

console.log('\nTHE SEMANTIC COLOURS, AS TEXT ON THE STUDIO SURFACES\n')
for (const [name, hex] of [
  ['state-success', SUCCESS],
  ['state-warning', WARNING],
  ['state-gold', GOLD],
  ['state-danger', DANGER],
  ['brand-orange', ORANGE],
  ['brand-blueink', BLUEINK],
] as Array<[string, string]>) {
  for (const [sname, surface] of [['base', BASE], ['raised', RAISED]] as Array<[string, string]>) {
    const v = judge(hex, surface, 13, true)!
    ok(v.level !== 'fail', `${name} on ${sname} at 13px`, `${v.ratio}:1 ${v.level}`)
  }
}

console.log('\nAND AS A FILL WITH DARK TEXT ON TOP\n')
/* The PR bar and the share card's achievement row are gold with the near-black
   background colour written on them, which is the one place this product puts
   dark text on a bright fill. */
ok(judge(BASE, GOLD, 20, true)!.level !== 'fail', 'surface-base on the gold PR bar', `${judge(BASE, GOLD, 20, true)!.ratio}:1`)
ok(judge('#0C0F14', GOLD, 50, true)!.level !== 'fail', 'and on the share card, which uses its own near-black', `${judge('#0C0F14', GOLD, 50, true)!.ratio}:1`)
/* And the one that was genuinely invisible. The week list marks a finished day
   with a tick inside a solid green circle, and the tick was white: 2.28:1,
   under even the 3:1 that WCAG asks of a graphic carrying meaning — and that
   tick is the only thing on the row saying the day is done. It is now the
   near-black, at 8.29:1. Nobody would have caught this looking at it; on a
   bright screen a white tick on #22C55E looks crisp. */
ok(judge(WHITE, SUCCESS, 13, true)!.level === 'fail', 'white on solid green fails, which is why the tick is not white', `${judge(WHITE, SUCCESS, 13, true)!.ratio}:1`)
ok(judge(BASE, SUCCESS, 13, true)!.level !== 'fail', 'and the dark tick clears it', `${judge(BASE, SUCCESS, 13, true)!.ratio}:1`)

console.log('\nTHE INTENSITY TECHNIQUES ARE A CATEGORICAL SCALE\n')
/* Three choices of equal standing, where colour's only job is to tell them
   apart. They were stock red-500, purple-500 and amber-500 written inline,
   which is how two of the three came to be the exact values this product uses
   for danger and warning. They are declared as their own scale now so the
   collision is in the palette rather than in three string literals.
   The collision itself is not fixed here and is in the report — recolouring a
   badge a client recognises is a product decision, not a tidy-up. */
const T_DROP = '#EF4444'
const T_RESTPAUSE = '#C084FC'
const T_PARTIAL = '#F59E0B'
for (const [name, hex] of [['drop', T_DROP], ['restpause', T_RESTPAUSE], ['partial', T_PARTIAL]] as Array<[string, string]>) {
  for (const [sname, surface] of [['base', BASE], ['raised', RAISED]] as Array<[string, string]>) {
    const v = judge(hex, surface, 13, true)!
    ok(v.level !== 'fail', `technique-${name} on ${sname} at 13px`, `${v.ratio}:1 ${v.level}`)
  }
}
/* Stated as assertions so nobody has to take the comment's word for it, and so
   that the day somebody recolours one of them this check turns red and sends
   them to the note above. */
ok(T_DROP === DANGER, 'technique-drop is the SAME VALUE as state-danger', 'a drop set is drawn in the colour of a failure')
ok(T_PARTIAL === WARNING, 'technique-partial is the SAME VALUE as state-warning', 'partials are drawn in the colour of a sync warning')
ok(T_RESTPAUSE !== DANGER && T_RESTPAUSE !== WARNING && T_RESTPAUSE !== SUCCESS, 'only rest-pause has a hue of its own')

console.log('\nTHE SHARE CARD, WHICH IS THE ONE IMAGE THAT LEAVES THE PRODUCT\n')
/* It gets its own section because it gets looked at under the worst conditions
   this app has to survive: inside somebody else's Instagram story, on a
   stranger's phone, at whatever brightness they happen to have it on, for
   about two seconds. Its palette is written out in components/studio/
   ShareSheet.tsx because a canvas cannot read a CSS token, which means it can
   drift away from the app's own colours without anything noticing. */
const CARDBG = '#0C0F14'
const CARDGREY = '#9AA6B8'
ok(judge(WHITE, CARDBG, 72, true)!.level === 'AAA', 'the heading', `${judge(WHITE, CARDBG, 72, true)!.ratio}:1`)
ok(judge(WHITE, CARDBG, 150, true)!.level === 'AAA', 'the hero volume figure', `${judge(WHITE, CARDBG, 150, true)!.ratio}:1`)
ok(judge(ORANGE, CARDBG, 34, true)!.level !== 'fail', 'its orange TOTAL VOLUME label', `${judge(ORANGE, CARDBG, 34, true)!.ratio}:1`)
ok(judge(CARDGREY, CARDBG, 30, false)!.level !== 'fail', 'the grey tile labels', `${judge(CARDGREY, CARDBG, 30, false)!.ratio}:1`)
ok(judge(CARDGREY, CARDBG, 34, false)!.level !== 'fail', 'and the ajmfit.com footer', `${judge(CARDGREY, CARDBG, 34, false)!.ratio}:1`)

console.log('\nWHAT IS STILL SHORT, STATED RATHER THAN HIDDEN\n')
/* Honesty about the marketing site. Brand blue on white is 3.95:1, which
   clears AA only at 24px, or 18.66px bold — headings and the big CTA, which is
   where it is used. It is NOT safe for a sentence or a small link on white,
   and that is a real limit of the brand palette rather than something this
   sweep quietly fixed. Recorded as a passing assertion of the limit so it
   cannot be forgotten, and so that anyone who lightens the marketing blue has
   to come here and say so. */
const onWhite = judge(BLUE, WHITE, 17, false)!
ok(onWhite.level === 'fail', 'brand-blue as body text on white fails AA', `${onWhite.ratio}:1 — headings only`)
ok(judge(BLUE, WHITE, 28, true)!.level !== 'fail', 'and clears it as a heading', `${judge(BLUE, WHITE, 28, true)!.ratio}:1`)
ok(judge(NAVY, WHITE, 17, false)!.level === 'AAA', 'body copy on the marketing site is navy, which is AAA', `${judge(NAVY, WHITE, 17, false)!.ratio}:1`)
ok(judge(NAVY, OFFWHITE, 17, false)!.level === 'AAA', 'including on the off-white sections', `${judge(NAVY, OFFWHITE, 17, false)!.ratio}:1`)

console.log('\nNO BLUE TEXT LEFT ON A DARK SURFACE IN THE CLIENT APP\n')
/* The sweep itself. The studio and the trainer portal are dark throughout, so
   `text-brand-blue` there is the failing pairing above by definition. This
   reads the files rather than trusting that the edit was complete. */

const walk = (dir: string): string[] => {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx$/.test(p)) out.push(p)
  }
  return out
}

/* Dark-surfaced areas only. The marketing site under app/(site) is light and
   is covered by the stated limit above. */
const darkRoots = ['app/studio', 'app/luffy', 'components/studio', 'components/admin']
const offenders: string[] = []
for (const root of darkRoots) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8')
    src.split('\n').forEach((line, i) => {
      // `text-brand-blue` exactly: not text-brand-bluedark, not blueink.
      if (/\btext-brand-blue(?![a-z-])/.test(line)) offenders.push(`${file}:${i + 1}`)
    })
  }
}
ok(offenders.length === 0, 'none in the studio, the portal or their components', offenders.slice(0, 12).join('  ') || 'clean')

console.log('\nAND NO STOCK TAILWIND STATUS COLOURS ON THE DARK SCREENS\n')
/* `text-emerald-400` and `text-state-success` look the same on a screen and
   are not the same thing: one is a colour, the other is a meaning. Twenty-eight
   of them were spread across the studio and the portal, so "green" was
   emerald-400 in one file, green-500 in another and the token in a third — and
   changing what success looks like meant finding all three.
   Scoped to the DARK screens on purpose. The nutrition screens and the coach
   brief are still light-themed inside a dark app, and their emerald-700 on
   white is a legitimate choice for that surface that the token would break:
   #22C55E on white is 2.28:1. That whole situation is in the report; it is a
   theme problem rather than a palette one and is not something a sweep should
   quietly half-do. */
const LIGHT_SCREENS = [
  'app/studio/nutrition',
  'app/studio/setup-nutrition',
  'app/luffy/brief',
  'components/studio/CoachNutritionOverride',
  'components/studio/FoodSearchSheet',
]
const stock: string[] = []
for (const root of darkRoots) {
  for (const file of walk(root)) {
    const rel = file.replace(/\\/g, '/')
    if (LIGHT_SCREENS.some((l) => rel.startsWith(l))) continue
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\b(?:text|bg|border|ring|fill|stroke)-(?:emerald|green|lime|amber|yellow|red|rose)-[0-9]{3}\b/g)) {
        stock.push(`${rel}:${i + 1}  ${m[0]}`)
      }
    })
  }
}
ok(stock.length === 0, 'success, warning and danger are tokens there, not hues', stock.slice(0, 12).join('  ') || 'clean')

console.log(failed === 0 ? '\nAll contrast checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
