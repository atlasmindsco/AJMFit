/**
 * Whether text can actually be read.
 *
 * WHY THIS EXISTS. A client said some of the words were hard to see. The first
 * answer was to raise the font sizes, which helped and did not fix it, because
 * the sizes were never the whole problem — the colours were. Thirteen
 * hand-picked white alphas and a brand blue chosen for buttons were being used
 * as text on six different near-blacks, and nobody could check any of it
 * because checking it by eye is exactly the thing eyes are bad at. A colour
 * that looks fine on a bright laptop at a desk is not the same colour on a
 * phone at arm's length in a gym with the brightness down.
 *
 * So this is the arithmetic from WCAG 2.1, written out, and
 * tools/verify-contrast.ts runs it over the pairings the product actually
 * uses. The point is not the score. The point is that the next person to pick
 * a colour finds out before a client does.
 *
 * Pure, and deliberately dependency-free: a palette check that needs the app
 * to boot is a check nobody runs.
 */

/** An #RGB or #RRGGBB colour, as the Tailwind config writes them. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/**
 * One channel, un-gamma'd.
 *
 * The 0.03928 branch is not a rounding convenience — sRGB is linear near
 * black and a power curve above it, and skipping the linear part is the
 * classic way to get dark-on-dark pairs wrong by a wide margin, which is
 * precisely the case this product is full of.
 */
function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Relative luminance, 0 for black and 1 for white. */
export function luminance(hex: string): number | null {
  const c = parseHex(hex)
  if (!c) return null
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

/**
 * Composite a translucent colour over what is behind it.
 *
 * Needed because most of this app's text is white at an alpha — `text-white/60`
 * and friends — and "white at 60%" has no contrast ratio of its own. What
 * reaches the eye is the blend, so that is what gets measured.
 */
export function over(fg: string, alpha: number, bg: string): string | null {
  const f = parseHex(fg)
  const b = parseHex(bg)
  if (!f || !b) return null
  const a = Math.min(1, Math.max(0, alpha))
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a))
  const hx = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hx(mix(f.r, b.r))}${hx(mix(f.g, b.g))}${hx(mix(f.b, b.b))}`
}

/** The ratio, 1 for identical colours and 21 for black on white. */
export function ratio(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG's definition of large text, which is narrower than people assume and
 * is where most honest mistakes happen.
 *
 * 24px at any weight, or 18.66px once it is bold — not 18px, and not 14px
 * bold. An uppercase 13px label in a heavy weight still looks substantial and
 * is still small text by this rule, so it needs the full 4.5:1. Several of
 * this app's labels are exactly that.
 */
export function isLargeText(px: number, bold: boolean): boolean {
  return px >= 24 || (bold && px >= 18.66)
}

export type Level = 'AA' | 'AAA' | 'fail'

/** What a pairing passes at the size it is actually set in. */
export function judge(fg: string, bg: string, px: number, bold: boolean): { ratio: number; level: Level } | null {
  const r = ratio(fg, bg)
  if (r === null) return null
  const large = isLargeText(px, bold)
  const aa = large ? 3 : 4.5
  const aaa = large ? 4.5 : 7
  /* Rounded to two places before comparing, because a pairing measuring
     4.4996 is not a defect anybody can see and failing it teaches people to
     ignore the check. Anything genuinely short fails by more than that. */
  const r2 = Math.round(r * 100) / 100
  return { ratio: r2, level: r2 >= aaa ? 'AAA' : r2 >= aa ? 'AA' : 'fail' }
}
