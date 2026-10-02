/**
 * What counts as a personal record.
 *
 * The app recognised exactly one kind: a heavier top-set weight than the
 * stored record. Three things follow from that, all wrong.
 *
 * 70x12 after 70x10 is unmistakable progress and registered as nothing. An
 * 80x8 after an 85x3 is stronger on any formula and was read as a regression.
 * And because the check fell through to "weight > 0" when no record existed,
 * the first time a client ever did an exercise, every set they logged came up
 * gold — the meaningless-record case, live in production until Phase 1.
 *
 * So: four kinds, each with its own bar, and nothing celebrates a baseline.
 */

export type RecordKind = 'weight' | 'reps' | 'e1rm'

export interface Lift {
  weight: number
  reps: number
}

export interface PersonalBest {
  /** Heaviest weight ever lifted on this movement, at any rep count. */
  weight: number
  /** Reps achieved at that weight. */
  reps: number
}

export interface RecordHit {
  kind: RecordKind
  /** One line for the client, in their words not the engine's. */
  text: string
  /** True for the kinds worth interrupting a workout over. */
  celebrate: boolean
  /** The new figure, for storing. */
  value: number
  /** What it beat. */
  previous: number
}

/**
 * Epley. One formula, applied everywhere, so comparisons stay consistent.
 *
 * Deliberately not used above about 12 reps: every 1RM estimate drifts badly
 * into high-rep sets, and a 20-rep back-off set should not be allowed to
 * announce a strength record.
 */
export function estimate1RM(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null
  if (weight <= 0 || reps <= 0 || reps > 12) return null
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

const round = (n: number) => Math.round(n * 10) / 10

/**
 * Above this, a rep count is a typo rather than a set.
 *
 * Production holds a Barbell Bench Press logged at "125 lb x 125 reps" — the
 * weight typed into both boxes — and a Light Cardio entry at 65, which is
 * minutes in the rep field. Celebrating those as records teaches clients the
 * records mean nothing. Forty-rep calf raises and glute bridges are real and
 * stay under the line.
 */
const MAX_CREDIBLE_REPS = 50

/**
 * Judge one completed set against what the client has done before.
 *
 * `best` is null the first time they meet a movement — that is a baseline,
 * never a record, which is the same reasoning already applied to first-session
 * progression targets.
 *
 * Returns at most one hit, the most meaningful: a heavier weight outranks more
 * reps, which outranks an estimate.
 */
export function judgeSet(set: Lift, best: PersonalBest | null): RecordHit | null {
  const { weight, reps } = set
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) return null
  if (reps > MAX_CREDIBLE_REPS) return null
  // A bodyweight movement logged at 0 has nothing to compare.
  if (weight <= 0) return null
  if (!best) return null

  if (weight > best.weight) {
    return {
      kind: 'weight',
      celebrate: true,
      value: weight,
      previous: best.weight,
      text: `${weight} lb × ${reps} — heaviest you've lifted on this, up from ${best.weight}.`,
    }
  }

  // Same weight, more reps. Real progress, and the old model ignored it.
  if (weight === best.weight && reps > best.reps) {
    return {
      kind: 'reps',
      celebrate: true,
      value: reps,
      previous: best.reps,
      // Deliberately not "N more reps than your best": where the previous best
      // was a single, that reads as "14 more reps", which is true, strange,
      // and draws attention to the thin baseline rather than the achievement.
      text: `${weight} lb × ${reps} — most reps you've done at this weight.`,
    }
  }

  // Lighter bar, more reps, more work. Shown at the end of the session rather
  // than mid-set: it is a real result but not one worth a banner over.
  const now = estimate1RM(weight, reps)
  const then = estimate1RM(best.weight, best.reps)
  if (now != null && then != null && now > then) {
    return {
      kind: 'e1rm',
      celebrate: false,
      value: now,
      previous: then,
      text: `${weight} lb × ${reps} — your strongest set yet on this, working out to about ${round(now)} lb for one.`,
    }
  }

  return null
}

/* -------------------------------------------------------------------------- */

export interface TimedEffort {
  durationSeconds: number
  /** Null when the client only logged time. */
  distanceMi: number | null
}

/**
 * A record for running and rowing, which cannot be judged on time alone.
 *
 * A longer session is not a better one — the programs here prescribe fixed 10
 * and 20 minute slots, so "longest ever" would reward nothing but having more
 * time that day. What improves is ground covered and the pace it was covered
 * at, and neither is computable from a duration by itself. So: no distance, no
 * record. That is why the duration field now has a distance beside it.
 */
export function judgeTimed(effort: TimedEffort, best: TimedEffort | null): RecordHit | null {
  const { durationSeconds, distanceMi } = effort
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  if (distanceMi == null || !Number.isFinite(distanceMi) || distanceMi <= 0) return null
  if (!best || best.distanceMi == null || best.distanceMi <= 0) return null

  const paceNow = durationSeconds / distanceMi
  const paceBefore = best.durationSeconds / best.distanceMi
  const fmt = (secPerMi: number) => {
    const m = Math.floor(secPerMi / 60)
    const s = Math.round(secPerMi % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // Faster over a distance at least as long. Beating a 5-mile pace over half a
  // mile is not the same achievement, so the distance has to hold up.
  if (paceNow < paceBefore && distanceMi >= best.distanceMi * 0.9) {
    return {
      kind: 'e1rm',
      celebrate: true,
      value: round(paceNow),
      previous: round(paceBefore),
      text: `${round(distanceMi)} miles at ${fmt(paceNow)} per mile — your quickest yet, down from ${fmt(paceBefore)}.`,
    }
  }

  // Further than ever, regardless of pace.
  if (distanceMi > best.distanceMi) {
    return {
      kind: 'reps',
      celebrate: true,
      value: round(distanceMi),
      previous: round(best.distanceMi),
      text: `${round(distanceMi)} miles — furthest you've gone, up from ${round(best.distanceMi)}.`,
    }
  }

  return null
}

/**
 * The best single record from a whole session, per exercise.
 *
 * Used by the completion screen, which should say "you set a record" once,
 * naming the best one, rather than listing every set that beat something.
 */
export function sessionRecords(
  sets: Array<{ exerciseName: string } & Lift>,
  bests: Record<string, PersonalBest | null>
): Array<{ exerciseName: string } & RecordHit> {
  const out: Array<{ exerciseName: string } & RecordHit> = []
  const rank: Record<RecordKind, number> = { weight: 3, reps: 2, e1rm: 1 }

  for (const set of sets) {
    const hit = judgeSet(set, bests[set.exerciseName] ?? null)
    if (!hit) continue
    const existing = out.findIndex((r) => r.exerciseName === set.exerciseName)
    if (existing === -1) {
      out.push({ exerciseName: set.exerciseName, ...hit })
    } else if (rank[hit.kind] > rank[out[existing].kind] || hit.value > out[existing].value) {
      out[existing] = { exerciseName: set.exerciseName, ...hit }
    }
  }
  return out
}
