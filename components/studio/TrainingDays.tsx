'use client'

/**
 * Which days of the week this client trains.
 *
 * WHY HERE. The question is asked once, in the Blueprint picker, where it is
 * optional — and every client in production has skipped it. The dashboard card
 * meant to recover from that ("Which days do you train?") pointed at
 * /studio/schedule, which was a Calendly booking page with no way to answer.
 * So the card asked, the client arrived, and there was nothing to tap. Nobody
 * has ever set their training days because nobody has ever been able to.
 *
 * A program here is a rotation, not a calendar, which is the right model — but
 * it means the app does not know which DAYS anyone trains, so a reminder has
 * to either guess or stay silent, and the week has no denominator to count
 * against.
 *
 * Still optional, and saying so matters. An empty selection is a real answer
 * meaning "do not remind me", not a blank form: silence beats a nudge that is
 * wrong four days out of seven.
 */

import { useCallback, useEffect, useState } from 'react'
import { getCurrentUserId } from '@/lib/current-user'
import { fetchMyBlock } from '@/lib/programs'

const INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const same = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

export default function TrainingDays() {
  const [loading, setLoading] = useState(true)
  const [hasProgram, setHasProgram] = useState(false)
  const [saved, setSaved] = useState<number[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const load = useCallback(async () => {
    const id = await getCurrentUserId()
    if (!id) {
      setLoading(false)
      return
    }
    const block = await fetchMyBlock(id).catch(() => null)
    const days = block?.training_days ?? []
    setHasProgram(!!block)
    setSaved(days)
    setPicked(days)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading || !hasProgram) return null

  const toggle = (d: number) => {
    setJustSaved(false)
    setPicked((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    )
  }

  const dirty = !same(picked, saved)

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/studio/program/training-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: picked }),
      })
      const data = (await res.json()) as { ok?: boolean; days?: number[] | null; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not save your days.')
      // Trust the server's answer, not the local state: it is the cleaned,
      // sorted version that actually landed in the column.
      const confirmed = data.days ?? []
      setSaved(confirmed)
      setPicked(confirmed)
      setJustSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your days.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white/[0.03] border border-white/[0.06] rounded-card p-6">
      <h2 className="font-display font-semibold text-white text-lg uppercase tracking-wide mb-1">
        Your training days
      </h2>
      <p className="text-ink-2 text-sm font-body mb-4">
        Tell us which days you train and we&rsquo;ll remind you on those days and stay
        quiet on the rest. Your program rotates at your pace either way &mdash; this only
        changes when we get in touch.
      </p>

      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Training days">
        {INITIALS.map((n, d) => {
          const on = picked.includes(d)
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              aria-label={FULL[d]}
              aria-pressed={on}
              className={`py-3 rounded-control border font-display font-bold text-sm transition-all duration-150 active:scale-95 ${
                on
                  ? 'bg-brand-blue/[0.15] border-brand-blue/50 text-white'
                  : 'bg-white/[0.03] border-white/[0.08] text-ink-3 hover:bg-white/[0.06]'
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>

      {error && <p className="text-state-danger text-xs font-body mt-3">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          onClick={() => void save()}
          disabled={!dirty || busy}
          className="px-4 py-2 rounded-control bg-brand-orange text-white text-2xs font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark disabled:opacity-40 transition-colors"
        >
          {busy ? 'Saving…' : 'Save my days'}
        </button>

        {dirty && picked.length === 0 && (
          <span className="text-ink-3 text-2xs font-body">
            Nothing selected &mdash; saving turns workout reminders off.
          </span>
        )}
        {!dirty && justSaved && (
          <span className="text-state-success text-2xs font-body">
            {saved.length === 0
              ? 'Saved. No workout reminders.'
              : `Saved. We'll remind you ${saved.length === 7 ? 'every day' : `on ${saved.map((d) => FULL[d]).join(', ')}`}.`}
          </span>
        )}
        {!dirty && !justSaved && saved.length > 0 && (
          <span className="text-ink-4 text-2xs font-body">
            {saved.length} {saved.length === 1 ? 'day' : 'days'} a week
          </span>
        )}
      </div>
    </section>
  )
}
