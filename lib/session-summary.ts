/**
 * What the finished-workout screen says, and how it counts it.
 *
 * WHAT WAS ALREADY THERE. A completion screen, the session's duration, its
 * set count, its volume, the lifts that beat last week, and real personal
 * record detection with three kinds and the figure each one beat. None of
 * that is rebuilt here — see `judgeSet` in lib/records.ts and
 * `durationLabel` in lib/coach-training.ts, both of which this module calls
 * rather than reimplements. A second duration formatter is exactly the drift
 * that put three sizes of small text in this product.
 *
 * WHAT WAS MISSING. Total reps. The screen showed sets and minutes and the
 * number of reps was never counted anywhere in the app, despite being the
 * figure a lifter actually quotes. That is the one new calculation below.
 *
 * Pure, so the counting rules can be checked rather than inferred from a
 * screen. What counts is not obvious: a warm-up is a set you did, an
 * unticked row is not a set at all, and an intensity set is extra work that
 * belongs in the totals but must never be mistaken for a working set.
 */

import type { RecordHit } from '@/lib/records'

/**
 * A row as the training screen holds it, reduced to what totals need.
 *
 * Weight and reps are strings in the UI, because they come from text inputs
 * and an empty box has to stay empty rather than become a zero. They are
 * typed as they actually arrive, not as it would be tidier to receive them —
 * a cast at the call site would move the parsing somewhere nobody tests it.
 */
export interface CountedSet {
  weight: string | number | null
  reps: string | number | null
  /** The client ticked it. An untouched row is not a set. */
  logged: boolean
  /** Drop set, rest-pause, partials. Real work, done after the working sets. */
  isIntensitySet?: boolean
}

export interface SessionTotals {
  /** Every rep the client actually performed, intensity work included. */
  reps: number
  /** Every set they ticked. */
  sets: number
  /** Weight moved, in pounds. Zero for bodyweight work, which has no load to count. */
  volume: number
}

/**
 * Add up what was done.
 *
 * Counts only logged rows, because an untouched row is a plan rather than a
 * fact — this is the same reason the completion screen can say "12 of 18
 * sets" when somebody stops early.
 *
 * Intensity sets COUNT. A drop set is reps performed and weight moved; the
 * distinction between it and a working set matters to the progression engine
 * and not to "how much did I do today".
 *
 * Bodyweight work adds reps and no volume. Counting a client's own mass would
 * make a push-up day read heavier than a squat day, and the app has no
 * reliable bodyweight for most people anyway.
 */
export function sessionTotals(rows: CountedSet[]): SessionTotals {
  let reps = 0
  let sets = 0
  let volume = 0
  for (const row of rows) {
    if (!row.logged) continue
    const r = Number(row.reps)
    if (!Number.isFinite(r) || r <= 0) continue
    sets++
    reps += r
    const w = Number(row.weight)
    if (Number.isFinite(w) && w > 0) volume += w * r
  }
  return { reps, sets, volume: Math.round(volume) }
}

/** One exercise, as it reads on the share card and the detail sheet. */
export interface ExerciseLine {
  /** What they actually did, so a swapped slot names the substitute. */
  name: string
  /** The top set, worded for the kind of work it was. */
  detail: string
}

export interface CountedExercise {
  name: string
  rows: CountedSet[]
  /** A run or a row: a duration was logged instead of sets. */
  timed?: string | null
}

/**
 * What was actually done, exercise by exercise.
 *
 * Anthony asked for this on the share card, and he is right that it is the
 * part worth posting: "7,340 lbs" is the size of a session and the exercise
 * list is the evidence. Nobody doubts a list of lifts.
 *
 * TWO RULES, BOTH ABOUT NOT LYING ON SOMEBODY'S STORY.
 *
 * An exercise with nothing ticked is left out entirely. The program said to
 * do it; the client did not. A plan is not an achievement, and a card listing
 * eight exercises when five were done is the one thing that would make a
 * friend who trains with them call it out.
 *
 * The TOP set, not the last and not an average. It is what a lifter quotes,
 * it is the honest high-water mark of the session, and it cannot be gamed by
 * a light final set. Ties go to the one with more reps, because 225x5 is a
 * better set than 225x3 and should be the one shown.
 *
 * The wording differs by kind on purpose, because each is the idiom for its
 * own kind of work: "225 lb × 5" is how a loaded set is written down and
 * "3 × 12" is how pull-ups are. Writing both the same way would be tidier and
 * would read wrong to the only people who will see it.
 */
export function exerciseLines(exercises: CountedExercise[]): ExerciseLine[] {
  const out: ExerciseLine[] = []
  for (const ex of exercises) {
    const name = ex.name.trim()
    if (!name) continue

    // Timed work logs a duration and has no sets to rank.
    if (ex.timed != null && String(ex.timed).trim() !== '') {
      out.push({ name, detail: String(ex.timed).trim() })
      continue
    }

    let sets = 0
    let topWeight = 0
    let topReps = 0
    let bestReps = 0
    for (const row of ex.rows) {
      if (!row.logged) continue
      const r = Number(row.reps)
      if (!Number.isFinite(r) || r <= 0) continue
      sets++
      if (r > bestReps) bestReps = r
      const w = Number(row.weight)
      if (!Number.isFinite(w) || w <= 0) continue
      if (w > topWeight || (w === topWeight && r > topReps)) {
        topWeight = w
        topReps = r
      }
    }

    if (sets === 0) continue
    out.push({
      name,
      detail: topWeight > 0 ? `${topWeight} lb × ${topReps}` : `${sets} × ${bestReps}`,
    })
  }
  return out
}

/** The label on the orange card. Null when there is nothing to celebrate. */
export function prHeadline(records: Array<{ exerciseName: string } & RecordHit>): string | null {
  const n = records.length
  if (n <= 0) return null
  return n === 1 ? '1 New PR' : `${n} New PRs`
}

/** What each kind of record is called, in the client's words. */
export function recordKindLabel(kind: RecordHit['kind']): string {
  switch (kind) {
    case 'weight':
      return 'Heaviest lift'
    case 'reps':
      return 'Most reps at this weight'
    case 'e1rm':
      return 'Strongest set'
  }
}

export interface RecordDetail {
  exercise: string
  kindLabel: string
  previous: string
  now: string
  /** The gain, already worded. Null when it cannot be stated honestly. */
  improvement: string | null
}

/**
 * One record, broken out for the detail sheet.
 *
 * The unit changes with the kind, which is the whole reason this is not a
 * template: a weight record improves by pounds, a rep record by reps, and an
 * estimated one-rep max by pounds that nobody actually lifted — so that last
 * one is always written as an estimate.
 */
export function recordDetail(record: { exerciseName: string } & RecordHit): RecordDetail {
  const unit = record.kind === 'reps' ? 'reps' : 'lb'
  const round = (n: number) => Math.round(n * 10) / 10
  const prev = round(record.previous)
  const now = round(record.value)
  const gain = round(now - prev)

  return {
    exercise: record.exerciseName,
    kindLabel: recordKindLabel(record.kind),
    previous: `${prev} ${unit}`,
    now: `${now} ${unit}`,
    // A record with no previous figure is a baseline, and judgeSet already
    // refuses to call those records — but if one ever reaches here, saying
    // "+70 lb" about somebody's first ever attempt would be a lie.
    improvement: prev > 0 && gain > 0 ? `+${gain} ${unit}` : null,
  }
}

/**
 * Something true to say when there was no record.
 *
 * Most sessions set no record, and most of those are the sessions that
 * actually build somebody — so this screen must never read as a consolation.
 * None of these mention records, trying, or next time.
 *
 * Deterministic from a seed rather than random, so it does not change under
 * the client while they are reading it.
 */
const LINES = [
  'Another promise kept.',
  'You showed up.',
  'Progress earned.',
  'Built by discipline.',
  'Every rep counts.',
  'Keep showing up.',
  'One workout closer.',
]

export function encouragement(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return LINES[h % LINES.length]
}
