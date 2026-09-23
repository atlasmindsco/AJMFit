'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ProgramRow {
  id: string
  name: string
  days_per_week: number | null
  split: string | null
  source: string | null
  goal: string | null
  location: string | null
}

interface CurrentAssignment {
  program_id: string
  assigned_at: string
  programs: { name: string } | null
}

/**
 * Lets the coach put a client on a program.
 *
 * This did not exist in any form: program_assignments appeared nowhere in
 * /luffy or the admin API, and the Blueprint picker that writes them is gated
 * to tier === 'blueprint'. A coached client could therefore never receive a
 * program, which made both paid tiers unsellable.
 */
export default function AssignProgram({ userId }: { userId: string }) {
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [current, setCurrent] = useState<CurrentAssignment | null>(null)
  const [selected, setSelected] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const [{ data: progs }, { data: asg }] = await Promise.all([
      db.from('programs').select('id, name, days_per_week, split, source, goal, location').order('name'),
      db
        .from('program_assignments')
        .select('program_id, assigned_at, programs(name)')
        .eq('user_id', userId)
        .is('ended_at', null)
        .maybeSingle(),
    ])
    setPrograms((progs ?? []) as ProgramRow[])
    setCurrent((asg ?? null) as CurrentAssignment | null)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const assign = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    setDone('')
    try {
      const res = await fetch('/api/admin/assign-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, programId: selected, note: note.trim() || undefined }),
      })
      const data = (await res.json()) as { ok?: boolean; programName?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not assign that program.')
      setDone(`Assigned ${data.programName}. They have been messaged.`)
      setNote('')
      setSelected('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const label = (p: ProgramRow) =>
    p.source === 'blueprint'
      ? `${p.days_per_week ?? '?'}d · ${p.split ?? ''} · ${p.goal ?? ''} · ${p.location ?? ''}`
      : p.name

  const templates = programs.filter((p) => p.source === 'blueprint')
  const custom = programs.filter((p) => p.source !== 'blueprint')

  return (
    <div className="sm:col-span-2 mt-1 pt-4 border-t border-white/[0.06]">
      <p className="text-brand-orange text-[10px] font-display font-bold uppercase tracking-wide mb-2">
        Training program
      </p>

      <p className="text-white/70 text-sm font-body mb-3">
        {current?.programs?.name ? (
          <>
            Currently on <span className="text-white font-semibold">{current.programs.name}</span>
            <span className="text-white/35">
              {' '}
              · since {new Date(current.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </>
        ) : (
          <span className="text-state-warning">No program assigned.</span>
        )}
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-sm font-body focus:outline-none focus:border-brand-blue/50"
        >
          <option value="">Choose a program…</option>
          {custom.length > 0 && (
            <optgroup label="Custom">
              {custom.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Library templates">
            {templates.map((p) => (
              <option key={p.id} value={p.id}>
                {label(p)}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          onClick={assign}
          disabled={!selected || saving}
          className="shrink-0 px-5 py-2.5 rounded-control bg-brand-orange text-white text-xs font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        >
          {saving ? 'Assigning…' : current ? 'Replace' : 'Assign'}
        </button>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note sent with it — why this program, what to focus on"
        className="w-full mt-2 px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-sm font-body placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50"
      />

      {done && <p className="text-state-success text-xs font-body mt-2">{done}</p>}
      {error && <p className="text-state-danger text-xs font-body mt-2">{error}</p>}
    </div>
  )
}
