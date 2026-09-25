/**
 * Generates one cartoon cover per split in the blueprint library.
 *
 * Built to sit beside the AJM Fit newsletter banner rather than merely avoid
 * clashing with it, so it copies that image's actual cartoon devices: heavy
 * black outlines on every shape, a radial speed burst behind the subject,
 * halftone dots over the blue half, cel-shaded highlights on the metal, and
 * display type in white with a thick black outline and a hard offset shadow.
 *
 * Subjects are equipment and a flexing arm, drawn as bold chunky shapes. A
 * whole cartoon figure hand-written as path data lands in the uncanny valley;
 * chunky props carry the same energy and still read at 300px wide on a phone.
 *
 *   node tools/make-covers.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const lib = JSON.parse(
  readFileSync(new URL('../program-library/blueprint-library.json', import.meta.url), 'utf8')
)

const INK = '#141b2d' // outline black, warmer than pure black
const ORANGE = '#F76B16'
const ORANGE_LT = '#FFA24D'
const BLUE = '#1A7BFF'
const BLUE_DK = '#0f2a5c'
const STEEL = '#8FA3BF'
const STEEL_LT = '#D8E3F0'
const STEEL_DK = '#43536e'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const O = (w = 9) =>
  `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

/* -- Cartoon props -------------------------------------------------------- */

const plate = (cx, r) => `
  <ellipse cx="${cx}" cy="0" rx="${r * 0.42}" ry="${r}" fill="${STEEL_DK}" ${O()}/>
  <ellipse cx="${cx - r * 0.1}" cy="0" rx="${r * 0.3}" ry="${r * 0.86}" fill="${STEEL}" ${O(6)}/>
  <path d="M${cx - r * 0.24} ${-r * 0.52} q ${r * 0.18} ${r * 0.5} 0 ${r * 1.04}"
        fill="none" stroke="${STEEL_LT}" stroke-width="7" stroke-linecap="round" opacity="0.95"/>`

/**
 * Sized to stay inside the blue field.
 *
 * At its first width the bar ran from x=456 to x=1324 on a 1200-wide canvas:
 * the left plate sat on top of the orange panel and the right one was sliced
 * off by the card edge. Short enough to clear the diagonal is worth more than
 * an extra plate nobody can see.
 */
const barbell = `
  <g transform="rotate(-8)">
    <rect x="-252" y="-12" width="504" height="24" rx="12" fill="${STEEL}" ${O()}/>
    <rect x="-226" y="-7" width="452" height="6" rx="3" fill="${STEEL_LT}" opacity="0.9"/>
    ${plate(-196, 66)}${plate(-152, 92)}${plate(196, 66)}${plate(152, 92)}
  </g>`

const dumbbells = `
  <g>
    <g transform="translate(-150,-40) rotate(-14)">
      <rect x="-78" y="-13" width="156" height="26" rx="13" fill="${STEEL}" ${O()}/>
      ${plate(-92, 62)}${plate(92, 62)}
    </g>
    <g transform="translate(160,60) rotate(12)">
      <rect x="-78" y="-13" width="156" height="26" rx="13" fill="${STEEL}" ${O()}/>
      ${plate(-92, 62)}${plate(92, 62)}
    </g>
  </g>`

/**
 * A stack of loaded plates.
 *
 * This slot first held a hand-drawn flexing arm. Rendered, it read as a pink
 * worm -- the exact uncanny-valley failure that hand-writing anatomy as path
 * data invites. Plates are unmistakable at any size and need no anatomy.
 */
const plateStack = `
  <g transform="translate(0,20)">
    ${[0, 1, 2]
      .map((i) => {
        const y = 70 - i * 78
        const r = 132 - i * 20
        return `<g transform="translate(${i * 14 - 14},${y})">
        <ellipse cx="0" cy="26" rx="${r}" ry="${r * 0.3}" fill="${STEEL_DK}" ${O()}/>
        <rect x="${-r}" y="-16" width="${r * 2}" height="42" fill="${STEEL_DK}" ${O(0)}/>
        <ellipse cx="0" cy="-16" rx="${r}" ry="${r * 0.3}" fill="${STEEL}" ${O()}/>
        <ellipse cx="0" cy="-16" rx="${r * 0.26}" ry="${r * 0.08}" fill="${STEEL_DK}" ${O(5)}/>
        <path d="M${-r * 0.72} -26 q ${r * 0.5} -16 ${r * 0.96} -2"
              fill="none" stroke="${STEEL_LT}" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
      </g>`
      })
      .join('')}
  </g>`

/** A stopwatch. Round, high-contrast, and instantly legible as "time / pace". */
const stopwatch = `
  <g transform="translate(0,14)">
    <rect x="-34" y="-212" width="68" height="46" rx="14" fill="${STEEL_DK}" ${O()}/>
    <rect x="-70" y="-178" width="140" height="34" rx="16" fill="${STEEL}" ${O()}/>
    <g transform="translate(150,-150) rotate(38)">
      <rect x="-22" y="-30" width="44" height="60" rx="14" fill="${STEEL}" ${O()}/>
    </g>
    <circle r="168" fill="${STEEL_DK}" ${O(11)}/>
    <circle r="142" fill="#fff" ${O()}/>
    <g stroke="${INK}" stroke-width="9" stroke-linecap="round">
      <path d="M0 -118 V-92"/><path d="M0 118 V92"/><path d="M-118 0 H-92"/><path d="M118 0 H92"/>
    </g>
    <g stroke="${STEEL}" stroke-width="6" stroke-linecap="round" opacity="0.85">
      <path d="M84 -84 L68 -68"/><path d="M-84 84 L-68 68"/>
      <path d="M-84 -84 L-68 -68"/><path d="M84 84 L68 68"/>
    </g>
    <path d="M0 14 V-104" stroke="${ORANGE}" stroke-width="16" stroke-linecap="round"/>
    <path d="M0 10 L74 58" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
    <circle r="17" fill="${ORANGE}" ${O(8)}/>
  </g>`

/**
 * Bell body, open handle.
 *
 * The first attempt had a near-closed handle sitting on a squared-off body and
 * rendered as a padlock. A kettlebell is only legible when there is daylight
 * under the handle and the body is clearly widest at the bottom.
 */
const kettlebell = `
  <g transform="translate(0,-24)">
    <path d="M-74 -56 a74 74 0 0 1 148 0" fill="none" ${O(46)}/>
    <path d="M-74 -56 a74 74 0 0 1 148 0" fill="none" stroke="${STEEL}" stroke-width="30"/>
    <path d="M-58 -46 C-96 14 -134 44 -134 100 C-134 150 -70 168 0 168
             C70 168 134 150 134 100 C134 44 96 14 58 -46 C20 -30 -20 -30 -58 -46 Z"
          fill="${STEEL_DK}" ${O()}/>
    <path d="M-44 -14 C-78 30 -104 58 -104 100 C-104 132 -60 144 -16 144
             C-28 74 -44 24 -44 -14 Z" fill="${STEEL}" opacity="0.9"/>
    <path d="M-72 46 q-18 34 -4 62" fill="none" stroke="${STEEL_LT}" stroke-width="13" stroke-linecap="round"/>
  </g>`

/**
 * Which prop belongs to which family.
 *
 * Every one of these was rendered and looked at before it was kept. A running
 * shoe and a flexing arm were both drawn first and both cut: at cover size the
 * shoe read as a white wedge and the arm read as a worm. Silhouettes that
 * survive being 300px wide are simple and geometric, which is why what is left
 * is discs, bars and a circle.
 */
const motifFor = (key) =>
  key === 'hybrid_strength_run' || key === 'hybrid_athletic' || key === 'hybrid_complete'
    ? stopwatch
    : key === 'hybrid_hyper_cond' || key === 'hybrid_strength_endurance'
      ? kettlebell
      : key === '5day_bro' || key === '6day_ppl_arnold'
        ? plateStack
        : key.includes('fullbody') || key.includes('torso')
          ? dumbbells
          : barbell

/* -- Layout --------------------------------------------------------------- */

function headline(label) {
  const clean = label.replace(/\s*\(\d+-day\)\s*/i, '').replace(/\s*x2\s*/i, ' ').trim()
  const words = clean.split(/\s*\/\s*|\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 11 && cur) {
      lines.push(cur)
      cur = w
    } else cur = (cur ? cur + ' ' : '') + w
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

const FONT = "'Barlow Condensed','Arial Narrow',Haettenschweiler,Impact,sans-serif"

function cover(key, split) {
  const lines = headline(split.label)
  // Sized to the longest LINE, not the line count. Going by count alone let
  // "TORSO LIMBS" run at 118px and clip the white diagonal, because one long
  // line is wider than two short ones.
  const longest = Math.max(...lines.map((l) => l.length))
  const byCount = lines.length >= 3 ? 82 : lines.length === 2 ? 100 : 118
  const byWidth = Math.floor(560 / (longest * 0.46)) // 560px of usable orange
  const size = Math.max(70, Math.min(byCount, byWidth))
  const lh = size * 0.88
  const startY = 312 - ((lines.length - 1) * lh) / 2

  const burst = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2
    const r1 = 150
    const r2 = 470 + (i % 3) * 70
    const p = (ang, r) => `${(Math.cos(ang) * r).toFixed(1)} ${(Math.sin(ang) * r).toFixed(1)}`
    return `<path d="M${p(a, r1)} L${p(a + 0.055, r2)} L${p(a - 0.055, r2)} Z" fill="#fff" opacity="0.13"/>`
  }).join('')

  const tspans = lines
    .map((l, i) => `<tspan x="70" dy="${i === 0 ? 0 : lh}">${esc(l.toUpperCase())}</tspan>`)
    .join('')

  const badgeY = startY + (lines.length - 1) * lh + 46

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${esc(split.label)}">
  <defs>
    <linearGradient id="o" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${ORANGE_LT}"/><stop offset="1" stop-color="${ORANGE}"/>
    </linearGradient>
    <linearGradient id="b" x1="0.2" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${BLUE_DK}"/>
    </linearGradient>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="5" r="3.4" fill="#fff" opacity="0.16"/>
    </pattern>
    <clipPath id="card"><rect width="1200" height="630" rx="30"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="1200" height="630" fill="url(#b)"/>
    <rect width="1200" height="630" fill="url(#dots)"/>
    <g transform="translate(880,300)">${burst}</g>

    <path d="M0 0 H700 L474 630 H0 Z" fill="url(#o)"/>
    <path d="M700 0 L474 630" fill="none" ${O(11)}/>
    <path d="M726 0 L500 630 L546 630 L772 0 Z" fill="#fff" ${O(7)}/>

    <g transform="translate(890,300)">${motifFor(key)}</g>

    <g font-family="${FONT}" font-weight="800" font-size="${size}" letter-spacing="-1">
      <text x="70" y="${startY}" fill="${INK}" transform="translate(7,8)">${tspans}</text>
      <text x="70" y="${startY}" fill="#fff" stroke="${INK}" stroke-width="15"
            stroke-linejoin="round" paint-order="stroke">${tspans}</text>
    </g>

    <g transform="translate(70,${badgeY})">
      <rect width="290" height="72" rx="36" fill="${INK}"/>
      <rect x="5" y="5" width="280" height="62" rx="31" fill="${ORANGE}"/>
      <text x="145" y="48" font-family="${FONT}" font-weight="800" font-size="38" fill="#fff"
            text-anchor="middle" letter-spacing="2">${split.days_per_week} DAYS / WEEK</text>
    </g>

    <text x="70" y="100" font-family="${FONT}" font-weight="800" font-size="34" fill="#fff"
          letter-spacing="8" stroke="${INK}" stroke-width="6" paint-order="stroke"
          stroke-linejoin="round">AJM FIT</text>

    ${
      split.recommended
        ? `<g transform="translate(1062,92) rotate(-12)">
      <circle r="56" fill="${INK}"/><circle r="50" fill="#FFD34D"/>
      <text y="-4" font-family="${FONT}" font-weight="800" font-size="27" fill="${INK}" text-anchor="middle">TOP</text>
      <text y="26" font-family="${FONT}" font-weight="800" font-size="24" fill="${INK}" text-anchor="middle">PICK</text>
    </g>`
        : ''
    }

    <rect x="4" y="4" width="1192" height="622" rx="28" fill="none" ${O(9)}/>
  </g>
</svg>`
}

let n = 0
for (const [key, split] of Object.entries(lib.splits)) {
  writeFileSync(new URL(`../public/covers/${key}.svg`, import.meta.url), cover(key, split))
  n++
}
console.log(`wrote ${n} cartoon covers to public/covers/`)
