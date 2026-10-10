/**
 * What is worth telling a client about the program they just built.
 *
 * This NEVER blocks a save. canSave owns the two things the rest of the app
 * genuinely cannot represent; everything here is advice, and a client who
 * wants an arms-only week is allowed to have one. The job is to make sure
 * nobody ends up with a week that quietly does nothing for their back because
 * they did not notice, not to referee their choices.
 *
 * THE THRESHOLDS ARE MEASURED, NOT INVENTED
 *
 * Every number below comes from the 68 programs AJM Fit already ships, read
 * out of production across 314 training days:
 *
 *   weekly sets per group   chest 6-21  back 6-27  shoulders 2-17
 *                           arms 2-18   legs 12-47  core 2-6
 *   groups never trained    0 of 68 programs leave any group empty
 *   chest:back ratio        1.0 - 2.4
 *   biggest group's share   20% - 65% of the week
 *   minutes per day         1 - 61
 *   a strength day with
 *   one exercise            never; the twelve that exist are all cardio
 *   same exercise twice
 *   in a day                three days, and that was a bug, now fixed
 *
 * So the contract a verifier enforces: run this over all 68 and NOT ONE
 * warning may fire. A health check that tells a client the program their coach
 * sells them is wrong has failed at something more important than being right.
 * Notes are observations and may fire anywhere.
 */

import { MUSCLE_GROUPS, estimateMinutes, type LibraryExercise } from '@/lib/builder-rules'

export type Severity = 'warn' | 'note'

export interface Finding {
  /** Stable id, for tests and for keys. */
  code: string
  severity: Severity
  /** One line, in the client's language. No jargon, no set-volume theory. */
  title: string
  /** What to do about it, or why it matters. Optional. */
  detail?: string
  /** Index into the program's days, when the finding belongs to one. */
  dayIndex?: number
}

export interface HealthInput {
  days: Array<{
    name: string
    exercises: Array<{ exerciseName: string; sets: number; restSeconds: number }>
  }>
}

/** Weekly sets per muscle group, and which day each group was trained on. */
export interface Volume {
  setsByGroup: Record<string, number>
  daysByGroup: Record<string, number[]>
  totalSets: number
}

export function volumeOf(
  input: HealthInput,
  lookup: (name: string) => LibraryExercise | null
): Volume {
  const setsByGroup: Record<string, number> = {}
  const daysByGroup: Record<string, number[]> = {}
  let totalSets = 0

  for (const g of MUSCLE_GROUPS) {
    setsByGroup[g.key] = 0
    daysByGroup[g.key] = []
  }

  input.days.forEach((day, i) => {
    for (const ex of day.exercises) {
      const lib = lookup(ex.exerciseName)
      totalSets += ex.sets
      if (!lib) continue
      // PRIMARY muscles only. Counting secondaries would credit a bench press
      // towards shoulders and triceps, and then almost nothing ever looks
      // undertrained — which is the failure mode that makes a check useless.
      for (const g of MUSCLE_GROUPS) {
        if (lib.primaryMuscles.some((m) => g.muscles.includes(m))) {
          setsByGroup[g.key] += ex.sets
          if (!daysByGroup[g.key].includes(i)) daysByGroup[g.key].push(i)
          break
        }
      }
    }
  })

  return { setsByGroup, daysByGroup, totalSets }
}

const label = (key: string) => MUSCLE_GROUPS.find((g) => g.key === key)?.label ?? key

/** The library's own floor for each group, so "thin" means thinner than anything shipped. */
const SHIPPED_FLOOR: Record<string, number> = {
  chest: 6,
  back: 6,
  shoulders: 2,
  arms: 2,
  legs: 12,
  core: 2,
}

/**
 * Review a built program.
 *
 * Ordered most-worth-reading first, warnings before notes. Returns an empty
 * array for a program with nothing to say, which is the common case for a
 * copied program the client swapped two exercises in.
 */
export function reviewProgram(
  input: HealthInput,
  lookup: (name: string) => LibraryExercise | null
): Finding[] {
  const trainingDays = input.days.filter((d) => d.exercises.length > 0)
  if (trainingDays.length === 0) return []

  const vol = volumeOf(input, lookup)
  const warns: Finding[] = []
  const notes: Finding[] = []

  /* ── Whole-week balance ────────────────────────────────────────────── */

  // A group with nothing at all. None of the 68 does this, which is what makes
  // it worth saying out loud rather than leaving the client to notice in a
  // mirror six weeks later.
  const missing = MUSCLE_GROUPS.filter((g) => vol.setsByGroup[g.key] === 0)
  if (missing.length > 0 && missing.length < MUSCLE_GROUPS.length) {
    const names = missing.map((g) => g.label.toLowerCase())
    warns.push({
      code: 'missing_group',
      severity: 'warn',
      title:
        names.length === 1
          ? `Nothing for ${names[0]} all week`
          : `Nothing for ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]} all week`,
      detail:
        'Every AJM Fit program trains all six. Add an exercise, or leave it if you cover it elsewhere.',
    })
  }

  // Push against pull. The imbalance that actually causes people trouble, and
  // the library stays inside 2.4 even on a bodybuilding split.
  const chest = vol.setsByGroup.chest
  const back = vol.setsByGroup.back
  if (chest > 0 && back > 0) {
    const ratio = Math.max(chest, back) / Math.min(chest, back)
    if (ratio > 2.5) {
      const heavy = chest > back ? 'pushing' : 'pulling'
      const light = chest > back ? 'back' : 'chest'
      warns.push({
        code: 'push_pull_imbalance',
        severity: 'warn',
        title: `A lot more ${heavy} than the rest`,
        detail: `${chest} sets of chest against ${back} of back. More ${light} work would even it out — and it is usually the shoulders that complain first.`,
      })
    }
  }

  // One group eating the week. 65% is the most any shipped program gives to
  // legs; past 70 it is a specialisation, which is fine but worth naming.
  if (vol.totalSets > 0) {
    for (const g of MUSCLE_GROUPS) {
      const share = vol.setsByGroup[g.key] / vol.totalSets
      if (share > 0.7) {
        notes.push({
          code: 'dominant_group',
          severity: 'note',
          title: `${g.label} is most of your week`,
          detail: `${Math.round(share * 100)}% of your sets. Deliberate is fine — accidental is worth a look.`,
        })
      }
    }
  }

  // Thinner than anything AJM Fit ships, but not empty.
  for (const g of MUSCLE_GROUPS) {
    const sets = vol.setsByGroup[g.key]
    if (sets > 0 && sets < SHIPPED_FLOOR[g.key]) {
      notes.push({
        code: 'thin_group',
        severity: 'note',
        title: `Only ${sets} ${sets === 1 ? 'set' : 'sets'} of ${g.label.toLowerCase()} a week`,
        detail: `The lightest AJM Fit program gives it ${SHIPPED_FLOOR[g.key]}. Enough to maintain, not much to build on.`,
      })
    }
  }

  /* ── Day by day ────────────────────────────────────────────────────── */

  input.days.forEach((day, i) => {
    if (day.exercises.length === 0) return

    // Zero rest on a heavy compound. Almost always a client tapping through
    // the rest presets too fast.
    //
    // Any compound, not just barbell ones: a dumbbell squat is every bit as
    // heavy, and the first version of this check missed it entirely — the
    // simulation of a real client's home program zeroing their rest produced
    // nothing to flag, because that program uses dumbbells throughout.
    //
    // But only STRENGTH compounds. The library has 56 rows with no rest and
    // every one is a cardio or plyometric drill, including one — the Linear
    // Acceleration Wall Drill — that the library calls a compound. Resting
    // between wall drills is not a thing.
    const noRest = day.exercises.filter((ex) => {
      if (ex.restSeconds > 0) return false
      const lib = lookup(ex.exerciseName)
      if (!lib || lib.mechanic !== 'compound') return false
      return !['cardio', 'stretching', 'plyometrics'].includes(lib.category)
    })
    if (noRest.length > 0) {
      warns.push({
        code: 'no_rest_on_heavy',
        severity: 'warn',
        title: `No rest set on ${noRest[0].exerciseName}`,
        detail: 'A heavy compound needs a couple of minutes. Back-to-back sets will cost you the weight.',
        dayIndex: i,
      })
    }

    // The same exercise twice. Three library days did this and it was a bug.
    const seen = new Set<string>()
    const dupe = day.exercises.find((ex) => {
      if (seen.has(ex.exerciseName)) return true
      seen.add(ex.exerciseName)
      return false
    })
    if (dupe) {
      warns.push({
        code: 'duplicate_exercise',
        severity: 'warn',
        title: `${dupe.exerciseName} is in ${day.name || `day ${i + 1}`} twice`,
        detail: 'Probably not what you meant. Merge the sets, or swap one for something else.',
        dayIndex: i,
      })
    }

    // Longer than any shipped day. The estimate is rough and says so
    // everywhere it appears, so the threshold sits well clear of the real max.
    const minutes = estimateMinutes(
      day.exercises.map((e) => ({ sets: e.sets, restSeconds: e.restSeconds }))
    )
    if (minutes > 75) {
      notes.push({
        code: 'long_day',
        severity: 'note',
        title: `${day.name || `Day ${i + 1}`} is roughly ${minutes} minutes`,
        detail: 'The longest AJM Fit session is about an hour. Long sessions are the ones people skip.',
        dayIndex: i,
      })
    }

    // A strength day with a single exercise. The twelve one-exercise days in
    // the library are all cardio, so this only fires on lifting.
    if (day.exercises.length === 1) {
      const lib = lookup(day.exercises[0].exerciseName)
      const isCardio = lib?.category === 'cardio' || lib?.category === 'stretching'
      if (!isCardio) {
        notes.push({
          code: 'single_exercise_day',
          severity: 'note',
          title: `${day.name || `Day ${i + 1}`} has one exercise`,
          detail: 'Fine as a quick session. Two or three gets more out of the trip.',
          dayIndex: i,
        })
      }
    }
  })

  return [...warns, ...notes]
}

/** A one-line summary for a header, or null when there is nothing to say. */
export function healthSummary(findings: Finding[]): string | null {
  const warns = findings.filter((f) => f.severity === 'warn').length
  const notes = findings.length - warns
  if (warns === 0 && notes === 0) return null
  if (warns === 0) return `${notes} thing${notes === 1 ? '' : 's'} worth a look`
  return `${warns} thing${warns === 1 ? '' : 's'} to check${notes > 0 ? `, ${notes} worth a look` : ''}`
}
