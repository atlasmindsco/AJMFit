/**
 * Match a coached client to a starting template, and say what is wrong with it.
 *
 * The matching half is a lookup, not intelligence: goal + days + location
 * identifies one seeded program out of 69, and it will be right most of the
 * time. Dressing that up as a recommendation engine would add a screen and a
 * confidence score to a database query.
 *
 * The flags are the half worth having. They are the thirty seconds of reading
 * a client's form that a coach does before changing anything — the knee that
 * will not like day one's squats, the barbell they do not own, the session
 * that runs twenty minutes past the time they said they had. Each one is a
 * plain rule over data already collected, and each one only ever says what it
 * noticed. None of them changes a program: a flag that silently swaps an
 * exercise is a bug with a nice name.
 */

import type { OnboardingAnswers } from '@/lib/onboarding'
import { splitsFor, type BlueprintGoal, type BlueprintLocation } from '@/lib/splits'

export interface MatchInput {
  answers: OnboardingAnswers
  /** Exercise names in the matched program, for the injury scan. */
  exerciseNames?: string[]
  /**
   * How long an average day runs, in minutes, for the time check.
   *
   * Passed in rather than worked out here. This used to be an exercise COUNT
   * that a private `estimateMinutes` multiplied by nine — the third of three
   * duration formulas in the codebase, all disagreeing. The caller has the
   * sets and rest already, so it uses the one real estimator in
   * lib/builder-rules.ts and hands over the answer.
   */
  minutesPerDay?: number
}

export interface Flag {
  /** How loudly to say it. `check` is informational; `warn` wants a decision. */
  level: 'warn' | 'check'
  title: string
  detail: string
}

export interface Match {
  goal: BlueprintGoal | null
  location: BlueprintLocation | null
  days: number | null
  splitKey: string | null
  splitLabel: string | null
  /** Plain sentences for "recommended because". */
  because: string[]
  flags: Flag[]
  /** False when the assessment is too incomplete to match anything. */
  ready: boolean
}

const GOALS: BlueprintGoal[] = ['muscle', 'strength', 'lean_out']
const LOCATIONS: BlueprintLocation[] = ['gym', 'home']

const GOAL_WORDS: Record<BlueprintGoal, string> = {
  muscle: 'building muscle',
  strength: 'getting stronger',
  lean_out: 'leaning out',
}

/**
 * Body parts, and the words that mean a movement loads them.
 *
 * Deliberately crude. The job is to put the right client's form in front of
 * the coach, not to diagnose anyone: a false flag costs a glance, a missed one
 * costs a knee.
 */
const BODY_PART_MOVEMENTS: Array<{ part: string; says: string[]; loads: string[] }> = [
  { part: 'knee', says: ['knee', 'acl', 'mcl', 'meniscus', 'patell'], loads: ['squat', 'lunge', 'leg press', 'leg extension', 'step up', 'split squat', 'jump', 'sprint'] },
  { part: 'lower back', says: ['lower back', 'low back', 'lumbar', 'disc', 'sciatic', 'herniat'], loads: ['deadlift', 'good morning', 'bent over', 'barbell row', 'back extension', 'squat', 'clean'] },
  { part: 'shoulder', says: ['shoulder', 'rotator', 'cuff', 'labrum', 'ac joint'], loads: ['overhead press', 'shoulder press', 'bench press', 'dip', 'lateral raise', 'upright row', 'snatch', 'push-up', 'push up'] },
  { part: 'elbow', says: ['elbow', 'tennis elbow', 'golfer', 'tricep tendon'], loads: ['curl', 'tricep', 'skullcrusher', 'dip', 'chin-up', 'chin up', 'pull-up', 'pull up'] },
  { part: 'wrist', says: ['wrist', 'carpal'], loads: ['front squat', 'push-up', 'push up', 'curl', 'press'] },
  { part: 'hip', says: ['hip', 'groin', 'labral'], loads: ['squat', 'lunge', 'deadlift', 'hip thrust', 'split squat'] },
  { part: 'neck', says: ['neck', 'cervical'], loads: ['shrug', 'overhead press', 'upright row'] },
  { part: 'ankle', says: ['ankle', 'achilles', 'plantar'], loads: ['lunge', 'calf raise', 'jump', 'sprint', 'step up'] },
]

/** Equipment a home trainer will not have, and the words that mean it. */
const GYM_ONLY = ['barbell', 'smith machine', 'cable', 'lat pulldown', 'leg press', 'hack squat', 'pec deck', 'leg extension', 'leg curl', 'machine']

const lower = (s: string | undefined) => (s ?? '').toLowerCase()

export function matchProgram(input: MatchInput): Match {
  const a = input.answers
  const goal = GOALS.includes(a.goal as BlueprintGoal) ? (a.goal as BlueprintGoal) : null
  const location = LOCATIONS.includes(a.location as BlueprintLocation) ? (a.location as BlueprintLocation) : null
  const days = a.daysPerWeek ? Number(a.daysPerWeek) : null
  const beginner = a.experience === 'new'

  const splits = days ? splitsFor(days, goal, beginner) : []
  const split = splits[0] ?? null

  const because: string[] = []
  if (days) because.push(`Trains ${days} days a week`)
  if (a.experience) {
    because.push(
      a.experience === 'new'
        ? 'New to training, so no sprinting or jumping in week one'
        : a.experience === 'returning'
        ? 'Coming back after a break'
        : 'Already training consistently'
    )
  }
  if (goal) because.push(`Wants ${GOAL_WORDS[goal]}`)
  if (location) because.push(location === 'home' ? 'Training at home with dumbbells' : 'Has a full gym')

  const flags: Flag[] = []
  const names = (input.exerciseNames ?? []).map((n) => n.toLowerCase())

  /* 1. An injury against the movements the program actually prescribes. */
  const injuries = lower(a.injuries)
  if (injuries.trim()) {
    for (const rule of BODY_PART_MOVEMENTS) {
      if (!rule.says.some((w) => injuries.includes(w))) continue
      const hits = Array.from(new Set(names.filter((n) => rule.loads.some((m) => n.includes(m)))))
      if (hits.length) {
        flags.push({
          level: 'warn',
          title: `${rule.part} — ${hits.length} exercise${hits.length === 1 ? '' : 's'} load it`,
          detail: `They mentioned the ${rule.part}. This program prescribes ${hits.slice(0, 4).join(', ')}${hits.length > 4 ? `, and ${hits.length - 4} more` : ''}.`,
        })
      } else {
        flags.push({
          level: 'check',
          title: `${rule.part} mentioned`,
          detail: 'Nothing in this program obviously loads it, but read what they wrote.',
        })
      }
    }
    if (!flags.length) {
      flags.push({
        level: 'check',
        title: 'They wrote something under injuries',
        detail: 'It did not match anything automatically. Worth reading before you assign.',
      })
    }
  }

  /* 2. Equipment the program needs and they said they do not have. */
  if (location === 'home' && names.length) {
    const needs = Array.from(new Set(names.filter((n) => GYM_ONLY.some((g) => n.includes(g)))))
    if (needs.length) {
      flags.push({
        level: 'warn',
        title: `${needs.length} exercise${needs.length === 1 ? '' : 's'} need gym equipment`,
        detail: `They train at home. This program uses ${needs.slice(0, 3).join(', ')}${needs.length > 3 ? `, and ${needs.length - 3} more` : ''}.`,
      })
    }
  }

  /* 3. A session that runs past the time they said they had. */
  const cap = a.sessionMinutes ? Number(a.sessionMinutes) : null
  if (cap && input.minutesPerDay) {
    const est = input.minutesPerDay
    if (est > cap + 10) {
      flags.push({
        level: 'warn',
        title: `Sessions run about ${est} minutes`,
        detail: `They said they have ${cap}. Dropping an exercise or pairing two as a superset closes the gap.`,
      })
    }
  }

  /* 4. Experience against the shape of the week. */
  if (beginner && days && days >= 5) {
    flags.push({
      level: 'warn',
      title: `New to training and asking for ${days} days`,
      detail: 'Starting at 3 or 4 holds up better. Worth a sentence about why when you assign it.',
    })
  }
  if (a.experience === 'consistent' && days && days <= 2) {
    flags.push({
      level: 'check',
      title: 'Trains consistently but only has 2 days',
      detail: 'Full body twice a week is right, but say so — it will look light to them.',
    })
  }

  /* 5. A goal the free-text answer contradicts or adds to. */
  const extra = lower(a.anythingElse)
  if (extra.includes('run') || extra.includes('marathon') || extra.includes('5k')) {
    flags.push({
      level: 'check',
      title: 'They mentioned running',
      detail: 'There are hybrid tracks that fold running in, if that matters to them.',
    })
  }

  return {
    goal,
    location,
    days,
    splitKey: split?.key ?? null,
    splitLabel: split?.label ?? null,
    because,
    flags,
    ready: Boolean(goal && location && days && split),
  }
}
