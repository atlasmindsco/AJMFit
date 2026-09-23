'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUserId } from '@/lib/current-user'
import { fetchWorkoutsThisWeek } from '@/lib/workout'
import { fetchBodyMetrics, saveBodyMetric } from '@/lib/body-metrics'
import {
  fetchCheckInForWeek,
  fetchMyCheckIns,
  submitCheckIn,
  weekOf,
  type CheckIn,
} from '@/lib/check-ins'

const labelCls = 'font-display font-bold text-white text-sm'
const hintCls = 'text-white/40 text-xs font-body mt-0.5 mb-2.5'

/** 1-5 selector. Words, not bare numbers — "3" means nothing on its own. */
function Scale({
  value,
  onChange,
  low,
  high,
}: {
  value: number | null
  onChange: (n: number) => void
  low: string
  high: string
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`py-3 rounded-control border font-display font-extrabold text-lg transition-all duration-200 active:scale-[0.97] ${
              value === n
                ? 'bg-brand-orange/[0.14] border-brand-orange/50 text-white'
                : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-white/30 text-[10px] font-body">{low}</span>
        <span className="text-white/30 text-[10px] font-body">{high}</span>
      </div>
    </div>
  )
}

export default function CheckInPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<CheckIn | null>(null)
  const [history, setHistory] = useState<CheckIn[]>([])
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [weight, setWeight] = useState('')
  const [workouts, setWorkouts] = useState('')
  const [nutrition, setNutrition] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [win, setWin] = useState('')
  const [obstacle, setObstacle] = useState('')

  const week = weekOf()

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
        const [mine, logged, metrics, past] = await Promise.all([
          fetchCheckInForWeek(id, week),
          fetchWorkoutsThisWeek(id).catch(() => 0),
          fetchBodyMetrics(id, 3).catch(() => []),
          fetchMyCheckIns(id, 8).catch(() => []),
        ])
        if (!active) return
        setHistory(past)
        if (mine) {
          setExisting(mine)
          setWeight(mine.weight_lb != null ? String(Number(mine.weight_lb)) : '')
          setWorkouts(mine.workouts_completed != null ? String(mine.workouts_completed) : '')
          setNutrition(mine.nutrition_adherence)
          setEnergy(mine.energy)
          setWin(mine.win ?? '')
          setObstacle(mine.obstacle ?? '')
        } else {
          // Pre-fill what the app already knows so the client confirms rather
          // than recalls.
          setWorkouts(String(logged))
          const lastWeight = metrics.find((m) => m.weight_lb != null)
          if (lastWeight?.weight_lb != null) setWeight(String(Number(lastWeight.weight_lb)))
        }
      } catch (e) {
        console.error('[Check-in] load failed', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [week])

  const canSubmit = nutrition !== null && energy !== null

  const submit = async () => {
    if (!userId || !canSubmit) return
    setSaving(true)
    try {
      const w = weight.trim() === '' ? null : Number(weight)
      await submitCheckIn(userId, week, {
        weight_lb: w,
        workouts_completed: workouts.trim() === '' ? null : Number(workouts),
        nutrition_adherence: nutrition,
        energy,
        win: win.trim() || null,
        obstacle: obstacle.trim() || null,
      })
      // The weight belongs in the trend too, not just on this check-in.
      if (w != null) await saveBodyMetric(userId, { weight_lb: w })
      fetch('/api/studio/check-in-notify', { method: 'POST' }).catch(() => {})
      setSubmitted(true)
    } catch (e) {
      console.error('[Check-in] submit failed', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Check-in sent</h1>
        <p className="text-white/50 text-sm font-body mt-2 max-w-sm mx-auto leading-relaxed">
          Anthony has it. He&rsquo;ll come back to you with what to change, if anything — you&rsquo;ll see his reply
          here and in your messages.
        </p>
        <Link
          href="/studio"
          className="inline-block mt-6 px-5 py-3 rounded-control bg-brand-orange text-white text-xs font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-orangedark transition-colors duration-200"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  const answered = history.filter((h) => h.coach_response)

  return (
    <div className="max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Weekly check-in</h1>
        <p className="text-white/40 text-sm font-body mt-1">
          Six questions, about a minute. This is what Anthony uses to decide what changes next week.
        </p>
      </header>

      {existing && (
        <div className="bg-brand-blue/[0.08] border border-brand-blue/25 rounded-card p-4 mb-4">
          <p className="text-white/70 text-xs font-body">
            You already sent this week&rsquo;s check-in. Changing anything below updates it.
          </p>
        </div>
      )}

      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 space-y-6">
        <div>
          <p className={labelCls}>Bodyweight</p>
          <p className={hintCls}>Same day, same time each week if you can.</p>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="185"
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body focus:outline-none focus:border-brand-blue/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div>
          <p className={labelCls}>Workouts completed</p>
          <p className={hintCls}>We filled this in from what you logged — correct it if it&rsquo;s wrong.</p>
          <input
            type="number"
            inputMode="numeric"
            value={workouts}
            onChange={(e) => setWorkouts(e.target.value)}
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body focus:outline-none focus:border-brand-blue/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div>
          <p className={labelCls}>How did eating go?</p>
          <p className={hintCls}>Be honest. A 2 tells him more than a generous 4.</p>
          <Scale value={nutrition} onChange={setNutrition} low="Off the rails" high="Dialled in" />
        </div>

        <div>
          <p className={labelCls}>Energy and recovery</p>
          <p className={hintCls}>Sleep, soreness, how you felt in the gym.</p>
          <Scale value={energy} onChange={setEnergy} low="Running on empty" high="Fresh" />
        </div>

        <div>
          <p className={labelCls}>Best thing this week</p>
          <p className={hintCls}>A lift, a habit, turning up when you didn&rsquo;t want to.</p>
          <textarea
            rows={2}
            value={win}
            onChange={(e) => setWin(e.target.value)}
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-sm font-body placeholder:text-white/20 focus:outline-none focus:border-brand-blue/50"
            placeholder="Squatted 185 for the first time"
          />
        </div>

        <div>
          <p className={labelCls}>What got in the way</p>
          <p className={hintCls}>This is the one that actually changes your program.</p>
          <textarea
            rows={2}
            value={obstacle}
            onChange={(e) => setObstacle(e.target.value)}
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-sm font-body placeholder:text-white/20 focus:outline-none focus:border-brand-blue/50"
            placeholder="Travelled Thursday and Friday, missed both sessions"
          />
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="w-full py-4 bg-brand-orange text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-control hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        >
          {saving ? 'Sending…' : existing ? 'Update check-in' : 'Send check-in'}
        </button>
        {!canSubmit && (
          <p className="text-white/30 text-xs font-body text-center">
            Rate eating and energy to send.
          </p>
        )}
      </div>

      {answered.length > 0 && (
        <div className="mt-6">
          <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-[0.15em] mb-2">
            Anthony&rsquo;s past replies
          </p>
          <div className="space-y-2">
            {answered.slice(0, 4).map((c) => (
              <div key={c.id} className="bg-surface-raised rounded-card border border-white/[0.10] p-4">
                <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-wide">
                  Week of{' '}
                  {new Date(c.week_of + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-white/75 text-sm font-body mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {c.coach_response}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
