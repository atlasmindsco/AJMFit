'use client'

/**
 * What the studio chrome needs to know about a workout.
 *
 * Two things, and they are not the same thing:
 *
 *   sessionActive — "the client is on the training screen right now, keep it
 *   clear". The chat bubble and the feedback button float over every screen
 *   in the studio, and during a set they sit on top of the one screen that
 *   has earned the whole display: one exercise, the weight, the reps, and
 *   what was lifted last time.
 *
 *   active — "a workout is open somewhere". This one is true on Food, on
 *   Coach, on Profile, and it is the thing that was missing. Every set is
 *   written to the database as it is logged and the training screen
 *   rehydrates the whole session on mount, so nothing was ever lost — but no
 *   other screen mentioned it, and a workout you cannot see is one you
 *   believe you have lost.
 *
 * The flag lives in the layout because that is where the floating buttons and
 * the resume bar are rendered, and every screen is a child of it. A context
 * rather than a global or a body class, so React actually re-renders.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchActiveWorkout } from '@/lib/workout'
import type { ActiveWorkout } from '@/lib/active-workout'

interface SessionChrome {
  /** True while a workout is actually being trained on screen. */
  sessionActive: boolean
  setSessionActive: (active: boolean) => void
  /** The open workout, wherever the client happens to be. Null when there is none. */
  active: ActiveWorkout | null
  /** Re-read it. Called after starting, finishing or abandoning one. */
  refreshActive: () => void
}

const Ctx = createContext<SessionChrome>({
  sessionActive: false,
  setSessionActive: () => {},
  active: null,
  refreshActive: () => {},
})

export function SessionChromeProvider({
  userId,
  children,
}: {
  userId: string | null
  children: React.ReactNode
}) {
  const [sessionActive, setSessionActive] = useState(false)
  const [active, setActive] = useState<ActiveWorkout | null>(null)
  const [nonce, setNonce] = useState(0)

  const refreshActive = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!userId) {
      setActive(null)
      return
    }
    let live = true
    fetchActiveWorkout(userId)
      .then((w) => {
        if (live) setActive(w)
      })
      // A bar that cannot load is a bar that is not shown. It must never
      // break the screen it is sitting on.
      .catch(() => {
        if (live) setActive(null)
      })
    return () => {
      live = false
    }
  }, [userId, nonce])

  /* Re-read when the tab comes back to the front.
     The client trains on their phone, switches to a podcast, comes back. The
     session may have been finished or abandoned in another tab in between,
     and a resume bar for a workout that is already over is worse than none. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshActive()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshActive])

  const value = useMemo(
    () => ({ sessionActive, setSessionActive, active, refreshActive }),
    [sessionActive, active, refreshActive]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Read by the layout to decide what to show, and called by the training
 * screen to say when it has started, finished or abandoned a session.
 *
 * Safe outside the provider: a screen that never calls the setter leaves the
 * chrome exactly as it was, and `active` stays null.
 */
export function useSessionChrome(): SessionChrome {
  return useContext(Ctx)
}
