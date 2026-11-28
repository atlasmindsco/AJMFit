/**
 * The image a client posts after a session.
 *
 * It is the only thing in this product that leaves it. Somebody puts it on
 * their story with their name attached, so the bar is not "on brand" — it is
 * that they would be happy for people they know to see it, and that every
 * figure on it is true.
 *
 * Pure. The drawing lives in components/studio/ShareSheet.tsx; what to draw,
 * in what order, and how to word it, lives here so it can be checked. The
 * two things most likely to go wrong are both wording: a day name long
 * enough to run off the edge, and a rep count that disagrees with the screen
 * the client is looking at.
 */

export interface ShareFormat {
  key: 'story' | 'post'
  label: string
  width: number
  height: number
}

/**
 * Instagram's two shapes, at the sizes Instagram itself recommends.
 *
 * Nothing else: a third option is a decision to make before sharing, and the
 * point of this screen is that posting takes one tap.
 */
export const SHARE_FORMATS: ShareFormat[] = [
  { key: 'story', label: 'Story', width: 1080, height: 1920 },
  { key: 'post', label: 'Post', width: 1080, height: 1350 },
]

export interface ShareStat {
  value: string
  label: string
}

export interface ShareCard {
  heading: string
  /** The day, already trimmed to something that will fit. */
  subheading: string
  /**
   * The one figure the card leads on, or null for a session that moved no
   * external load. A bodyweight day posting "0 LBS" in letters an inch high
   * would be the card calling the work nothing.
   */
  hero: { value: string; label: string } | null
  stats: ShareStat[]
  /** The PR line, or null. Never a consolation message — see below. */
  achievement: string | null
  site: string
}

/** Longest day name the card can show before it stops looking designed. */
const MAX_DAY = 24

export interface ShareInput {
  dayName: string
  reps: number
  sets: number
  /** Already formatted — the card quotes the screen rather than recomputing. */
  duration: string
  recordCount: number
  /**
   * Pounds moved. Zero for a session with no external load.
   *
   * WHAT THIS NUMBER IS, precisely, because it is about to be posted in
   * public and people will compare them. It is the weight typed into the box
   * multiplied by the reps typed into the box, for sets that were ticked.
   *
   * WHAT IT IS NOT, and cannot be without a change to how sets are stored:
   * `workout_sets` records a weight, a rep count and whether the set was an
   * intensity set, and nothing else. There is no field saying a set was a
   * warm-up, none saying whether a dumbbell figure is per hand or for the
   * pair, none saying whether reps were counted per side, and none marking
   * an assisted machine where the load helps rather than resists. So:
   *
   *   - warm-ups count, because nothing distinguishes them
   *   - a dumbbell set counts whatever was typed, once
   *   - a unilateral set counts whatever was typed, once
   *   - assistance would count as resistance, if anyone logged it
   *
   * Each of those is a data-model change rather than an arithmetic one, and
   * guessing at them would be worse than counting plainly and saying so.
   * Bodyweight work contributes no volume, which is the one case the data
   * does distinguish: a weight of zero.
   */
  volume: number
}

/**
 * What goes on the card.
 *
 * `duration` arrives already formatted rather than as seconds, deliberately:
 * the card must say exactly what the screen behind it said. Two formatters
 * would eventually disagree, and a client posting "1h 12m" from a screen
 * reading "1h 13m" has caught the app lying about something trivial, which
 * is how they start wondering about the rest.
 *
 * NO MOTIVATIONAL LINE WHEN THERE IS NO RECORD. On the completion screen,
 * "You showed up" is warm. On a public post it reads as an apology for not
 * having set a record, in front of the client's friends. The card simply
 * leaves that row out.
 */
export function buildShareCard(input: ShareInput): ShareCard {
  const day = input.dayName.trim()
  const subheading = day.length > MAX_DAY ? day.slice(0, MAX_DAY - 1).trimEnd() + '…' : day || 'Session'

  /* Number.isFinite before the rounding, not after: an empty weight box gives
     NaN and a runaway one gives Infinity, and `Infinity.toLocaleString()` is
     "∞", which would put a maths symbol on somebody's story. Both land in the
     same place as a bodyweight day — no hero row. */
  const volume = Number.isFinite(input.volume) ? Math.max(0, Math.round(input.volume)) : 0

  return {
    heading: 'Workout Complete',
    subheading,
    /* Volume leads, because it is the figure that makes a session sound like
       a session — and it is left out entirely when there is none, rather
       than printed as a zero. A bodyweight day is not a day that moved no
       weight; it is a day the number does not describe. */
    hero: volume > 0 ? { value: `${volume.toLocaleString('en-US')} LBS`, label: 'Total Volume' } : null,
    stats: [
      { value: String(Math.max(0, Math.round(input.reps))), label: 'Total Reps' },
      { value: String(Math.max(0, Math.round(input.sets))), label: input.sets === 1 ? 'Set' : 'Sets' },
      { value: input.duration || '—', label: 'Duration' },
    ],
    achievement:
      input.recordCount > 0
        ? `${input.recordCount} New PR${input.recordCount === 1 ? '' : 's'}`
        : null,
    site: 'ajmfit.com',
  }
}

/**
 * WHERE EVERY ELEMENT SITS, AS ARITHMETIC RATHER THAN AS TASTE.
 *
 * This was inline in the canvas code, which is how the 4:5 post ended up with
 * fifteen pixels of clearance between the bottom of the PR bar and the top of
 * "ajmfit.com". Nobody had done the sum; the story format looked fine and the
 * post was never opened on a phone short enough to notice.
 *
 * The specific trap: the wordmark file is 520×346. On screen it reads as a thin
 * strip, so 300px wide sounds modest — it is 200px of vertical space spent
 * before the card has said anything, and the post has 570 fewer pixels than the
 * story to spend. Adding the volume figure to that stack was what pushed it
 * over.
 *
 * So the layout is a pure function and tools/verify-share-card.ts checks that
 * every combination fits: both formats, with and without the hero figure, with
 * and without the PR bar. A card that overflows is not a cosmetic bug — it is
 * cropped text on somebody's story with their name attached.
 *
 * `heroFont` is passed in rather than computed because only a canvas can
 * measure text, and the hero figure is shrunk to fit its width. Everything
 * else here is fixed.
 */
export interface ShareLayout {
  logoY: number
  logoW: number
  /** Top of the tick's bounding box; its centre is logoY + r. */
  tickY: number
  tickR: number
  /** Baselines, not box tops — this is canvas text. */
  headingY: number
  headingFont: number
  subY: number
  subFont: number
  heroY: number | null
  heroLabelY: number | null
  tilesY: number
  tileH: number
  barY: number
  barH: number
  siteY: number
  /** Pixels between the lowest element and the top of the footer text. */
  clearance: number
}

/** The wordmark's own proportions. Hard-coded because a layout cannot wait. */
const LOGO_ASPECT = 346 / 520
/** Cap height of the footer, for measuring clearance against its baseline. */
const FOOTER_CAP = 26

export function shareLayout(
  format: ShareFormat,
  opts: { hasHero: boolean; hasAchievement: boolean; heroFont: number }
): ShareLayout {
  const tall = format.key === 'story'
  /* Story starts at 330 because Instagram draws its own interface over roughly
     the top and bottom 250px of a story. The post has no such furniture and
     starts near the top. */
  const start = tall ? 330 : 120
  const logoW = tall ? 260 : 200
  const tickR = tall ? 72 : 54

  let y = start
  const logoY = y
  y += LOGO_ASPECT * logoW + (tall ? 110 : 70)
  const tickY = y
  y += tickR * 2 + (tall ? 76 : 52)
  const headingY = y
  y += tall ? 58 : 52
  const subY = y
  y += tall ? 88 : 72

  let heroY: number | null = null
  let heroLabelY: number | null = null
  if (opts.hasHero) {
    /* 0.78 of the font size approximates the cap height, which is what puts a
       baseline where the eye expects the top of the number to be. */
    heroY = y + opts.heroFont * 0.78
    heroLabelY = heroY + (tall ? 50 : 44)
    y = heroLabelY + (tall ? 70 : 52)
  }

  const tilesY = y
  const tileH = tall ? 190 : 168
  y += tileH + (tall ? 64 : 44)

  const barY = y
  const barH = tall ? 118 : 104
  const lowest = opts.hasAchievement ? barY + barH : tilesY + tileH

  const siteY = format.height - (tall ? 150 : 84)

  /* THE STACK IS CENTRED IN WHAT IS LEFT, NOT PINNED TO THE TOP.
     The card is four blocks tall with a volume figure and a PR bar, and two
     blocks tall without either — a bodyweight session that set no records.
     Pinned to the top, that short version leaves 465px of nothing beneath it
     on the 4:5 post, which does not read as restraint. It reads as a card
     that failed to finish loading, and it is going on somebody's story.
     So the spare room is shared. 0.35 rather than half because optical centre
     sits above geometric centre: a block placed in the exact middle of a tall
     frame looks like it has sagged. And it only ever moves the stack DOWN,
     never up, so the story can never ride into the interface Instagram draws
     over its top ~250px.
     MIN_GAP is held back from the sharing so the footer keeps a margin of its
     own rather than being crept up on. */
  const MIN_GAP = 90
  const shift = Math.max(0, siteY - FOOTER_CAP - lowest - MIN_GAP) * 0.35

  /* Whole pixels. The logo's aspect ratio, the hero's cap-height factor and
     now the shift all produce fractions, and a canvas asked to put a baseline
     at y=1216.44 anti-aliases the text across two rows of pixels — which on a
     1080-wide image scaled into a phone's story viewer is the difference
     between crisp and slightly soft. Rounded once, here, rather than at nine
     call sites. */
  const px = (n: number) => Math.round(n + shift)
  return {
    logoY: px(logoY),
    logoW,
    tickY: px(tickY),
    tickR,
    headingY: px(headingY),
    headingFont: tall ? 72 : 64,
    subY: px(subY),
    subFont: tall ? 46 : 42,
    heroY: heroY === null ? null : px(heroY),
    heroLabelY: heroLabelY === null ? null : px(heroLabelY),
    tilesY: px(tilesY),
    tileH,
    barY: px(barY),
    barH,
    // The footer is anchored to the bottom edge and does not move with the
    // stack, so it is the one position the shift must not be applied to.
    siteY: Math.round(siteY),
    clearance: Math.round(siteY - FOOTER_CAP - lowest - shift),
  }
}

/** The largest the hero figure is ever set, before it is shrunk to fit. */
export function heroStartFont(format: ShareFormat): number {
  return format.key === 'story' ? 150 : 124
}

/** What the file is called when it lands in somebody's camera roll. */
export function shareFilename(dayName: string, format: ShareFormat['key']): string {
  const slug = dayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `ajmfit-${slug || 'workout'}-${format}.png`
}

/**
 * The text that travels with the image.
 *
 * Short, because the client writes their own caption and anything we add is
 * in their way. No hashtags: a brand putting hashtags in somebody else's post
 * is the thing that makes a share feel like an advert.
 */
export function shareText(card: ShareCard): string {
  const bits = [card.subheading]
  // Volume leads here too, for the same reason it leads on the image — and is
  // simply absent on a bodyweight day rather than written as a zero.
  if (card.hero) bits.push(card.hero.value.toLowerCase())
  bits.push(`${card.stats[0].value} reps`, `${card.stats[1].value} sets`)
  if (card.achievement) bits.push(card.achievement)
  return `${bits.join(' · ')} — ${card.site}`
}
