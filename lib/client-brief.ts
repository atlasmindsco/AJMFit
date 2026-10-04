/**
 * A client's numbers, assembled into something a coach can read in one go.
 *
 * Reviewing a check-in properly takes ten to fifteen minutes: read it, look at
 * their training, decide whether anything changes, write a reply. Thirty of
 * those a week is twenty-five hours of nothing else, and that -- not software
 * -- is the real ceiling on how many people one coach can carry.
 *
 * Software cannot make the DECIDING faster. It can remove the assembling,
 * which is most of the elapsed time and none of the value. This gathers what a
 * coach would otherwise open four screens to find, and drafts an opening the
 * coach then edits.
 *
 * The draft is explicitly a DRAFT. It is never sent automatically, and it
 * contains no judgement -- only facts the data supports, phrased plainly, with
 * the coaching left blank. A templated line of encouragement sent in Anthony's
 * name would spend the trust that makes his real messages land.
 *
 * One assembler, used by the weekly check-in reply and the monthly review,
 * because they are the same job at two timescales.
 */

export interface BriefSession {
  /** YYYY-MM-DD */
  date: string
  exerciseName: string
  topWeight: number
  topReps: number
}

export interface BriefInput {
  clientName: string
  /** Days the window covers: 7 for a check-in, ~30 for a monthly review. */
  windowDays: number
  /** Dates of logged sessions inside the window. */
  sessionDates: string[]
  /** Dates of logged sessions in the window before this one. */
  priorSessionDates?: string[]
  /** Top set per exercise per session, inside the window. */
  lifts: BriefSession[]
  /** The same, for the window before. */
  priorLifts?: BriefSession[]
  weightNow?: number | null
  weightBefore?: number | null
  /** Self-reported 1-5 scores from the check-in, when there is one. */
  energy?: number | null
  nutritionAdherence?: number | null
  sleep?: number | null
  hunger?: number | null
  win?: string | null
  obstacle?: string | null
}

export interface Brief {
  /** Short factual lines, in the order a coach would want them. */
  facts: string[]
  /** Things that want a decision, if any. */
  flags: string[]
  /** An opening paragraph to edit, or null when there is nothing honest to say. */
  draft: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Best top set per exercise across a window. */
function bestByExercise(lifts: BriefSession[]): Map<string, BriefSession> {
  const out = new Map<string, BriefSession>()
  for (const l of lifts) {
    const cur = out.get(l.exerciseName)
    if (!cur || l.topWeight > cur.topWeight || (l.topWeight === cur.topWeight && l.topReps > cur.topReps)) {
      out.set(l.exerciseName, l)
    }
  }
  return out
}

export function buildBrief(input: BriefInput): Brief {
  const facts: string[] = []
  const flags: string[] = []

  const sessions = new Set(input.sessionDates).size
  const prior = new Set(input.priorSessionDates ?? []).size

  // --- Training volume -----------------------------------------------------
  if (sessions === 0) {
    facts.push(`No sessions logged in the last ${input.windowDays} days.`)
    flags.push('Did not train in this window')
  } else {
    const delta =
      input.priorSessionDates === undefined
        ? ''
        : prior === 0
          ? ''
          : sessions > prior
            ? `, up from ${prior}`
            : sessions < prior
              ? `, down from ${prior}`
              : ', same as the window before'
    facts.push(`${sessions} ${sessions === 1 ? 'session' : 'sessions'}${delta}.`)
    if (input.priorSessionDates !== undefined && prior > 0 && sessions < prior) {
      flags.push('Training frequency dropped')
    }
  }

  // --- Lifts that moved ----------------------------------------------------
  const now = bestByExercise(input.lifts)
  const before = bestByExercise(input.priorLifts ?? [])
  const up: string[] = []
  const down: string[] = []
  // forEach rather than for..of: the project targets ES5, where iterating a
  // Map directly needs downlevelIteration.
  now.forEach((lift, name) => {
    const was = before.get(name)
    if (!was) return
    if (lift.topWeight > was.topWeight) {
      up.push(`${name} ${lift.topWeight} lb (was ${was.topWeight})`)
    } else if (lift.topWeight === was.topWeight && lift.topReps > was.topReps) {
      up.push(`${name} ${lift.topWeight} lb × ${lift.topReps} (was × ${was.topReps})`)
    } else if (lift.topWeight < was.topWeight) {
      down.push(`${name} ${lift.topWeight} lb (was ${was.topWeight})`)
    }
  })
  if (up.length) facts.push(`Up: ${up.slice(0, 4).join('; ')}${up.length > 4 ? `; +${up.length - 4} more` : ''}.`)
  if (down.length) {
    facts.push(`Down: ${down.slice(0, 3).join('; ')}${down.length > 3 ? `; +${down.length - 3} more` : ''}.`)
    flags.push(`${down.length} ${down.length === 1 ? 'lift' : 'lifts'} went backwards`)
  }

  // --- Body weight ---------------------------------------------------------
  if (input.weightNow != null) {
    if (input.weightBefore != null) {
      const d = round1(input.weightNow - input.weightBefore)
      facts.push(`Weight ${round1(input.weightNow)} lb (${d > 0 ? '+' : ''}${d}).`)
      // Deliberately a flag rather than a comment. The nutrition engine treats
      // fast change as something to correct, and nothing automated should
      // congratulate a rate.
      if (Math.abs(d) >= 3) flags.push(`Weight moved ${Math.abs(d)} lb in this window`)
    } else {
      facts.push(`Weight ${round1(input.weightNow)} lb.`)
    }
  }

  // --- What they said about themselves -------------------------------------
  const scores: string[] = []
  if (input.energy != null) scores.push(`energy ${input.energy}/5`)
  if (input.nutritionAdherence != null) scores.push(`nutrition ${input.nutritionAdherence}/5`)
  if (input.sleep != null) scores.push(`sleep ${input.sleep}/5`)
  if (input.hunger != null) scores.push(`hunger ${input.hunger}/5`)
  if (scores.length) facts.push(`Reported: ${scores.join(', ')}.`)

  if (input.energy != null && input.energy <= 2) flags.push('Low energy')
  if (input.nutritionAdherence != null && input.nutritionAdherence <= 2) flags.push('Nutrition adherence low')
  if (input.sleep != null && input.sleep <= 2) flags.push('Sleep poor')
  if (input.hunger != null && input.hunger >= 4) flags.push('Hunger high — deficit may be too aggressive')

  if (input.obstacle?.trim()) flags.push('Named an obstacle — read it')

  return { facts, flags, draft: draftFrom(input, { sessions, prior, up, down }) }
}

/**
 * An opening the coach edits.
 *
 * Facts only, and it stops where the coaching starts. It deliberately does not
 * close the message: an unfinished draft is one a coach will finish, and a
 * finished-looking one is a coach's name on a template.
 */
function draftFrom(
  input: BriefInput,
  ctx: { sessions: number; prior: number; up: string[]; down: string[] }
): string | null {
  const first = input.clientName.split(' ')[0] || 'there'

  // Nothing happened and nothing was said: there is no honest opening, and a
  // cheerful one would be the fake personal message this whole system avoids.
  if (ctx.sessions === 0 && !input.win?.trim() && !input.obstacle?.trim()) return null

  const parts: string[] = [`${first},`]

  if (ctx.sessions > 0) {
    const vol =
      ctx.prior > 0 && ctx.sessions > ctx.prior
        ? `${ctx.sessions} sessions this week, up from ${ctx.prior}.`
        : `${ctx.sessions} ${ctx.sessions === 1 ? 'session' : 'sessions'} this week.`
    parts.push(vol)
  }

  if (ctx.up.length > 0) {
    parts.push(`${ctx.up[0]} is the one that stands out.`)
  } else if (ctx.down.length > 0) {
    parts.push(`${ctx.down[0]} came in under last time.`)
  }

  // Quoted rather than woven into a sentence. A client writes their win in
  // whatever shape they like — "finally hit 10 pull-ups", "consistency" — and
  // any template that absorbs it produces something ungrammatical about half
  // the time, which reads exactly like the machine it is.
  if (input.win?.trim()) parts.push(`On your win — "${input.win.trim().replace(/\.$/, '')}".`)

  return parts.join(' ')
}
