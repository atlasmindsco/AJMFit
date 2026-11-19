'use client'

/**
 * "A workout is running — keep the screen clear."
 *
 * The chat bubble and the feedback button float over every screen in the
 * studio, including the middle of a session. Both are there for the app's
 * benefit rather than the client's, and during a set they sit on top of the
 * one screen that has earned the whole display: one exercise, the weight, the
 * reps, and what you lifted last time.
 *
 * The flag lives in the layout because that is where those buttons are
 * rendered, and the session screen is a child of it. A context rather than a
 * global or a body class, so React actually re-renders when it changes.
 */

import { createContext, useContext, useMemo, useState } from 'react'

interface SessionChrome {
  /** True while a workout is actually running, not merely being looked at. */
  sessionActive: boolean
  setSessionActive: (active: boolean) => void
}

const Ctx = createContext<SessionChrome>({
  sessionActive: false,
  setSessionActive: () => {},
})

export function SessionChromeProvider({ children }: { children: React.ReactNode }) {
  const [sessionActive, setSessionActive] = useState(false)
  const value = useMemo(() => ({ sessionActive, setSessionActive }), [sessionActive])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Read by the layout to decide what to hide, and called by the session screen
 * to say when it has started and finished.
 *
 * Safe outside the provider: a screen that never calls the setter leaves the
 * chrome exactly as it was.
 */
export function useSessionChrome(): SessionChrome {
  return useContext(Ctx)
}
