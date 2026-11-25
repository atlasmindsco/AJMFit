'use client'

/**
 * What this client actually did, session by session.
 *
 * The gap this closes: 1,371 logged sets existed and no coach screen showed
 * one. You could see that a workout happened and not what was in it, which is
 * the difference between knowing somebody trained and being able to coach
 * them.
 *
 * Sessions newest first, every set, and one arrow per exercise comparing it
 * with the last time they did it. That arrow is the only interpretation on
 * the screen and it is arithmetic on two logged numbers — no adherence, no
 * score, no judgement the data cannot support.
 */
import { useEffect, useState } from 'react'
import { fetchClientSessions } from '@/lib/admin'
import { durationLabel, setLabel, type CoachSession } from '@/lib/coach-training'

const dayLabel = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ClientTraining({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<CoachSession[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetchClientSessions(userId, 12)
      .then((rows) => active && setSessions(rows))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [userId])

  if (error) {
    return <p className="text-ink-4 text-label font-body">Could not load sessions.</p>
  }
  if (sessions === null) {
    return <p className="text-ink-4 text-label font-body">Loading sessions…</p>
  }
  if (sessions.length === 0) {
    // Seven clients are in exactly this state. Said plainly, as a fact about
    // the data rather than an accusation about the person.
    return <p className="text-ink-3 text-label font-body">No sessions logged yet.</p>
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const dur = durationLabel(s.durationSeconds)
        return (
          <div key={s.workoutId} className="rounded-control bg-white/[0.02] border border-white/[0.06] p-4">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <p className="font-display font-bold text-white text-label">
                {dayLabel(s.date)}
                {s.dayName && <span className="text-ink-3 font-body font-normal"> · {s.dayName}</span>}
              </p>
              {dur && <span className="text-ink-4 text-caption font-body shrink-0">{dur}</span>}
            </div>

            <div className="space-y-2.5">
              {s.exercises.map((e) => (
                <div key={e.name} className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-ink text-label font-body">
                      {e.name}
                      {/* Swapped mid-session, and what it replaced. The reason
                          they gave lives on the swap row itself. */}
                      {e.swappedFrom && (
                        <span className="text-ink-4"> · instead of {e.swappedFrom}</span>
                      )}
                    </p>
                    <p className="text-ink-3 text-caption font-body tabular-nums mt-0.5">
                      {e.sets.map((set, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-ink-4">{'   '}</span>}
                          {setLabel(set)}
                          {set.rir != null && <span className="text-ink-4"> @{set.rir}</span>}
                        </span>
                      ))}
                    </p>
                  </div>
                  {e.change && (
                    <span
                      className={`text-caption font-display font-bold shrink-0 tabular-nums ${
                        e.change.direction === 'up' ? 'text-state-success' : 'text-state-warning'
                      }`}
                    >
                      {e.change.direction === 'up' ? '↑' : '↓'} from {e.change.from}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
