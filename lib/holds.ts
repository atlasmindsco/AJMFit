/**
 * Exercises you hold rather than repeat.
 *
 * A plank prescribed as "3 × 12" is nonsense, and it is what the builder
 * produced: the default prescription asked how many reps of an isometric you
 * wanted. Alex flagged it from a real session. A plank is seconds.
 *
 * THE LIBRARY ALREADY KNEW. Every exercise carries a `force` of push, pull or
 * static, and static is exactly this: 104 of the 873, of which the stretches
 * were already treated as timed and the rest — Plank, Side Bridge, the
 * isometric neck work, Plate Pinch — were being asked for rep counts. No new
 * taxonomy, no name matching, just a field that was already there and unread.
 *
 * Deliberately NOT the same thing as `isTimedPrescription` in lib/conditioning.
 * That covers a 20-minute run or a 10-minute stretch: one duration for the
 * whole exercise. A hold is per SET — three planks of a minute each is three
 * entries, not one — so it keeps the set rows and swaps the rep box for
 * seconds.
 */

export interface HoldCandidate {
  force?: string | null
}

/** Held, not repeated. */
export function isHold(exercise: HoldCandidate | null | undefined): boolean {
  return exercise?.force === 'static'
}

/**
 * The durations offered as one tap.
 *
 * Alex asked for 60, 90 and two minutes. 30 and 45 are below them because a
 * minute is a long time in a side plank when you are starting, and a preset
 * list whose smallest option is already too hard sends people back to the
 * keyboard — which was the original complaint.
 */
export const HOLD_PRESETS = [30, 45, 60, 90, 120]

/** "60 sec", "2 min", "1 min 30 sec" — how a prescription reads. */
export function formatHold(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (s === 0) return `${m} min`
  return `${m} min ${s} sec`
}

/** Short form for a button: "60s", "90s", "2m". */
export function holdLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = seconds / 60
  return Number.isInteger(m) ? `${m}m` : `${seconds}s`
}

/**
 * Read seconds back out of a prescription.
 *
 * Handles what the builder writes and what a client might type: "60 sec",
 * "2 min", "90", "1 min 30 sec". Returns null when there is no duration in
 * there at all, so a caller can fall back rather than log a zero.
 */
export function parseHoldSeconds(reps: string | null | undefined): number | null {
  const text = String(reps ?? '').trim().toLowerCase()
  if (!text) return null

  let total = 0
  let found = false
  const min = /(\d+(?:\.\d+)?)\s*(?:min|minute)/.exec(text)
  if (min) {
    total += Math.round(parseFloat(min[1]) * 60)
    found = true
  }
  const sec = /(\d+(?:\.\d+)?)\s*(?:sec|second|s\b)/.exec(text)
  if (sec) {
    total += Math.round(parseFloat(sec[1]))
    found = true
  }
  if (found) return total

  // A bare number on a hold means seconds.
  const bare = /^(\d+(?:\.\d+)?)$/.exec(text)
  if (bare) return Math.round(parseFloat(bare[1]))

  // A range like "30-60" — take the top, which is what the client is working to.
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(text)
  if (range) return Number(range[2])

  return null
}

/** The prescription a newly added hold gets. */
export const DEFAULT_HOLD_SECONDS = 45

/**
 * Turn a rep count that should never have been one into seconds.
 *
 * The seeded library prescribes the Plank by rep count, because the generator
 * applies a goal's scheme by ROLE and the plank's role is "core" like any
 * crunch: 2x10 on Build Strength, 3x15 on Build Muscle, 3x20 on Lean Out. 45
 * slots across the 68 programs, and every one of them reads as nonsense.
 *
 * Three seconds a "rep", which is roughly how an isometric is counted and
 * which lands those three schemes exactly on 30, 45 and 60 seconds — the
 * presets, and a sane ladder. It also preserves what the goal meant: strength
 * holds least in total, lean-out most.
 *
 * Mirrored in tools/ops/seed-blueprint-programs.mjs, which cannot import this.
 */
export function holdSecondsFromReps(reps: number): number {
  const seconds = Math.round(reps * 3)
  // Clamp to something a person can actually do, in case a scheme changes.
  return Math.min(120, Math.max(15, seconds))
}
