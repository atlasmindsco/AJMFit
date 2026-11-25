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

const labelCls = 'font-display font-bold text-white text-label'
const hintCls = 'text-ink-3 text-label font-body mt-0.5 mb-2.5'

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
                : 'bg-white/[0.03] border-white/[0.08] text-ink-2 hover:bg-white/[0.06]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-ink-4 text-caption font-body">{low}</span>
        <span className="text-ink-4 text-caption font-body">{high}</span>
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
  /**
   * The most recent weigh-in on record, and when it was taken.
   *
   * Kept apart from `weight` so a stale one can be SHOWN without being
   * SUBMITTED. The field used to prefill from this whatever its age, and
   * submitting wrote it back to body_metrics dated today — so a client who
   * last weighed in three weeks ago silently stamped a three-week-old number
   * as this week's, every week, flattening the trend the check-in exists to
   * track.
   */
  const [lastWeighIn, setLastWeighIn] = useState<{ lb: number; on: string } | null>(null)
  /**
   * Whether the optional half is open.
   *
   * Nine fields in one scrolling column, with no sign that seven of them were
   * optional and two were already filled in. Only three are needed to send,
   * and that was true before this change — the screen just never said so.
   */
  const [showMore, setShowMore] = useState(false)
  const [workouts, setWorkouts] = useState('')
  const [nutrition, setNutrition] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  // Hunger, sleep and training quality are what tell a deficit that is working
  // apart from one that is about to fail. They degrade before the weight trend
  // does, so without them the engine would keep cutting someone who is
  // quietly falling apart. Optional on purpose: a longer form gets abandoned.
  const [hunger, setHunger] = useState<number | null>(null)
  const [sleep, setSleep] = useState<number | null>(null)
  const [performance, setPerformance] = useState<number | null>(null)
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
          setHunger(mine.hunger)
          setSleep(mine.sleep_quality)
          setPerformance(mine.training_performance)
          setWin(mine.win ?? '')
          setObstacle(mine.obstacle ?? '')
        } else {
          // Pre-fill what the app already knows so the client confirms rather
          // than recalls. The workout count is counted from this week, so it
          // is always about this week.
          setWorkouts(String(logged))

          // The weight is not. A weigh-in is only this week's if it was taken
          // this week — anything older gets shown as a reminder of where they
          // were, with its date, and an empty box to fill in. Prefilling an
          // old number is how the same weight got re-saved week after week.
          const lastWeight = metrics.find((m) => m.weight_lb != null)
          if (lastWeight?.weight_lb != null) {
            setLastWeighIn({ lb: Number(lastWeight.weight_lb), on: lastWeight.recorded_on })
            if (lastWeight.recorded_on >= week) setWeight(String(Number(lastWeight.weight_lb)))
          }
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

  /**
   * The smallest check-in worth sending.
   *
   * Three taps. Training is in here now because it is the one Anthony coaches
   * on, and because the form shows it directly above the button — a required
   * set that does not match what is on screen is how a form feels broken.
   * Sleep, hunger, the win and the obstacle stay optional.
   */
  const canSubmit = nutrition !== null && energy !== null && performance !== null

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
        hunger,
        sleep_quality: sleep,
        training_performance: performance,
        win: win.trim() || null,
        obstacle: obstacle.trim() || null,
      })
      // The weight belongs in the trend too, not just on this check-in — but
      // only when it is genuinely NEW. If the box still holds the weigh-in it
      // was prefilled with, writing it again just re-dates an old reading and
      // the trend goes flat.
      const unchanged = lastWeighIn != null && w === lastWeighIn.lb
      if (w != null && !unchanged) await saveBodyMetric(userId, { weight_lb: w })
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
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Update sent</h1>
        <p className="text-ink-2 text-body font-body mt-2 max-w-sm mx-auto leading-relaxed">
          Anthony has it. He&rsquo;ll come back to you with what to change, if anything — you&rsquo;ll see his reply
          here and in your messages.
        </p>
        <Link
          href="/studio"
          className="inline-block mt-6 px-5 py-3 rounded-control bg-brand-orange text-white text-label font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-orangedark transition-colors duration-200"
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
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Weekly update</h1>
        <p className="text-ink-3 text-body font-body mt-1">
          Three taps. This is what Anthony uses to decide what changes next week.
        </p>
      </header>

      {existing && (
        <div className="bg-brand-blue/[0.08] border border-brand-blue/25 rounded-card p-4 mb-4">
          <p className="text-ink-2 text-label font-body">
            You already sent this week&rsquo;s check-in. Changing anything below updates it.
          </p>
        </div>
      )}

      {/* What the app already knows, stated rather than asked.
          Both of these were being PREFILLED into number inputs, which looks
          exactly like a question — so a client read two fields they had to
          check before they reached the three that actually needed them. The
          inputs still exist, under "Add more", for the times the count is
          wrong or they weighed in this morning. */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-card px-4 py-3 mb-3">
        <p className="text-ink-2 text-body font-body">
          <span className="text-white font-semibold">
            {workouts.trim() === '' ? 'No' : workouts} workout{workouts.trim() === '1' ? '' : 's'}
          </span>{' '}
          logged this week
          {lastWeighIn && (
            <>
              {' · '}
              <span className="text-white font-semibold">{Number(lastWeighIn.lb)} lbs</span>
              {lastWeighIn.on < week
                ? `, last weighed ${new Date(lastWeighIn.on + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                : ' this week'}
            </>
          )}
        </p>
      </div>

      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 space-y-6">
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
          <p className={labelCls}>How was training?</p>
          <p className={hintCls}>Strength and effort compared to last week.</p>
          <Scale value={performance} onChange={setPerformance} low="Much worse" high="Much better" />
        </div>

        {/* Everything optional, behind one tap.
            None of it stopped being collected and none of it stopped being
            stored — the trainer view reads the same nine columns it always
            did. Bodyweight leads because it is the one that feeds a trend. */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className="w-full text-left text-ink-3 hover:text-ink-2 text-label font-display font-bold uppercase tracking-wide transition-colors duration-200"
        >
          {showMore ? 'Less' : 'Add more'} {showMore ? '↑' : '↓'}
        </button>

        {showMore && (
          <div className="space-y-6 pt-1">
        <div>
          <p className={labelCls}>Bodyweight</p>
          <p className={hintCls}>
            {lastWeighIn && lastWeighIn.on < week
              ? `Last weighed ${Number(lastWeighIn.lb)} lbs on ${new Date(lastWeighIn.on + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Leave it blank if you haven't weighed in.`
              : 'Same day, same time each week if you can.'}
          </p>
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
          <p className={labelCls}>How hungry were you?</p>
          <p className={hintCls}>Constant hunger is the warning sign, not a test of willpower.</p>
          <Scale value={hunger} onChange={setHunger} low="Comfortable" high="Hungry all the time" />
        </div>

        <div>
          <p className={labelCls}>Sleep quality</p>
          <p className={hintCls}>Poor sleep stalls fat loss on its own.</p>
          <Scale value={sleep} onChange={setSleep} low="Broken" high="Slept well" />
        </div>
        <div>
          <p className={labelCls}>Best thing this week</p>
          <p className={hintCls}>A lift, a habit, turning up when you didn&rsquo;t want to.</p>
          <textarea
            rows={2}
            value={win}
            onChange={(e) => setWin(e.target.value)}
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-body font-body placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50"
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
            className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-body font-body placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50"
            placeholder="Travelled Thursday and Friday, missed both sessions"
          />
        </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="w-full py-4 bg-brand-orange text-white text-label font-display font-bold uppercase tracking-[0.12em] rounded-control hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        >
          {saving ? 'Sending…' : existing ? 'Update check-in' : 'Send check-in'}
        </button>
        {!canSubmit && (
          <p className="text-ink-4 text-label font-body text-center">
            Rate eating, energy and training to send. The rest is optional.
          </p>
        )}
      </div>

      {answered.length > 0 && (
        <div className="mt-6">
          <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-[0.15em] mb-2">
            Anthony&rsquo;s past replies
          </p>
          <div className="space-y-2">
            {answered.slice(0, 4).map((c) => (
              <div key={c.id} className="bg-surface-raised rounded-card border border-white/[0.10] p-4">
                <p className="text-ink-4 text-caption font-display font-bold uppercase tracking-wide">
                  Week of{' '}
                  {new Date(c.week_of + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-ink text-body font-body mt-1.5 whitespace-pre-wrap leading-relaxed">
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
