'use client'

import { motion } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSessions, createSession, setSessionStatus, type Session } from '@/lib/scheduling'

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL
const SESSION_TYPES = ['Live Training', 'Video Check-in', 'Welcome Call', 'Consultation']

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ user_id: '', date: '', time: '', type: SESSION_TYPES[0], duration_min: 45, notes: '', zoom: true })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const s = await fetchAllSessions()
    setSessions(s)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('users').select('id, name').then(({ data }) => setClients((data as Array<{ id: string; name: string }>) ?? []))
    load().finally(() => setLoading(false))
  }, [load])

  const add = async () => {
    if (!form.user_id || !form.date || !form.time) return
    setCreating(true)
    setError(null)
    try {
      const starts_at = new Date(`${form.date}T${form.time}`).toISOString()

      // Create a Zoom meeting first (server-side) when requested, then store its link on the session.
      let join_url: string | null = null
      let zoom_meeting_id: string | null = null
      if (form.zoom) {
        const clientName = clients.find((c) => c.id === form.user_id)?.name ?? 'Client'
        const res = await fetch('/api/zoom/meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `AJM Fit — ${form.type} with ${clientName}`,
            startISO: starts_at,
            durationMin: Number(form.duration_min),
            agenda: form.notes || undefined,
          }),
        })
        const data = (await res.json()) as { join_url?: string; meeting_id?: string; error?: string }
        if (!res.ok || !data.join_url) throw new Error(data.error || 'Could not create Zoom link')
        join_url = data.join_url
        zoom_meeting_id = data.meeting_id ?? null
      }

      await createSession({ user_id: form.user_id, starts_at, duration_min: Number(form.duration_min), type: form.type, notes: form.notes, join_url, zoom_meeting_id })

      // Email the client their confirmation + calendar invite (best-effort).
      fetch('/api/sessions/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: form.user_id, type: form.type, starts_at, duration_min: Number(form.duration_min), join_url }),
      }).catch((e) => console.error('[schedule] notify failed', e))

      setForm({ user_id: '', date: '', time: '', type: SESSION_TYPES[0], duration_min: 45, notes: '', zoom: true })
      await load()
    } catch (e) {
      console.error('[schedule] create failed', e)
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  const cancel = async (s: Session) => {
    // Best-effort: remove the Zoom meeting, then mark the session cancelled regardless.
    if (s.zoom_meeting_id) {
      try {
        await fetch(`/api/zoom/meeting?meeting_id=${encodeURIComponent(s.zoom_meeting_id)}`, { method: 'DELETE' })
      } catch (e) {
        console.error('[schedule] zoom delete failed', e)
      }
    }
    await setSessionStatus(s.id, 'cancelled')
    await load()
  }

  const now = Date.now()
  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() >= now)
  const past = sessions.filter((s) => s.status !== 'scheduled' || new Date(s.starts_at).getTime() < now).reverse()

  return (
    <div className="p-6 lg:p-10 max-w-[1100px] mx-auto">
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display font-extrabold text-3xl uppercase tracking-tight text-white">Schedule</motion.h1>
        <p className="text-white/40 font-body text-sm mt-1">{upcoming.length} upcoming session{upcoming.length === 1 ? '' : 's'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New session */}
        <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 h-fit">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-5">Schedule a Session</h2>
          <div className="space-y-3">
            <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body focus:outline-none focus:border-[#F76B16]/30">
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body focus:outline-none focus:border-[#F76B16]/30 [color-scheme:dark]" />
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body focus:outline-none focus:border-[#F76B16]/30 [color-scheme:dark]" />
            </div>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, zoom: e.target.value !== 'Live Training' })} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body focus:outline-none focus:border-[#F76B16]/30">
              {SESSION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} className="w-24 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/80 font-body focus:outline-none focus:border-[#F76B16]/30" />
              <span className="text-white/40 text-xs font-body">minutes</span>
            </div>
            <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer select-none">
              <input type="checkbox" checked={form.zoom} onChange={(e) => setForm({ ...form, zoom: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-[#F76B16] cursor-pointer" />
              <span className="text-white/60 text-xs font-body">Generate a Zoom link for this session</span>
            </label>
            {error && <p className="text-red-400/80 text-xs font-body">{error}</p>}
            <button onClick={add} disabled={creating || !form.user_id || !form.date || !form.time} className="w-full py-2.5 bg-[#F76B16] text-white text-xs font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200 disabled:opacity-40">
              {creating ? (form.zoom ? 'Creating Zoom link…' : 'Adding…') : 'Add Session'}
            </button>
          </div>

          {CALENDLY && (
            <a href={CALENDLY} target="_blank" rel="noreferrer" className="block mt-4 text-center text-[#1A7BFF] text-xs font-body hover:underline">Open Calendly booking →</a>
          )}
        </motion.div>

        {/* Sessions */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]"><h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Upcoming</h2></div>
            <div className="p-4 space-y-2">
              {loading ? <p className="px-2 py-3 text-white/30 text-sm font-body">Loading…</p>
                : upcoming.length === 0 ? <p className="px-2 py-3 text-white/40 text-sm font-body">No upcoming sessions. Schedule one on the left.</p>
                : upcoming.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02]">
                    <div className="w-10 h-10 rounded-lg bg-[#F76B16]/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-body font-medium truncate">{s.clientName}</p>
                      <p className="text-white/30 text-xs font-body">{s.type} · {s.duration_min} min · {fmt(s.starts_at)}</p>
                      {s.join_url && (
                        <a href={s.join_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[#1A7BFF] text-xs font-body hover:underline">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                          Join Zoom
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setSessionStatus(s.id, 'completed').then(load)} title="Mark done" className="px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-display font-bold uppercase hover:bg-emerald-500/20">Done</button>
                      <button onClick={() => cancel(s)} title="Cancel" className="px-2.5 py-1.5 rounded-md bg-white/[0.06] text-white/40 text-[10px] font-display font-bold uppercase hover:bg-white/[0.1]">Cancel</button>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>

          {past.length > 0 && (
            <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="px-6 py-5 border-b border-white/[0.06]"><h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Past &amp; Cancelled</h2></div>
              <div className="p-4 space-y-1.5">
                {past.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg">
                    <p className="text-white/50 text-sm font-body">{s.clientName} · {s.type}</p>
                    <span className={`text-[10px] font-display uppercase ${s.status === 'completed' ? 'text-emerald-400/70' : s.status === 'cancelled' ? 'text-white/25' : 'text-white/40'}`}>{s.status} · {fmt(s.starts_at)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
