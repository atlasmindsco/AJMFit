'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Coach review queue for proposed nutrition adjustments.
 *
 * The engine runs weekly and decides; this is where Anthony confirms. One tap
 * to approve, one to reject, and an editable calorie box for the cases where
 * he wants a different number than the maths suggested.
 *
 * Every row shows the evidence the decision rested on, not just the verdict.
 * A proposal a coach cannot interrogate is one he will either rubber-stamp or
 * ignore, and both are worse than no proposal.
 */

interface Row {
  id: string
  user_id: string
  verdict: string
  escalation: string | null
  prev_cal: number | null
  new_cal: number | null
  new_protein: number | null
  reason: string
  coach_note: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidence: any
  created_at: string
  status: string
  client_name?: string
}

const VERDICT_LABEL: Record<string, string> = {
  decrease: 'Lower calories',
  increase: 'Raise calories',
  diet_break: 'Diet break',
  escalate: 'Needs you',
  hold: 'Hold',
  adherence_first: 'Adherence first',
}

export default function LuffyNutritionPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      // Goes through the API, not the client Supabase: the table has no RLS
      // policies and no grants for authenticated users on purpose.
      const res = await fetch('/api/admin/nutrition-adjustment')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setRows((data.rows ?? []) as Row[])
    } catch (e) {
      console.error('[luffy/nutrition] load failed', e)
      setError('Could not load the queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (row: Row, action: 'approve' | 'reject') => {
    setBusy(row.id)
    setError('')
    try {
      const typed = edits[row.id]
      const res = await fetch('/api/admin/nutrition-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          action,
          ...(action === 'approve' && typed ? { calories: Number(typed) } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data.floored) {
        setError(`Raised to ${data.calories} — the number you entered was below that client's floor.`)
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Nutrition review</h1>
        <p className="text-white/40 text-sm font-body mt-1">
          Proposals from the weekly review. Nothing here has changed a client&rsquo;s targets yet.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3.5 rounded-card bg-state-warning/10 border border-state-warning/30">
          <p className="text-white/80 text-sm font-body">{error}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-10 text-center">
          <p className="font-body text-sm text-white/70">Nothing waiting.</p>
          <p className="text-white/35 text-xs font-body mt-1.5">
            The review runs weekly. Clients on track never appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const e = r.evidence ?? {}
            return (
              <div
                key={r.id}
                className={`bg-surface-raised rounded-card border p-5 ${
                  r.escalation ? 'border-state-warning/40' : 'border-white/[0.10]'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-white text-sm">{r.client_name}</p>
                    <p className="text-white/40 text-xs font-body mt-0.5">
                      {VERDICT_LABEL[r.verdict] ?? r.verdict}
                      {r.escalation && ` · ${r.escalation.replace(/_/g, ' ')}`}
                    </p>
                  </div>
                  {r.new_cal !== null && (
                    <p className="shrink-0 font-display font-bold text-white text-sm">
                      {Math.round(Number(r.prev_cal))} → {Math.round(Number(r.new_cal))}
                      <span className="text-white/40 font-body font-normal text-xs"> cal</span>
                    </p>
                  )}
                </div>

                {/* The evidence, so this can be argued with rather than trusted. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    ['Actual', e.actualRatePct != null ? `${e.actualRatePct}%/wk` : '—'],
                    ['Target', e.targetRatePct != null ? `${e.targetRatePct}%/wk` : '—'],
                    ['Adherence', e.adherence != null ? `${e.adherence}/5` : '—'],
                    ['Hunger', e.hunger != null ? `${e.hunger}/5` : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-control bg-white/[0.03] px-3 py-2">
                      <p className="text-white/35 text-2xs font-display uppercase tracking-wide">{label}</p>
                      <p className="text-white/80 text-sm font-body font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {r.coach_note && (
                  <p className="text-white/55 text-xs font-body leading-relaxed mb-3">{r.coach_note}</p>
                )}

                <details className="mb-3">
                  <summary className="text-white/35 text-xs font-body cursor-pointer hover:text-white/60">
                    What the client will read
                  </summary>
                  <p className="text-white/60 text-xs font-body leading-relaxed mt-2 pl-3 border-l border-white/10">
                    {r.reason}
                  </p>
                </details>

                <div className="flex flex-wrap items-center gap-2">
                  {r.new_cal !== null && (
                    <input
                      type="number"
                      value={edits[r.id] ?? String(Math.round(Number(r.new_cal)))}
                      onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: ev.target.value }))}
                      className="w-24 px-3 py-2 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body focus:outline-none focus:border-brand-blue/50"
                    />
                  )}
                  <button
                    onClick={() => decide(r, 'approve')}
                    disabled={busy === r.id}
                    className="px-4 py-2 rounded-control bg-brand-blue text-white font-display font-bold text-xs uppercase tracking-wide hover:bg-brand-bluedark disabled:opacity-50 transition-colors"
                  >
                    {busy === r.id ? '…' : r.new_cal !== null ? 'Approve' : 'Acknowledge'}
                  </button>
                  <button
                    onClick={() => decide(r, 'reject')}
                    disabled={busy === r.id}
                    className="px-4 py-2 rounded-control bg-white/[0.06] text-white/70 font-display font-bold text-xs uppercase tracking-wide hover:bg-white/[0.12] disabled:opacity-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
