/**
 * Whether the daily jobs are actually running.
 *
 * They were not, for five weeks, and nothing said so. `cron_runs` held one
 * row — the digest, 14 October 2026 — while `notifications_sent` stayed
 * empty, so no reminder ever reached a client. That single run even wrote the
 * problem in its own summary: "1 client waiting on a reply · 8 gone quiet".
 *
 * The schedule moved to GitHub Actions, which emails on failure. This is the
 * second line of defence: a job that silently stops is visible on the
 * dashboard the coach already opens, rather than in an email that stops
 * arriving — because an absent email is exactly what nobody notices.
 */

export interface CronRun {
  job: string
  ran_at: string
  ok: boolean | null
}

/** A daily job that has not run in this long is broken, not late. */
export const STALE_AFTER_HOURS = 36

export interface CronHealth {
  job: string
  hoursSince: number | null
  stale: boolean
}

/** One entry per job we expect to see, newest run only. */
export function cronHealth(runs: CronRun[], expect: string[], now: Date = new Date()): CronHealth[] {
  return expect.map((job) => {
    const latest = runs
      .filter((r) => r.job === job && r.ok !== false)
      .map((r) => Date.parse(r.ran_at))
      .filter((t) => !isNaN(t))
      .sort((a, b) => b - a)[0]
    if (latest === undefined) return { job, hoursSince: null, stale: true }
    const hours = Math.floor((now.getTime() - latest) / 3600000)
    return { job, hoursSince: hours, stale: hours >= STALE_AFTER_HOURS }
  })
}

/** What to say about it, or null when everything is running. */
export function cronWarning(health: CronHealth[]): string | null {
  const broken = health.filter((h) => h.stale)
  if (broken.length === 0) return null
  return broken
    .map((h) =>
      h.hoursSince === null
        ? `${h.job} has never run`
        : `${h.job} last ran ${Math.floor(h.hoursSince / 24)} days ago`
    )
    .join(' · ')
}
