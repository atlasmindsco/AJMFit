/**
 * Keep the screen on while a workout is running.
 *
 * A phone sleeps about thirty seconds in, which during a session means the
 * client unlocks it between every set with chalky or wet hands, and the rest
 * countdown is behind that lock screen. The Screen Wake Lock API exists for
 * exactly this and costs one call.
 *
 * Unsupported on some browsers (notably older iOS Safari), so every path here
 * is optional and failure is silent — a session must never break because the
 * screen would not stay on.
 */

interface Sentinel {
  release: () => Promise<void>
  released: boolean
  addEventListener: (type: string, fn: () => void) => void
}

let sentinel: Sentinel | null = null

function api(): { request: (type: 'screen') => Promise<Sentinel> } | null {
  if (typeof navigator === 'undefined') return null
  const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
  return wl ?? null
}

export async function acquireWakeLock(): Promise<void> {
  const wl = api()
  if (!wl || sentinel) return
  try {
    sentinel = await wl.request('screen')
    // The browser drops the lock whenever the tab is hidden — switching to the
    // Food tab, taking a call — and does not restore it on return. Without
    // this the lock survives exactly until the first interruption.
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch {
    // Denied, unsupported, or the page is not visible. Not worth a message.
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!sentinel) return
  try {
    await sentinel.release()
  } catch {
    // Already gone.
  }
  sentinel = null
}

/** True when a lock is currently held, for re-acquiring on tab focus. */
export function hasWakeLock(): boolean {
  return sentinel !== null
}
