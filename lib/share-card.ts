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

import type { ExerciseLine } from '@/lib/session-summary'

export type { ExerciseLine }

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
  /**
   * The work, trimmed to what fits. Empty for a session with nothing logged,
   * in which case the card simply has no list rather than an empty box.
   */
  exercises: ExerciseLine[]
  /**
   * "+2 more", or null when the whole session is shown. Never omitted
   * silently: a card showing six of eight exercises without saying so is
   * understating somebody's session, which is its own kind of untrue.
   */
  more: string | null
  /** The PR line, or null. Never a consolation message — see below. */
  achievement: string | null
  site: string
}

/** Longest day name the card can show before it stops looking designed. */
const MAX_DAY = 24
/** Longest exercise name before it is cut. Measured, not guessed — see below. */
const MAX_EXERCISE = 26

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
   *
   * AND IT IS STAYING THIS WAY. Decided 28 Nov 2026, after costing a
   * warm-up toggle — the one of the four that would have been cheap.
   *
   * The reason is not the friction, though a tap per warm-up on the screen a
   * client uses mid-set with a sweaty thumb is a real cost. It is that an
   * optional flag is only as good as how reliably somebody remembers it. A
   * week they tapped it diligently reads lower than a week they did not, so
   * the figure starts moving for reasons that have nothing to do with
   * training. A consistently slightly-generous number is MORE useful than an
   * inconsistently accurate one, because the only thing this number is for is
   * comparing somebody to themselves.
   *
   * The trigger to revisit is a client questioning a figure. Then there is a
   * reason, and a specific one.
   */
  volume: number
  /**
   * What was actually done, in program order, already filtered to the
   * exercises that were logged. See exerciseLines in lib/session-summary.ts
   * for why an untouched exercise is not in here.
   */
  exercises: ExerciseLine[]
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
export function buildShareCard(input: ShareInput, format: ShareFormat = SHARE_FORMATS[0]): ShareCard {
  const day = input.dayName.trim()
  const subheading = day.length > MAX_DAY ? day.slice(0, MAX_DAY - 1).trimEnd() + '…' : day || 'Session'

  /* Number.isFinite before the rounding, not after: an empty weight box gives
     NaN and a runaway one gives Infinity, and `Infinity.toLocaleString()` is
     "∞", which would put a maths symbol on somebody's story. Both land in the
     same place as a bodyweight day — no hero row. */
  const volume = Number.isFinite(input.volume) ? Math.max(0, Math.round(input.volume)) : 0

  /* THE WORK, TRIMMED TO WHAT THE CARD CAN HOLD.
     The cap comes from the layout rather than from taste: maxExerciseRows()
     works out how many lines are left after the hero figure and the PR bar
     have taken their space, which differs between the two formats and
     between a session that set a record and one that did not.
     A trimmed list says so. Six of eight exercises shown silently would
     understate the session, and understating it is as wrong as inflating it
     when the person posting it knows exactly what they did. */
  const room = maxExerciseRows(format, { hasHero: volume > 0, hasAchievement: input.recordCount > 0 })
  /* `?? []` rather than trusting the type. Everything else on this card
     degrades to something sayable when its input is missing, and a thrown
     error here is not a missing list — it is no card at all, at the one
     moment somebody wanted to post. */
  const all = (input.exercises ?? []).filter((e) => e?.name?.trim().length > 0)
  /* When it has to trim, "+2 more" takes the last row rather than being
     squeezed in underneath — so the row count the layout was given stays the
     row count the card draws, and nothing creeps toward the footer. */
  const trimmed = all.length > room
  const shown = all.slice(0, trimmed ? Math.max(0, room - 1) : room).map((e) => ({
    name: e.name.length > MAX_EXERCISE ? e.name.slice(0, MAX_EXERCISE - 1).trimEnd() + '…' : e.name,
    detail: e.detail,
  }))
  const hidden = all.length - shown.length

  return {
    heading: 'Workout Complete',
    subheading,
    /* Volume leads, because it is the figure that makes a session sound like
       a session — and it is left out entirely when there is none, rather
       than printed as a zero. A bodyweight day is not a day that moved no
       weight; it is a day the number does not describe. */
    hero: volume > 0 ? { value: `${volume.toLocaleString('en-US')} LBS`, label: 'Total Volume' } : null,
    exercises: shown,
    more: hidden > 0 ? `+${hidden} more` : null,
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
  /** Baseline of the "THE WORK" label, or null when nothing was logged. */
  listHeadY: number | null
  /** Baseline of the first exercise row; each next one is listRowH lower. */
  listY: number | null
  listRowH: number
  siteY: number
  /** Pixels between the lowest element and the top of the footer text. */
  clearance: number
}

/** The wordmark's own proportions. Hard-coded because a layout cannot wait. */
const LOGO_ASPECT = 346 / 520
/** No block may come closer than this to the footer. */
const MIN_FOOTER_CLEARANCE = 40
/** Cap height of the footer, for measuring clearance against its baseline. */
const FOOTER_CAP = 26

export function shareLayout(
  format: ShareFormat,
  opts: { hasHero: boolean; hasAchievement: boolean; heroFont: number; rows?: number }
): ShareLayout {
  const tall = format.key === 'story'
  /* EVERY BLOCK CAME DOWN TO MAKE ROOM FOR THE EXERCISE LIST, and the two
     that came down hardest are the two that were saying the least.
     The wordmark is 520x346, so it is never the thin strip it looks like,
     and the blue tick had grown to a 144px circle restating in a picture what
     "Workout Complete" says underneath it in 72px type. Neither carried any
     information the list does. Shrinking them bought the six rows; shrinking
     the type instead would have bought the same space and made the card
     harder to read, which is the opposite of the point.

     THE STORY'S FOOTER MOVED UP 100px, and that is a fix rather than a
     trade. Instagram draws its reply bar over roughly the bottom 250px of a
     story and its own header over the top 250. The ajmfit.com credit was
     sitting at 1780 — inside that bar, on every story anybody has posted. It
     is at 1670 now, which is the first row that is actually visible. */
  const start = tall ? 268 : 80
  const logoW = tall ? 190 : 160
  const tickR = tall ? 44 : 38

  /* A BASELINE IS NOT THE TOP OF THE TEXT, AND THIS COST TWO BUGS IN A ROW.
     Canvas text grows upwards from its baseline: a 64px heading occupies the
     46px above the number stored for it, and hangs about 14px below. Advance
     by a plain gap and whatever is above gets overlapped. The blue tick landed
     on "Workout Complete"; the fix for that pushed "Push Day" into the
     heading's descenders one line further down. Both looked perfectly correct
     as arithmetic and both were only visible on a rendered card.

     So nothing below is a hand-tuned gap any more. `after()` advances from one
     baseline to the next by what the two fonts actually occupy plus the space
     that is wanted BETWEEN them, which is the number a person can reason
     about. Resizing any of this type can no longer quietly reintroduce the
     collision, and the gaps now mean what they say. */
  const CAP = 0.72
  const DESC = 0.22
  /** Baseline-to-baseline for `gap` pixels of real space between two lines. */
  const after = (fromFont: number, toFont: number, gap: number) =>
    fromFont * DESC + gap + toFont * CAP
  /** Top-of-a-block to the first baseline under it. */
  const under = (toFont: number, gap: number) => gap + toFont * CAP

  let y = start
  const logoY = y
  y += LOGO_ASPECT * logoW + (tall ? 52 : 46)
  const tickY = y
  y += tickR * 2

  const headingFont = tall ? 64 : 56
  const subFont = tall ? 42 : 38
  const heroLabelFont = tall ? 34 : 30

  y += under(headingFont, tall ? 34 : 30)
  const headingY = y
  y += after(headingFont, subFont, tall ? 12 : 10)
  const subY = y

  let heroY: number | null = null
  let heroLabelY: number | null = null
  if (opts.hasHero) {
    /* The hero uses 0.78 rather than CAP: it is digits, which sit slightly
       taller than the cap height of letters in this face. */
    heroY = y + after(subFont, opts.heroFont, tall ? 30 : 24) - opts.heroFont * CAP + opts.heroFont * 0.78
    heroLabelY = heroY + after(opts.heroFont, heroLabelFont, tall ? 14 : 12)
    y = heroLabelY + heroLabelFont * DESC + (tall ? 34 : 28)
  } else {
    y = subY + subFont * DESC + (tall ? 34 : 28)
  }

  const tilesY = y
  const tileH = tall ? 168 : 140
  y += tileH + (tall ? 32 : 30)

  const barY = y
  const barH = tall ? 108 : 90
  if (opts.hasAchievement) y = barY + barH + (tall ? 28 : 26)

  /* THE WORK.
     Last of the blocks, under the PR bar rather than above it: the bar is the
     headline and this is the evidence for it. A row is a name on the left and
     its top set on the right, which is how a training log is written down
     everywhere else.
     How many rows there is room for is not decided here — see
     maxExerciseRows, which asks this function. */
  const rows = Math.max(0, Math.floor(opts.rows ?? 0))
  const listRowH = tall ? 46 : 42
  let listHeadY: number | null = null
  let listY: number | null = null
  if (rows > 0) {
    const listHeadFont = tall ? 28 : 26
    const listRowFont = tall ? 32 : 29
    listHeadY = y + under(listHeadFont, tall ? 20 : 16)
    listY = listHeadY + after(listHeadFont, listRowFont, tall ? 22 : 18)
    y = listY + (rows - 1) * listRowH + (tall ? 14 : 12)
  }

  const lowest = rows > 0 ? y : opts.hasAchievement ? barY + barH : tilesY + tileH

  const siteY = format.height - (tall ? 250 : 62)

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
    headingFont,
    subY: px(subY),
    subFont,
    heroY: heroY === null ? null : px(heroY),
    heroLabelY: heroLabelY === null ? null : px(heroLabelY),
    tilesY: px(tilesY),
    tileH,
    barY: px(barY),
    barH,
    listHeadY: listHeadY === null ? null : px(listHeadY),
    listY: listY === null ? null : px(listY),
    listRowH,
    // The footer is anchored to the bottom edge and does not move with the
    // stack, so it is the one position the shift must not be applied to.
    siteY: Math.round(siteY),
    clearance: Math.round(siteY - FOOTER_CAP - lowest - shift),
  }
}

/**
 * How many exercises there is room for, by asking the layout rather than by
 * picking a number.
 *
 * The two formats have very different budgets — the 4:5 post is 570px shorter
 * than the 9:16 story — and a card that set a record has already spent 174px
 * on the gold bar. A fixed cap would either waste a third of the story or
 * push the post's footer off the bottom, and the second of those ends up on
 * somebody's Instagram.
 *
 * Capped at 10 regardless. Past about ten rows the card stops being a result
 * and becomes a spreadsheet, and the longest day in the library is eight.
 */
export function maxExerciseRows(
  format: ShareFormat,
  opts: { hasHero: boolean; hasAchievement: boolean }
): number {
  const heroFont = heroStartFont(format)
  let best = 0
  for (let rows = 1; rows <= 10; rows++) {
    const L = shareLayout(format, { ...opts, heroFont, rows })
    if (L.clearance < MIN_FOOTER_CLEARANCE) break
    best = rows
  }
  return best
}

/** The largest the hero figure is ever set, before it is shrunk to fit. */
export function heroStartFont(format: ShareFormat): number {
  return format.key === 'story' ? 128 : 104
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
