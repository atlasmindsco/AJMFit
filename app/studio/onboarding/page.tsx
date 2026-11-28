'use client'

/**
 * The coaching assessment: eight questions, one screen.
 *
 * It was seventeen questions across five cards and had one submission in the
 * product's lifetime. Everything here changes which program gets assigned;
 * nothing here is a good coaching question asked at the wrong moment. Stress,
 * sleep and job activity moved to the welcome call, where the answer is a
 * conversation rather than a number, and the weekly check-in asks about sleep
 * every week regardless.
 *
 * Two questions are new and matter most: where they train, and how long they
 * have. Those are two of the three inputs that pick a template, and the old
 * form never asked either — so the questionnaire could not answer the question
 * it existed to answer, which is probably part of why nobody finished it.
 */
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fadeIn } from '@/lib/animations'
import { getCurrentUserId } from '@/lib/current-user'
import { fetchMyOnboarding, saveMyOnboarding, type OnboardingAnswers } from '@/lib/onboarding'
import { fetchMyTier } from '@/lib/scheduling'

const inputCls =
  'w-full px-4 py-3 bg-[#222] border border-white/[0.10] rounded-control text-white text-body font-body placeholder:text-ink-4 focus:outline-none focus:border-brand-blueink transition-colors'
const labelCls = 'block text-ink-2 text-label font-display font-bold uppercase tracking-[0.12em] mb-2'
const hintCls = 'text-ink-3 text-label font-body mb-2.5'

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string | undefined
  onChange: (v: string) => void
  options: Array<{ key: string; label: string; sub?: string }>
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`px-4 py-3 rounded-control text-left border transition-colors duration-150 ${
            value === o.key
              ? 'bg-brand-blue/[0.14] border-brand-blue/50'
              : 'bg-white/[0.03] border-white/[0.10] hover:bg-white/[0.06]'
          }`}
        >
          <span className={`block font-display font-bold text-label ${value === o.key ? 'text-white' : 'text-ink-2'}`}>
            {o.label}
          </span>
          {o.sub && <span className="block text-ink-3 text-caption font-body mt-0.5">{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

export default function CoachingAssessmentPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<OnboardingAnswers>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [alreadyFilled, setAlreadyFilled] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!active) return
      if (!id) {
        setLoading(false)
        return
      }
      setUserId(id)
      try {
        // Blueprint is self-serve: they pick their own program, so there is
        // nothing for a coach to assess.
        const tier = await fetchMyTier(id)
        if (tier === 'blueprint') {
          router.replace('/studio/programs')
          return
        }
        const existing = await fetchMyOnboarding(id)
        if (active && existing) {
          setAnswers(existing.answers ?? {})
          setAlreadyFilled(true)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [router])

  const set = useCallback(
    (key: keyof OnboardingAnswers) => (v: string) => setAnswers((a) => ({ ...a, [key]: v })),
    []
  )
  const setFromInput =
    (key: keyof OnboardingAnswers) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key)(e.target.value)

  // The four the template matcher needs. Weight, injuries and the free text
  // are useful to the coach but never block a program being built.
  const canSubmit = Boolean(answers.goal && answers.experience && answers.daysPerWeek && answers.location)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || saving || !canSubmit) return
    setSaving(true)
    setError('')
    try {
      await saveMyOnboarding(userId, answers)
      fetch('/api/onboarding/notify', { method: 'POST' }).catch(() => {})
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('[Assessment] save failed:', err)
      setError('Could not save your answers. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="max-w-xl mx-auto text-center py-16">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-state-success/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-state-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          {alreadyFilled ? 'Answers updated' : 'Anthony is building your program'}
        </h1>
        <p className="text-ink-3 text-body font-body mt-3 max-w-md mx-auto leading-relaxed">
          {alreadyFilled
            ? 'He will see the changes before your next check-in.'
            : 'He reviews this and assigns your program, usually the same day. You will get a message when it is ready.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <button
            onClick={() => router.push('/studio')}
            className="px-6 py-3 bg-brand-orange text-white text-label font-display font-bold uppercase tracking-[0.1em] rounded-control hover:bg-brand-orangedark active:scale-[0.98] transition"
          >
            Go to dashboard
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-7">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          Before Anthony builds your program
        </h1>
        <p className="text-ink-3 text-body font-body mt-2 max-w-lg">
          Eight questions, about two minutes. He reads every one of these before he assigns anything.
        </p>
      </motion.div>

      <form onSubmit={submit} className="space-y-5">
        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>1 &middot; What are you training for?</label>
          <Segmented
            value={answers.goal}
            onChange={set('goal')}
            options={[
              { key: 'muscle', label: 'Build muscle', sub: 'Size and shape' },
              { key: 'strength', label: 'Get stronger', sub: 'Heavier lifts' },
              { key: 'lean_out', label: 'Lean out', sub: 'Lose fat, keep muscle' },
            ]}
          />
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>2 &middot; Where are you right now?</label>
          <Segmented
            value={answers.experience}
            onChange={set('experience')}
            options={[
              { key: 'new', label: 'New to this', sub: 'First real program' },
              { key: 'returning', label: 'Coming back', sub: 'Trained before' },
              { key: 'consistent', label: 'Training already', sub: 'In the gym most weeks' },
            ]}
          />
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>3 &middot; How many days a week can you train?</label>
          <p className={hintCls}>Be realistic. A program you finish beats one you admire.</p>
          <div className="grid grid-cols-5 gap-2">
            {['2', '3', '4', '5', '6'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set('daysPerWeek')(d)}
                className={`py-3.5 rounded-control border font-display font-extrabold text-lg transition-colors duration-150 ${
                  answers.daysPerWeek === d
                    ? 'bg-brand-blue/[0.14] border-brand-blue/50 text-white'
                    : 'bg-white/[0.03] border-white/[0.10] text-ink-2 hover:bg-white/[0.06]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>4 &middot; Where will you train?</label>
          <Segmented
            value={answers.location}
            onChange={set('location')}
            options={[
              { key: 'gym', label: 'At a gym', sub: 'Full equipment' },
              { key: 'home', label: 'At home', sub: 'Dumbbells and bodyweight' },
            ]}
          />
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>5 &middot; How long have you got per session?</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { k: '30', l: '30 min' },
              { k: '45', l: '45 min' },
              { k: '60', l: '60 min' },
              { k: '75', l: '75+ min' },
            ].map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => set('sessionMinutes')(o.k)}
                className={`py-3 rounded-control border font-display font-bold text-label transition-colors duration-150 ${
                  answers.sessionMinutes === o.k
                    ? 'bg-brand-blue/[0.14] border-brand-blue/50 text-white'
                    : 'bg-white/[0.03] border-white/[0.10] text-ink-2 hover:bg-white/[0.06]'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>6 &middot; Anything that hurts, or that you cannot do?</label>
          <p className={hintCls}>
            Injuries, surgeries, a joint that complains. This is the one he most wants to know before
            picking exercises.
          </p>
          <textarea
            className={`${inputCls} min-h-[84px] resize-y`}
            value={answers.injuries ?? ''}
            onChange={setFromInput('injuries')}
            placeholder="Left knee hurts on deep squats. Nothing else."
          />
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>7 &middot; Where are you now, and where are you heading?</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={hintCls}>Current weight</p>
              <input className={inputCls} value={answers.currentWeight ?? ''} onChange={setFromInput('currentWeight')} placeholder="185 lbs" />
            </div>
            <div>
              <p className={hintCls}>Target weight (optional)</p>
              <input className={inputCls} value={answers.goalWeight ?? ''} onChange={setFromInput('goalWeight')} placeholder="170 lbs" />
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-card border border-white/[0.10] p-6">
          <label className={labelCls}>8 &middot; Anything else he should know?</label>
          <textarea
            className={`${inputCls} min-h-[84px] resize-y`}
            value={answers.anythingElse ?? ''}
            onChange={setFromInput('anythingElse')}
            placeholder="I travel most of February. I hate running."
          />
        </div>

        {error && (
          <p className="px-3.5 py-2.5 rounded-control bg-state-danger/10 border border-state-danger/25 text-state-danger text-label font-body">
            {error}
          </p>
        )}

        {/* The button stays visible but disabled rather than hidden: a form
            whose submit disappears reads as broken, not as incomplete. */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="w-full py-4 bg-brand-orange text-white text-label font-display font-bold uppercase tracking-[0.12em] rounded-card hover:bg-brand-orangedark active:scale-[0.99] transition disabled:opacity-40"
          >
            {saving ? 'Sending…' : alreadyFilled ? 'Save changes' : 'Send to Anthony'}
          </button>
          {!canSubmit && (
            <p className="text-ink-3 text-label font-body mt-2.5 text-center">
              Answer questions 1 to 4 and he has what he needs.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
