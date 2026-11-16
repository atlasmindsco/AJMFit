/**
 * What needs this client's attention, ranked.
 *
 * The homepage already answers "what am I doing today" — Today's Training is
 * the first card and was deliberately moved there. This answers the other
 * question: is there anything I should know before I start.
 *
 * WHY A RANKED LIST AND NOT A CAROUSEL
 *
 * Simulated against all twelve active clients, a carousel would hold two cards
 * for half of them and one of those two would be today's workout, which is
 * already below it. A swipe also hides everything past the first card, which
 * is tolerable for promotions and backwards for things that need attention —
 * the second most urgent item becomes the one nobody sees.
 *
 * So this returns a ranked list and the component renders the top three. If
 * the day comes when a typical client has four or more, the same function
 * drives a carousel without changing.
 *
 * TODAY'S WORKOUT IS DELIBERATELY ABSENT. It has a better card directly below
 * this one, and duplicating it here would push the primary action down the
 * page to tell someone something they can already see.
 */

export type AttentionKind =
  | 'coach_replied'
  | 'reply_late'
  | 'check_in_due'
  | 'no_program'
  | 'block_ending'
  | 'back_after_break'
  | 'last_pr'
  | 'protein_short'
  | 'set_training_days'
  | 'photo_due'
  | 'recommendation'

export interface AttentionCard {
  kind: AttentionKind
  /** Lower sorts first. Fixed per kind so the order never depends on input. */
  rank: number
  title: string
  detail: string | null
  href: string
  /** 'act' needs doing, 'good' is a win, 'offer' is optional and dismissible. */
  tone: 'act' | 'good' | 'offer'
  dismissible: boolean
}

export interface AttentionInput {
  coached: boolean
  /** Unread messages from the coach. */
  unreadFromCoach: number
  /** Has a check-in been submitted for the current week? Null when not coached. */
  checkInDoneThisWeek: boolean | null
  hasProgram: boolean
  /** Days remaining in the current block, or null when there is no block. */
  blockDaysLeft: number | null
  /** Days since the last logged session, or null if they never trained. */
  daysSinceLastWorkout: number | null
  /** Whether the client has told us which days they train. */
  trainingDaysSet: boolean
  lastPr: { exercise: string; weight: number; reps: number; daysAgo: number } | null
  /** Average protein as a fraction of target over a full week, or null. */
  proteinRatio: number | null
  /** A published recommendation to surface, at most weekly. */
  /**
   * Hours past the reply time this client's tier promised, when a check-in is
   * still unanswered. Null or absent when nothing is overdue.
   */
  replyOverdueHours?: number | null
  /**
   * Days since their last progress photo. Null means they have never taken
   * one; absent means the caller did not look, and nothing is offered.
   */
  daysSinceLastPhoto?: number | null
  recommendation: { title: string; category: string } | null
}

/** A PR stops being news after this, and becomes a target instead. */
export const PR_FRESH_DAYS = 14

/** Quiet for this long and coming back deserves acknowledging. */
const BREAK_DAYS = 7

/** A block closing inside this window is worth flagging. */
// Four weeks is the shortest gap where two progress photos actually differ.
const PHOTO_INTERVAL_DAYS = 28

const BLOCK_WARNING_DAYS = 7

/** Below this share of their protein target, for a full week. */
const PROTEIN_SHORT = 0.8

export function attentionCards(input: AttentionInput): AttentionCard[] {
  const cards: AttentionCard[] = []

  // 1. A coach who has replied outranks everything. The client paid for the
  //    answer and the app should not make them go looking for it.
  if (input.unreadFromCoach > 0) {
    cards.push({
      kind: 'coach_replied',
      rank: 1,
      title: input.unreadFromCoach === 1 ? 'Anthony replied' : `${input.unreadFromCoach} messages from Anthony`,
      detail: null,
      href: '/studio/messages',
      tone: 'act',
      dismissible: false,
    })
  }

  // 1.5 The coach is late, said before the client works it out.
  //
  //    The tier sells a reply within 48 or 24 hours and the client was told
  //    that number. When it passes, they are sitting there deciding what the
  //    silence means, and the answer they reach on their own is always worse
  //    than the truth. A late reply someone acknowledged is survivable; an
  //    unexplained one is where people quietly decide to cancel.
  //
  //    Not dismissible, and it disappears by itself the moment the reply
  //    lands. Ranked above the check-in prompt because asking for this week's
  //    check-in while last week's is still unanswered is insulting.
  if (
    input.coached &&
    input.replyOverdueHours !== null &&
    input.replyOverdueHours !== undefined &&
    input.replyOverdueHours > 0
  ) {
    const h = Math.round(input.replyOverdueHours)
    cards.push({
      kind: 'reply_late',
      rank: 1.5,
      title: 'Your check-in reply is running late',
      detail:
        h < 24
          ? 'Anthony has it and has not replied yet. He knows it is overdue.'
          : `It has been ${Math.round(h / 24)} days past when he said he would reply. He knows.`,
      href: '/studio/check-in',
      tone: 'act',
      dismissible: false,
    })
  }

  // 2. The weekly check-in, for the tiers that are sold on it. Never shown to
  //    a Blueprint client: nothing asks them to check in, and offering it
  //    would promise a reply nobody owes them.
  if (input.coached && input.checkInDoneThisWeek === false) {
    cards.push({
      kind: 'check_in_due',
      rank: 2,
      title: 'Your weekly check-in',
      detail: 'Six questions, about a minute.',
      href: '/studio/check-in',
      tone: 'act',
      dismissible: false,
    })
  }

  // 3. No program at all. Three clients are in this state, one of them for
  //    178 days on a paid coaching plan.
  if (!input.hasProgram) {
    cards.push({
      kind: 'no_program',
      rank: 3,
      title: 'You have no program yet',
      detail: input.coached
        ? 'Anthony is putting yours together. You can build your own in the meantime.'
        : 'Pick one from the library, or build your own.',
      href: '/studio/programs',
      tone: 'act',
      dismissible: false,
    })
  }

  // 4. A block ending. Now that completing one actually records — it never did
  //    before — this is the moment to decide what comes next rather than
  //    drifting into a tenth week of an eight-week block.
  if (input.blockDaysLeft !== null && input.blockDaysLeft <= BLOCK_WARNING_DAYS) {
    const left = input.blockDaysLeft
    // Negative means it already finished. Several blocks in production are
    // weeks past their end, because recording a completed block only started
    // working recently — telling someone whose eight weeks ended in September
    // that it "finishes today" would be its own small lie.
    const over = left < 0 ? Math.abs(left) : 0
    cards.push({
      kind: 'block_ending',
      rank: 4,
      title:
        over > 0
          ? `Your block finished ${over === 1 ? 'yesterday' : `${over} days ago`}`
          : left === 0
            ? 'Your block finishes today'
            : `Your block ends in ${left} ${left === 1 ? 'day' : 'days'}`,
      detail: over > 0 ? 'Pick what comes next, or run it again.' : 'Time to think about what comes next.',
      href: '/studio/programs',
      tone: 'act',
      dismissible: false,
    })
  }

  // 5. Back after a gap. Said plainly and without reproach — the quiet ladder
  //    in the reminders already handles chasing, and this is the moment they
  //    returned, which is the wrong time to tell someone off.
  if (input.daysSinceLastWorkout !== null && input.daysSinceLastWorkout >= BREAK_DAYS) {
    cards.push({
      kind: 'back_after_break',
      rank: 5,
      title: 'Good to see you back',
      detail: `It has been ${input.daysSinceLastWorkout} days. Start where you left off — the weights are still there.`,
      href: '/studio/programs',
      tone: 'good',
      dismissible: true,
    })
  }

  // 6. Their last personal record, always, when they have one.
  //
  //    The age decides the voice. Fresh, it is a celebration. Stale, the same
  //    sentence reads "your best lift was two months ago" to someone who has
  //    not trained since — a reminder of decline dressed as encouragement. So
  //    an old record is pointed forward instead: it becomes a target.
  if (input.lastPr) {
    const { exercise, weight, reps, daysAgo } = input.lastPr
    const fresh = daysAgo <= PR_FRESH_DAYS
    cards.push({
      kind: 'last_pr',
      rank: 6,
      title: fresh ? `New PR — ${exercise}` : `Your best ${exercise.toLowerCase()}`,
      detail: fresh
        ? `${weight} lb × ${reps}.`
        : `${weight} lb × ${reps}. Today is a good day to beat it.`,
      href: '/studio/progress',
      tone: 'good',
      dismissible: true,
    })
  }

  // 7. Protein, only on a full week of evidence, and never as a product pitch.
  if (input.proteinRatio !== null && input.proteinRatio < PROTEIN_SHORT) {
    cards.push({
      kind: 'protein_short',
      rank: 7,
      title: 'Protein is running short',
      detail: `You have averaged ${Math.round(input.proteinRatio * 100)}% of your target this week.`,
      href: '/studio/nutrition',
      tone: 'offer',
      dismissible: true,
    })
  }

  // 8. The cheapest card here and the most valuable. Nobody has ever set their
  //    training days — it is optional in the picker and everyone skips it — so
  //    there is no weekly goal to count against, no "3 of 4 done", and the
  //    reminders cannot say "it is Tuesday and you train Tuesdays".
  if (input.hasProgram && !input.trainingDaysSet) {
    cards.push({
      kind: 'set_training_days',
      rank: 8,
      title: 'Which days do you train?',
      detail: 'Tell us once and the app can track your week and remind you on the right days.',
      href: '/studio/schedule',
      tone: 'offer',
      dismissible: true,
    })
  }

  // 8.5 A progress photo, every fourth week and no oftener.
  //
  //     Weekly photos are a bad idea dressed as diligence: seven days of
  //     change is mostly water, light and angle, so a weekly habit mostly
  //     teaches people that nothing is happening. Four weeks is the shortest
  //     gap where two photos actually differ, which is also why the upload
  //     screen already says "once a month is plenty" — it just never asked.
  //
  //     An offer, always dismissible. Progress photos are the single most
  //     personal thing the app asks for, and anyone who finds them unpleasant
  //     should be able to make the request go away without explaining.
  if (
    input.daysSinceLastPhoto === null ||
    (input.daysSinceLastPhoto !== undefined && input.daysSinceLastPhoto >= PHOTO_INTERVAL_DAYS)
  ) {
    const first = input.daysSinceLastPhoto === null
    cards.push({
      kind: 'photo_due',
      rank: 8.5,
      title: first ? 'Take a starting photo' : 'Time for a progress photo',
      detail: first
        ? 'Only Anthony sees it. In eight weeks it will be the clearest evidence you have.'
        : `Your last one was ${Math.round((input.daysSinceLastPhoto ?? 0) / 7)} weeks ago. Same spot, same light.`,
      href: '/studio/progress',
      tone: 'offer',
      dismissible: true,
    })
  }

  // 9. Commercial content, last and capped. It can never outrank training,
  //    coaching or progress — that is the rule, written into the rank rather
  //    than left to whoever edits this next.
  if (input.recommendation) {
    cards.push({
      kind: 'recommendation',
      rank: 9,
      title: input.recommendation.title,
      detail: null,
      href: '/studio/nutrition',
      tone: 'offer',
      dismissible: true,
    })
  }

  return cards.sort((a, b) => a.rank - b.rank)
}

/**
 * The top few, which is what the homepage renders.
 *
 * Three, because a fourth thing needing attention is a conversation rather
 * than a card — and because the stack sits above the client's session and must
 * never push the start button off the first screen.
 */
export function topAttention(input: AttentionInput, limit = 3): AttentionCard[] {
  return attentionCards(input).slice(0, limit)
}
