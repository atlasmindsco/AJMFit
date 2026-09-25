/**
 * Generates one cover per split in the blueprint library.
 *
 * Vector, not illustration: these are branded graphic covers, sharp at any
 * size, a couple of KB each, and regenerable the moment a split is renamed or
 * added. They are NOT the cartoon style of the newsletter banner -- that needs
 * an image generator -- but they are designed to sit beside it without
 * clashing, on the same orange/blue diagonal and the same condensed type.
 *
 *   node tools/make-covers.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const lib = JSON.parse(readFileSync(new URL('../program-library/blueprint-library.json', import.meta.url), 'utf8'))

const NAVY = '#1B2D50', BLUE = '#1A7BFF', ORANGE = '#F76B16', DEEP = '#0f1d38'

/** A motif per family. Simple, readable at thumbnail size, drawn not stocked. */
const barbell = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s})" opacity="0.92">
    <rect x="-150" y="-7" width="300" height="14" rx="7" fill="#cfd8e6"/>
    <rect x="-128" y="-34" width="26" height="68" rx="7" fill="#2b3a52"/>
    <rect x="-96" y="-46" width="30" height="92" rx="8" fill="#39495f"/>
    <rect x="66" y="-46" width="30" height="92" rx="8" fill="#39495f"/>
    <rect x="102" y="-34" width="26" height="68" rx="7" fill="#2b3a52"/>
  </g>`
const dumbbell = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s})" opacity="0.92">
    <rect x="-70" y="-7" width="140" height="14" rx="7" fill="#cfd8e6"/>
    <rect x="-104" y="-38" width="34" height="76" rx="9" fill="#39495f"/>
    <rect x="70" y="-38" width="34" height="76" rx="9" fill="#39495f"/>
  </g>`
const runner = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s})" opacity="0.92" fill="none" stroke="#cfd8e6" stroke-width="15" stroke-linecap="round">
    <circle cx="14" cy="-76" r="22" fill="#cfd8e6" stroke="none"/>
    <path d="M-16 6 L26 -34 L66 -10"/>
    <path d="M26 -34 L20 26 L-24 66"/>
    <path d="M20 26 L62 52"/>
    <path d="M-2 -28 L-52 -14"/>
  </g>`
const heart = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s})" opacity="0.92" fill="none" stroke="#cfd8e6" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-140 0 H-74 L-46 -54 L-4 62 L34 -18 L58 0 H140"/>
  </g>`

const motifFor = (key) =>
  key.startsWith('hybrid_strength_run') || key === 'hybrid_athletic' ? runner
  : key.startsWith('hybrid') ? heart
  : key.includes('fullbody') || key.includes('torso') ? dumbbell
  : barbell

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Split the label so the headline breaks somewhere sensible. */
function headline(label) {
  const clean = label.replace(/\s*\(\d+-day\)\s*/i, '').trim()
  const words = clean.split(/\s+/)
  if (clean.length <= 14) return [clean]
  let a = '', b = ''
  for (const w of words) ((a.length + w.length <= Math.ceil(clean.length / 2)) ? (a += (a ? ' ' : '') + w) : (b += (b ? ' ' : '') + w))
  return b ? [a, b] : [a]
}

const FONT = "'Barlow Condensed','Arial Narrow',Haettenschweiler,Impact,sans-serif"

function cover(key, split) {
  const lines = headline(split.label)
  const motif = motifFor(key)
  const big = lines.length > 1 ? 104 : 124
  const top = lines.length > 1 ? 300 : 352
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${esc(split.label)}">
  <defs>
    <linearGradient id="o" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="${ORANGE}"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${DEEP}"/>
    </linearGradient>
    <clipPath id="card"><rect width="1200" height="630" rx="28"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="1200" height="630" fill="url(#b)"/>
    <path d="M0 0 H690 L470 630 H0 Z" fill="url(#o)"/>
    <path d="M690 0 L716 0 L496 630 L470 630 Z" fill="#ffffff" opacity="0.92"/>
    <g opacity="0.14" fill="none" stroke="#fff" stroke-width="2">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${760 + i * 52}" y1="-40" x2="${640 + i * 52}" y2="670"/>`).join('')}
    </g>
    ${motif(905, 300, 1.25)}
    <text x="72" y="${top}" font-family="${FONT}" font-weight="800" font-size="${big}"
          fill="#fff" letter-spacing="-1" style="text-transform:uppercase">
      ${lines.map((l, i) => `<tspan x="72" dy="${i === 0 ? 0 : big * 0.92}">${esc(l.toUpperCase())}</tspan>`).join('')}
    </text>
    <rect x="72" y="${top + big * (lines.length - 1) + 38}" width="${String(split.days_per_week).length * 30 + 196}" height="62" rx="31" fill="${NAVY}" opacity="0.92"/>
    <text x="${72 + (String(split.days_per_week).length * 30 + 196) / 2}" y="${top + big * (lines.length - 1) + 79}"
          font-family="${FONT}" font-weight="700" font-size="34" fill="#fff" text-anchor="middle"
          letter-spacing="3">${split.days_per_week} DAYS / WEEK</text>
    <text x="72" y="96" font-family="${FONT}" font-weight="700" font-size="30" fill="#fff" opacity="0.85" letter-spacing="7">AJM FIT</text>
    ${split.recommended ? `<g transform="translate(1058,86)"><circle r="46" fill="#fff" opacity="0.95"/><text y="-2" font-family="${FONT}" font-weight="800" font-size="24" fill="${ORANGE}" text-anchor="middle">TOP</text><text y="24" font-family="${FONT}" font-weight="700" font-size="20" fill="${NAVY}" text-anchor="middle">PICK</text></g>` : ''}
  </g>
</svg>`
}

let n = 0
for (const [key, split] of Object.entries(lib.splits)) {
  writeFileSync(new URL(`../public/covers/${key}.svg`, import.meta.url), cover(key, split))
  n++
}
console.log(`wrote ${n} covers to public/covers/`)
