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

  return {
    heading: 'Workout Complete',
    subheading,
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
  const bits = [card.subheading, `${card.stats[0].value} reps`, `${card.stats[1].value} sets`]
  if (card.achievement) bits.push(card.achievement)
  return `${bits.join(' · ')} — ${card.site}`
}
