'use client'

/**
 * "You still have a workout running."
 *
 * THE GAP THIS CLOSES. Resuming already worked. Every set is written to the
 * database as it is logged, with a retry queue behind it, and the training
 * screen rehydrates the whole session when it mounts. Nothing was ever lost.
 *
 * But nothing anywhere else said so. Open Food mid-session and the workout
 * vanishes as far as the client can tell — there is no banner, no card, no
 * indicator, and the only way back is to guess that tapping Today and then
 * the day again will pick up where you left off. Anthony reported it as his
 * workout disappearing, which is exactly the right word for it: a session
 * you cannot see is one you have lost.
 *
 * So this is not a persistence feature. It is the sentence that was missing.
 *
 * Deliberately one bar, on the screens that are not the workout itself, and
 * it takes the place of the chat bubble and the feedback button rather than
 * joining them — three floating things in one corner is how the bottom of
 * this app got crowded in the first place.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { abandonWarning, elapsedLabel, progressLine, type ActiveWorkout } from '@/lib/active-workout'
import { abandonWorkout } from '@/lib/workout'

export default function ActiveWorkoutBar({
  workout,
  totalExercises,
  onAbandoned,
}: {
  workout: ActiveWorkout
  /** Exercises in the day, when we know it. 0 shows the day name alone. */
  totalExercises: number
  onAbandoned: () => void
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState<string | null>(() => elapsedLabel(workout.startedAt))

  /* Ticked from the start time rather than counted up, the same reasoning as
     the rest timer: a backgrounded tab's intervals are throttled or suspended
     outright on iOS, so a counter comes back wrong and a subtraction comes
     back right. */
  useEffect(() => {
    setClock(elapsedLabel(workout.startedAt))
    const id = setInterval(() => setClock(elapsedLabel(workout.startedAt)), 1000)
    return () => clearInterval(id)
  }, [workout.startedAt])

  const abandon = async () => {
    if (busy) return
    setBusy(true)
    try {
      await abandonWorkout(workout.id)
      onAbandoned()
    } catch {
      // Leaving the bar up is the honest outcome: the session is still open.
      setBusy(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 left-0 right-0 z-[55] px-4">
        <div className="mx-auto max-w-lg rounded-card bg-surface-overlay border border-white/[0.12] shadow-[0_8px_30px_rgba(0,0,0,0.5)] p-4">
          <p className="text-white text-body font-body mb-1">End this session?</p>
          <p className="text-ink-3 text-label font-body mb-3">{abandonWarning(workout)}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 h-12 rounded-control bg-white/[0.08] text-white text-label font-display font-bold uppercase tracking-wide active:scale-[0.98] transition-transform duration-150"
            >
              Keep training
            </button>
            <button
              onClick={() => void abandon()}
              disabled={busy}
              className="flex-1 h-12 rounded-control bg-state-danger/20 border border-state-danger/40 text-state-danger text-label font-display font-bold uppercase tracking-wide active:scale-[0.98] transition-transform duration-150 disabled:opacity-50"
            >
              {busy ? 'Ending…' : 'End session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 left-0 right-0 z-[55] px-4 pointer-events-none">
      <div className="mx-auto max-w-lg pointer-events-auto flex items-center gap-3 rounded-card bg-surface-overlay/95 backdrop-blur border border-brand-blue/30 shadow-[0_8px_30px_rgba(0,0,0,0.5)] pl-4 pr-2 py-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-blue" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-brand-blueink text-caption font-display font-bold uppercase tracking-wide">
            Workout in progress
          </p>
          <p className="text-white text-label font-body truncate">
            {progressLine(workout, totalExercises)}
            {clock && <span className="text-ink-3 tabular-nums"> · {clock}</span>}
          </p>
        </div>

        {/* Small, because ending a session from a bar you are only passing is
            not the common case and must not be the easy mistake. 44px of hit
            area around a 16px glyph. */}
        <button
          onClick={() => setConfirming(true)}
          className="w-11 h-11 shrink-0 flex items-center justify-center text-ink-4 hover:text-white active:scale-95 transition-all duration-150"
          aria-label="End this workout"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          onClick={() => router.push('/studio/programs')}
          className="h-11 px-5 shrink-0 rounded-control bg-brand-bluefill text-white text-label font-display font-bold uppercase tracking-[0.1em] hover:bg-brand-bluefillhover active:scale-95 transition-all duration-150"
        >
          Resume
        </button>
      </div>
    </div>
  )
}
