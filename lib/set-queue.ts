/**
 * Sets that failed to save, kept until they do.
 *
 * `saveSet` throws when the write fails and every caller handled it with
 * `console.error`. The green tick beside a set row is driven by local state,
 * not by the write landing, so on one bar of signal a client could log a whole
 * session, watch every row go green, and lose all of it. Silent data loss while
 * showing a success indicator is the worst failure mode in the app.
 *
 * This is deliberately not a service worker. The realistic gym failure is a
 * request that times out while the tab is open and the client is standing
 * there, which a retry queue in the page handles completely. Background sync
 * for a closed tab is a bigger piece of work and solves a rarer problem.
 *
 * Writes are idempotent — `saveSet` upserts on
 * (workout, exercise, set number, intensity) — so replaying a queued set that
 * actually did land is harmless. That is what makes retrying safe at all.
 */

const KEY = 'ajmfit_pending_sets'
/** Beyond this a queue is a sign of something badly wrong, not a blip. */
const MAX = 200

export interface PendingSet {
  /** Identifies the slot, so a newer edit of the same set replaces an older one. */
  slot: string
  /** The SaveSetInput, stored whole. */
  payload: unknown
  queuedAt: number
  attempts: number
}

function read(): PendingSet[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Private window, blocked storage, or corrupt JSON. An unreadable queue is
    // an empty one; it must never stop the session.
    return []
  }
}

function write(rows: PendingSet[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX)))
  } catch {
    // Quota or blocked storage. Nothing to do but carry on.
  }
}

export function queueSize(): number {
  return read().length
}

/**
 * Hold a failed set.
 *
 * Keyed by slot so that correcting a set while offline leaves one row holding
 * the latest numbers, rather than a stack of edits that replay in order and
 * briefly restore values the client already changed.
 */
export function enqueue(slot: string, payload: unknown): number {
  const rows = read().filter((r) => r.slot !== slot)
  rows.push({ slot, payload, queuedAt: Date.now(), attempts: 0 })
  write(rows)
  return rows.length
}

export function clearQueue(): void {
  write([])
}

/**
 * Try everything in the queue, oldest first.
 *
 * Stops at the first failure rather than grinding through the whole queue on a
 * connection that is still down — the next flush will pick up where this one
 * left off. Returns what is left so the UI can say so.
 */
export async function flushQueue(
  send: (payload: unknown) => Promise<unknown>
): Promise<{ sent: number; remaining: number }> {
  const rows = read()
  if (rows.length === 0) return { sent: 0, remaining: 0 }

  let sent = 0
  for (const row of rows) {
    try {
      await send(row.payload)
      sent++
    } catch {
      row.attempts++
      break
    }
  }

  const remaining = rows.slice(sent)
  write(remaining)
  return { sent, remaining: remaining.length }
}
