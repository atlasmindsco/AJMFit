/**
 * What a client actually did, session by session.
 *
 * 1,371 logged sets, and until now no coach screen displayed a single one.
 * Two functions read the table — the stall detector and the brief builder —
 * and both reduce it to a verdict. There was no way to open Monday and see
 * what somebody benched, which is the difference between knowing a workout
 * happened and being able to coach it.
 *
 * Shapes only. The reading lives in lib/admin.ts with the other coach
 * queries; this file holds the rules so a verifier can reach them, which is
 * the lesson from lib/progress-lines.ts.
 */

export interface CoachSet {
  exerciseName: string
  /** Null on a bodyweight movement the client logged at zero. */
  weight: number | null
  reps: number | null
  rir: number | null
  setNumber: number
  /** The exercise this replaced, when they swapped mid-session. */
  swappedFrom: string | null
  isIntensitySet: boolean
}

export interface CoachExercise {
  name: string
  swappedFrom: string | null
  sets: CoachSet[]
  /**
   * How this compares with the last time they did it, or null when there is
   * nothing to compare against. The only interpretation on the screen, and it
   * is arithmetic on two numbers rather than a judgement.
   */
  change: { from: number; to: number; direction: 'up' | 'down' } | null
}

export interface CoachSession {
  workoutId: string
  date: string
  dayName: string | null
  /** Null when the session was never closed out. */
  durationSeconds: number | null
  exercises: CoachExercise[]
}

/** Heaviest working set, ignoring intensity techniques. */
export function topWeight(sets: CoachSet[]): number {
  let best = 0
  for (const s of sets) {
    if (s.isIntensitySet) continue
    const w = Number(s.weight) || 0
    if (w > best) best = w
  }
  return best
}

/**
 * Group raw sets into sessions, newest first, with each exercise compared
 * against the previous time the client did it.
 *
 * The comparison walks backwards through the same client's history, so
 * "down from 80" means down from THEIR last attempt, not from a target or an
 * average. Nothing here infers effort, adherence or intent.
 */
export function buildSessions(
  rows: Array<
    CoachSet & { workoutId: string; date: string; dayName: string | null; durationSeconds: number | null }
  >
): CoachSession[] {
  const byWorkout = new Map<string, CoachSession>()
  for (const r of rows) {
    let session = byWorkout.get(r.workoutId)
    if (!session) {
      session = {
        workoutId: r.workoutId,
        date: r.date,
        dayName: r.dayName,
        durationSeconds: r.durationSeconds,
        exercises: [],
      }
      byWorkout.set(r.workoutId, session)
    }
    let ex = session.exercises.filter((e) => e.name === r.exerciseName)[0]
    if (!ex) {
      ex = { name: r.exerciseName, swappedFrom: r.swappedFrom, sets: [], change: null }
      session.exercises.push(ex)
    }
    ex.sets.push(r)
  }

  const sessions = Array.from(byWorkout.values()).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  )
  for (const s of sessions) {
    for (const e of s.exercises) {
      e.sets.sort((a, b) => a.setNumber - b.setNumber)
    }
  }

  // Oldest first, so each exercise can be compared with the attempt before it.
  const lastSeen: Record<string, number> = {}
  for (let i = sessions.length - 1; i >= 0; i--) {
    for (const e of sessions[i].exercises) {
      const now = topWeight(e.sets)
      const before = lastSeen[e.name]
      if (now > 0 && before !== undefined && before > 0 && now !== before) {
        e.change = { from: before, to: now, direction: now > before ? 'up' : 'down' }
      }
      if (now > 0) lastSeen[e.name] = now
    }
  }
  return sessions
}

/** "52 min", or null when the session was never closed. */
export function durationLabel(seconds: number | null): string | null {
  if (seconds == null || !(seconds > 0)) return null
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  return `${h}h ${mins - h * 60}m`
}

/** "185 × 10", or "BW × 12" when the body is the load. */
export function setLabel(s: CoachSet): string {
  const reps = s.reps ?? 0
  const w = Number(s.weight) || 0
  return w > 0 ? `${w} × ${reps}` : `BW × ${reps}`
}
