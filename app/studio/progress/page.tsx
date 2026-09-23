'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getCurrentUserId } from '@/lib/current-user'
import EmptyState from '@/components/ui/EmptyState'
import { fetchPRs, fetchWorkoutHistory, fetchWeekStreak } from '@/lib/workout'
import { milestones, type Milestone } from '@/lib/milestones'
import ProgressPhotos from '@/components/studio/ProgressPhotos'
import {
  fetchBodyMetrics,
  saveBodyMetric,
  weightTrend,
  type BodyMetric,
} from '@/lib/body-metrics'

const inputCls =
  'w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body text-center placeholder:text-white/20 focus:outline-none focus:border-brand-blue/50 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

const labelCls = 'text-white/30 text-[10px] font-display font-bold uppercase tracking-[0.15em]'

/**
 * Where a client logs bodyweight and measurements and sees them move.
 *
 * Weight previously lived on a single overwritten column, so no trend existed
 * for anyone to look at. Measurements are optional — waist alone carries most
 * of the signal, and asking for six numbers every week is how logging stops.
 */
export default function ProgressPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<BodyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [form, setForm] = useState({ weight: '', waist: '', hips: '', chest: '', arm: '', thigh: '' })
  const [earned, setEarned] = useState<Milestone[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!active) return
      setUserId(id)
      if (!id) {
        setLoading(false)
        return
      }
      try {
        const [data, prs, hist, streak] = await Promise.all([
          fetchBodyMetrics(id),
          fetchPRs(id).catch(() => []),
          fetchWorkoutHistory(id, 300).catch(() => []),
          fetchWeekStreak(id).catch(() => 0),
        ])
        if (!active) return
        setRows(data)
        setEarned(
          milestones({
            workoutCount: hist.length,
            firstWorkoutAt: hist.length ? hist[hist.length - 1].date ?? null : null,
            prs,
            weekStreak: streak,
            metrics: data,
          })
        )
      } catch (e) {
        console.error('[Progress] load failed', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const reload = async () => {
    if (userId) setRows(await fetchBodyMetrics(userId))
  }

  const trend = weightTrend(rows)

  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  const save = async () => {
    if (!userId) return
    if (!form.weight.trim() && !form.waist.trim()) return
    setSaving(true)
    try {
      await saveBodyMetric(userId, {
        weight_lb: num(form.weight),
        waist_in: num(form.waist),
        hips_in: num(form.hips),
        chest_in: num(form.chest),
        arm_in: num(form.arm),
        thigh_in: num(form.thigh),
      })
      setRows(await fetchBodyMetrics(userId))
      setForm({ weight: '', waist: '', hips: '', chest: '', arm: '', thigh: '' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (e) {
      console.error('[Progress] save failed', e)
    } finally {
      setSaving(false)
    }
  }

  // Simple sparkline over the last 12 weigh-ins.
  const spark = () => {
    const pts = trend.points.slice(-12)
    if (pts.length < 2) return null
    const w = 280
    const h = 56
    const min = Math.min(...pts.map((p) => p.weight))
    const max = Math.max(...pts.map((p) => p.weight))
    const span = max - min || 1
    const d = pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * w
        const y = h - ((p.weight - min) / span) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 mt-3" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="#F76B16" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Progress</h1>
        <p className="text-white/40 text-sm font-body mt-1">
          Weigh in once a week, same day, same time. One number on its own means nothing — the direction is what counts.
        </p>
      </header>

      {/* Trend */}
      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
        {trend.latest == null ? (
          <EmptyState
            title="No weigh-ins yet"
            line="Log your first below. After a few weeks this turns into a line you can actually read."
          />
        ) : (
          <>
            <div className="flex items-end gap-6">
              <div>
                <p className={labelCls}>Current</p>
                <p className="font-display font-extrabold text-3xl text-white tabular-nums mt-1">
                  {trend.latest}
                  <span className="text-white/30 text-base font-body ml-1">lbs</span>
                </p>
              </div>
              {trend.change28dLb != null && (
                <div>
                  <p className={labelCls}>Last 28 days</p>
                  <p
                    className={`font-display font-extrabold text-2xl tabular-nums mt-1 ${
                      trend.change28dLb === 0 ? 'text-white/50' : 'text-brand-orange'
                    }`}
                  >
                    {trend.change28dLb > 0 ? '+' : ''}
                    {trend.change28dLb}
                    <span className="text-white/30 text-sm font-body ml-1">lbs</span>
                  </p>
                </div>
              )}
            </div>
            {spark()}
          </>
        )}
      </div>

      {/* Milestones. Derived from real training outcomes rather than stored,
          and deliberately not gamified — a reward for something that did not
          matter teaches the client that none of the rewards mean anything. */}
      {earned.length > 0 && (
        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
          <p className="font-display font-bold text-white text-sm mb-3">What you&rsquo;ve done so far</p>
          <div className="space-y-2.5">
            {earned.map((m) => (
              <div key={m.key} className="flex items-start gap-3">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-sm font-display font-bold">{m.label}</p>
                  <p className="text-white/40 text-xs font-body mt-0.5 leading-relaxed">{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
        <p className="font-display font-bold text-white text-sm mb-3">Log today</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={`${labelCls} mb-1.5`}>Weight (lbs)</p>
            <input
              type="number"
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder={trend.latest != null ? String(trend.latest) : '185'}
              className={inputCls}
            />
          </div>
          <div>
            <p className={`${labelCls} mb-1.5`}>Waist (in)</p>
            <input
              type="number"
              inputMode="decimal"
              value={form.waist}
              onChange={(e) => setForm({ ...form, waist: e.target.value })}
              placeholder="34"
              className={inputCls}
            />
          </div>
        </div>

        <button
          onClick={() => setShowMeasurements((v) => !v)}
          className="text-white/40 hover:text-white/70 text-xs font-body mt-3 transition-colors duration-200"
        >
          {showMeasurements ? '− Fewer measurements' : '+ More measurements (optional)'}
        </button>

        {showMeasurements && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 overflow-hidden"
          >
            {(['hips', 'chest', 'arm', 'thigh'] as const).map((k) => (
              <div key={k}>
                <p className={`${labelCls} mb-1.5`}>{k} (in)</p>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className={inputCls}
                />
              </div>
            ))}
          </motion.div>
        )}

        <button
          onClick={save}
          disabled={saving || (!form.weight.trim() && !form.waist.trim())}
          className="w-full mt-4 py-3.5 bg-brand-orange text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-control hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {userId && <ProgressPhotos userId={userId} latest={rows[0] ?? null} onSaved={reload} />}

      {/* History */}
      {rows.length > 0 && (
        <div className="bg-surface-raised rounded-card border border-white/[0.10] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.10]">
            <p className="font-display font-bold text-white text-sm">History</p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {rows.slice(0, 12).map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-white/50 text-sm font-body">
                  {new Date(r.recorded_on + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-white text-sm font-body tabular-nums">
                  {r.weight_lb != null && <>{Number(r.weight_lb)} lbs</>}
                  {r.waist_in != null && (
                    <span className="text-white/40 ml-3">waist {Number(r.waist_in)}&quot;</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
