'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchPrograms, createProgram, deleteProgram, fetchActiveAssignments, assignProgram,
  type Program,
} from '@/lib/programs'

const LEVELS = ['Beginner', 'Intermediate', 'Advanced']

export default function ProgramLibrary() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [assignments, setAssignments] = useState<Array<{ id: string; clientName: string; programName: string }>>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '', level: LEVELS[0], days_per_week: 4, split: '' })
  const [busy, setBusy] = useState(false)
  const [assignTo, setAssignTo] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([fetchPrograms(), fetchActiveAssignments()])
    setPrograms(p)
    setAssignments(a)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('users').select('id, name').then(({ data }) => setClients((data as Array<{ id: string; name: string }>) ?? []))
    load().finally(() => setLoading(false))
  }, [load])

  const add = async () => {
    if (!draft.name.trim()) return
    setBusy(true)
    try {
      await createProgram({ name: draft.name.trim(), description: draft.description, level: draft.level, days_per_week: Number(draft.days_per_week), split: draft.split })
      setDraft({ name: '', description: '', level: LEVELS[0], days_per_week: 4, split: '' })
      setShowNew(false)
      await load()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  const assign = async (programId: string) => {
    const userId = assignTo[programId]
    if (!userId) return
    await assignProgram(userId, programId)
    setAssignTo((p) => ({ ...p, [programId]: '' }))
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-white/40 text-sm font-body">{programs.length} program{programs.length === 1 ? '' : 's'} in your library</p>
        <button onClick={() => setShowNew((v) => !v)} className="px-4 py-2 bg-[#F76B16] text-white text-xs font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#D8590C]">{showNew ? 'Close' : 'New Program'}</button>
      </div>

      {showNew && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Program name (e.g. Muscle Builder)" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-[#F76B16]/30" />
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} placeholder="Description" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white font-body resize-none focus:outline-none focus:border-[#F76B16]/30" />
          <div className="grid grid-cols-3 gap-3">
            <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body">{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
            <input type="number" value={draft.days_per_week} onChange={(e) => setDraft({ ...draft, days_per_week: Number(e.target.value) })} placeholder="Days/wk" className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body" />
            <input value={draft.split} onChange={(e) => setDraft({ ...draft, split: e.target.value })} placeholder="Split (PPL)" className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body" />
          </div>
          <div className="flex justify-end"><button onClick={add} disabled={busy || !draft.name.trim()} className="px-5 py-2 bg-[#F76B16] text-white text-xs font-display font-bold uppercase rounded-lg disabled:opacity-40">{busy ? 'Saving…' : 'Create'}</button></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>
      ) : programs.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <p className="text-white font-display font-bold text-sm">No programs yet</p>
          <p className="text-white/40 text-sm font-body mt-1">Create your first program to assign to clients.</p>
        </div>
      ) : (
        programs.map((p) => {
          const assigned = assignments.filter((a) => a.programName === p.name)
          return (
            <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-white font-display font-bold text-sm">{p.name}</h3>
                  {p.description && <p className="text-white/50 text-sm font-body mt-0.5">{p.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {p.level && <span className="text-[10px] font-display uppercase tracking-wide px-2 py-1 rounded bg-[#1A7BFF]/10 text-[#1A7BFF]">{p.level}</span>}
                    {p.days_per_week && <span className="text-[10px] font-display uppercase tracking-wide px-2 py-1 rounded bg-white/[0.06] text-white/50">{p.days_per_week} days/wk</span>}
                    {p.split && <span className="text-[10px] font-display uppercase tracking-wide px-2 py-1 rounded bg-white/[0.06] text-white/50">{p.split}</span>}
                  </div>
                </div>
                <button onClick={() => deleteProgram(p.id).then(load)} title="Delete" className="text-white/20 hover:text-red-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </button>
              </div>

              {assigned.length > 0 && (
                <p className="text-white/40 text-xs font-body mt-3">Assigned to: {assigned.map((a) => a.clientName).join(', ')}</p>
              )}

              <div className="flex gap-2 mt-3">
                <select value={assignTo[p.id] ?? ''} onChange={(e) => setAssignTo((prev) => ({ ...prev, [p.id]: e.target.value }))} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/80 font-body">
                  <option value="">Assign to client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => assign(p.id)} disabled={!assignTo[p.id]} className="px-4 py-2 bg-[#1A7BFF] text-white text-xs font-display font-bold uppercase rounded-lg disabled:opacity-40">Assign</button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
