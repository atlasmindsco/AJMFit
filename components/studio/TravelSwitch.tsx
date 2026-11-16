'use client'

/**
 * Switch between the gym and home versions of the same program.
 *
 * Shown only when a twin actually exists, which means only on the seeded
 * library programs. A custom build has no automatic home version and the
 * control simply is not there — better an absent button than one that
 * explains why it cannot help.
 *
 * Phrased around the situation rather than the mechanism. "Away from the
 * gym?" is a thing that happens to someone; "switch program location" is a
 * database operation. The reassurance that matters — that they keep their
 * place in the block — is on the button, because losing six weeks of progress
 * is the exact fear that makes people train nothing while they travel.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchLocationTwin, swapLabel, swapDetail, type LocationTwin } from '@/lib/travel'

export default function TravelSwitch({
  programId,
  onSwitched,
}: {
  programId: string | null
  onSwitched: () => void
}) {
  const [twin, setTwin] = useState<LocationTwin | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    if (!programId) return
    setTwin(await fetchLocationTwin(programId).catch(() => null))
  }, [programId])

  useEffect(() => {
    void load()
  }, [load])

  if (!twin) return null

  const go = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/studio/program/switch-location', { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not switch.')
      setConfirming(false)
      onSwitched()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
      <p className="font-display font-bold text-white text-sm">{swapLabel(twin.location)}</p>
      <p className="text-ink-3 text-sm font-body mt-1.5 leading-relaxed max-w-lg">
        {swapDetail(twin.location)}
      </p>

      {error && <p className="text-state-danger text-xs font-body mt-3">{error}</p>}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            onClick={() => void go()}
            disabled={busy}
            className="px-4 py-2 rounded-control bg-brand-orange text-white text-2xs font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark disabled:opacity-40 transition-colors"
          >
            {busy ? 'Switching…' : `Switch to ${twin.location === 'home' ? 'dumbbells' : 'full gym'}`}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="text-ink-3 hover:text-white text-2xs font-body transition-colors"
          >
            Not now
          </button>
          <span className="text-ink-4 text-2xs font-body">
            You keep your week and everything you have logged.
          </span>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="mt-4 px-4 py-2 rounded-control bg-white/[0.06] text-ink-2 text-2xs font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] hover:text-white transition-colors"
        >
          {twin.location === 'home' ? 'Use dumbbells instead' : 'Go back to the gym version'}
        </button>
      )}
    </div>
  )
}
