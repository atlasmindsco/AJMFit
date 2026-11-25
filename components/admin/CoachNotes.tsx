'use client'

/**
 * Private notes about a client. The client never sees these.
 *
 * "Right shoulder — watch overhead work." "Travelling 25–30 Nov." The things
 * a coach remembers and an app had nowhere to put: the only `coachNote` that
 * existed before this belonged to a nutrition proposal, which the client
 * reads.
 *
 * Dated, newest first, one of them pinnable. No tasks, no due dates, no
 * reminders — that is the first step into a CRM, and a reminder nobody
 * actions becomes another thing to dismiss. The pin is what makes it work:
 * "right shoulder" needs to be visible every time you open him, not scrolled
 * to.
 */
import { useEffect, useState } from 'react'
import {
  fetchCoachNotes,
  addCoachNote,
  pinCoachNote,
  unpinCoachNote,
  deleteCoachNote,
  type CoachNote,
} from '@/lib/admin'

const when = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CoachNotes({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<CoachNote[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetchCoachNotes(userId)
      .then(setNotes)
      .catch(() => setError('Could not load notes.'))
  }
  useEffect(load, [userId])

  const add = async () => {
    if (!draft.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await addCoachNote(userId, draft)
      setDraft('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      load()
    } catch {
      setError('That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-start gap-2 mb-3">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Right shoulder — watch overhead work"
          className="flex-1 px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-body font-body placeholder:text-ink-4 focus:outline-none focus:border-brand-orange/50"
        />
        <button
          onClick={() => void add()}
          disabled={busy || !draft.trim()}
          className="px-4 py-2.5 rounded-control bg-white/[0.08] text-white text-caption font-display font-bold uppercase tracking-wide hover:bg-white/[0.12] disabled:opacity-40 transition-colors duration-200 shrink-0"
        >
          Save
        </button>
      </div>

      {error && <p className="text-state-warning text-caption font-body mb-2">{error}</p>}

      {notes.length === 0 ? (
        <p className="text-ink-4 text-caption font-body">
          Nothing yet. These are private — the client never sees them.
        </p>
      ) : (
        <div className="space-y-1.5">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-3 px-3 py-2.5 rounded-control border ${
                n.pinned
                  ? 'bg-brand-orange/[0.08] border-brand-orange/25'
                  : 'bg-white/[0.02] border-white/[0.06]'
              }`}
            >
              <span className="text-ink-4 text-caption font-body tabular-nums shrink-0 w-12">
                {n.pinned ? 'Pinned' : when(n.created_at)}
              </span>
              <p className="flex-1 text-ink text-label font-body leading-relaxed min-w-0">{n.body}</p>
              <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={() => void act(() => (n.pinned ? unpinCoachNote(n.id) : pinCoachNote(userId, n.id)))}
                  className="text-ink-4 hover:text-white text-caption font-body"
                >
                  {n.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={() => void act(() => deleteCoachNote(n.id))}
                  className="text-ink-4 hover:text-state-danger text-caption font-body"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
