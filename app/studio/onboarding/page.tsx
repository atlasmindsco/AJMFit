'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fadeIn } from '@/lib/animations'
import { getCurrentUserId } from '@/lib/current-user'
import { fetchMyOnboarding, saveMyOnboarding, type OnboardingAnswers } from '@/lib/onboarding'

const inputCls =
  'w-full px-4 py-3 bg-[#222] border border-white/[0.10] rounded-lg text-white text-sm font-body placeholder:text-white/25 focus:outline-none focus:border-[#1A7BFF]/60 transition-colors'
const labelCls = 'block text-white/60 text-xs font-display font-bold uppercase tracking-[0.12em] mb-2'

/** Segmented picker for short option sets. */
function Segmented({
  value,
  onChange,
  options,
}: {
  value: string | undefined
  onChange: (v: string) => void
  options: Array<{ key: string; label: string }>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide border transition-colors duration-150 ${
            value === o.key
              ? 'bg-[#1A7BFF]/15 border-[#1A7BFF]/50 text-[#1A7BFF]'
              : 'bg-white/[0.03] border-white/[0.10] text-white/40 hover:text-white/70'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function OnboardingFormPage() {
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
  }, [])

  const set = (key: keyof OnboardingAnswers) => (v: string) =>
    setAnswers((a) => ({ ...a, [key]: v }))
  const setFromInput =
    (key: keyof OnboardingAnswers) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key)(e.target.value)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || saving) return
    setSaving(true)
    setError('')
    try {
      await saveMyOnboarding(userId, answers)
      // Tell Coach Anthony (instructional email). Best-effort.
      fetch('/api/onboarding/notify', { method: 'POST' }).catch(() => {})
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('[Onboarding] save failed:', err)
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
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          {alreadyFilled ? 'Answers updated' : 'All set'}
        </h1>
        <p className="text-white/50 text-sm font-body mt-3 max-w-md mx-auto">
          Coach Anthony has your answers and will review them before your onboarding call. Next step: book the call if you haven&rsquo;t yet.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <button
            onClick={() => router.push('/studio/schedule')}
            className="px-6 py-3 bg-[#F76B16] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-[#D8590C] active:scale-[0.98] transition"
          >
            Book your onboarding call
          </button>
          <button
            onClick={() => router.push('/studio')}
            className="px-6 py-3 bg-white/[0.06] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-white/[0.10] active:scale-[0.98] transition"
          >
            Go to dashboard
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          Onboarding Form
        </h1>
        <p className="text-white/40 text-sm font-body mt-2 max-w-lg">
          This is what Coach Anthony uses to prepare your plan and your onboarding call. Takes about 3 minutes. Be honest, there are no wrong answers.
        </p>
      </motion.div>

      <form onSubmit={submit} className="space-y-6">
        {/* Basics */}
        <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-6 space-y-5">
          <h2 className="font-display font-bold text-sm text-white uppercase tracking-wide">The basics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Age</label>
              <input className={inputCls} value={answers.age ?? ''} onChange={setFromInput('age')} placeholder="34" inputMode="numeric" />
            </div>
            <div>
              <label className={labelCls}>Height</label>
              <input className={inputCls} value={answers.height ?? ''} onChange={setFromInput('height')} placeholder={'5\'10"'} />
            </div>
            <div>
              <label className={labelCls}>Current weight</label>
              <input className={inputCls} value={answers.currentWeight ?? ''} onChange={setFromInput('currentWeight')} placeholder="185 lbs" />
            </div>
            <div>
              <label className={labelCls}>Goal weight (optional)</label>
              <input className={inputCls} value={answers.goalWeight ?? ''} onChange={setFromInput('goalWeight')} placeholder="170 lbs" />
            </div>
          </div>
        </div>

        {/* Training background */}
        <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-6 space-y-5">
          <h2 className="font-display font-bold text-sm text-white uppercase tracking-wide">Training background</h2>
          <div>
            <label className={labelCls}>Where are you right now?</label>
            <Segmented
              value={answers.experience}
              onChange={set('experience')}
              options={[
                { key: 'new', label: 'New to training' },
                { key: 'returning', label: 'Getting back into it' },
                { key: 'consistent', label: 'Training consistently' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Years of experience</label>
              <input className={inputCls} value={answers.yearsTraining ?? ''} onChange={setFromInput('yearsTraining')} placeholder="2" inputMode="numeric" />
            </div>
            <div>
              <label className={labelCls}>Days per week you can train</label>
              <input className={inputCls} value={answers.daysPerWeek ?? ''} onChange={setFromInput('daysPerWeek')} placeholder="4" inputMode="numeric" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Best time of day for you</label>
            <Segmented
              value={answers.preferredTime}
              onChange={set('preferredTime')}
              options={[
                { key: 'morning', label: 'Morning' },
                { key: 'midday', label: 'Midday' },
                { key: 'evening', label: 'Evening' },
              ]}
            />
          </div>
        </div>

        {/* Health */}
        <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-6 space-y-5">
          <h2 className="font-display font-bold text-sm text-white uppercase tracking-wide">Health</h2>
          <div>
            <label className={labelCls}>Injuries, pain, or movements that bother you</label>
            <textarea className={inputCls} rows={2} value={answers.injuries ?? ''} onChange={setFromInput('injuries')} placeholder="Right shoulder clicks on overhead press, lower back gets tight on deadlifts" />
          </div>
          <div>
            <label className={labelCls}>Medications or conditions Anthony should know about</label>
            <textarea className={inputCls} rows={2} value={answers.medications ?? ''} onChange={setFromInput('medications')} placeholder="None" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sleep (hours per night)</label>
              <input className={inputCls} value={answers.sleepHours ?? ''} onChange={setFromInput('sleepHours')} placeholder="7" inputMode="numeric" />
            </div>
            <div>
              <label className={labelCls}>Stress level (1 low to 5 high)</label>
              <input className={inputCls} value={answers.stressLevel ?? ''} onChange={setFromInput('stressLevel')} placeholder="3" inputMode="numeric" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Your day job, activity wise</label>
            <Segmented
              value={answers.jobActivity}
              onChange={set('jobActivity')}
              options={[
                { key: 'sedentary', label: 'Mostly seated' },
                { key: 'on-my-feet', label: 'On my feet' },
                { key: 'physical', label: 'Physical work' },
              ]}
            />
          </div>
        </div>

        {/* Nutrition */}
        <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-6 space-y-5">
          <h2 className="font-display font-bold text-sm text-white uppercase tracking-wide">Nutrition</h2>
          <div>
            <label className={labelCls}>How do you eat right now?</label>
            <textarea className={inputCls} rows={2} value={answers.eatingStyle ?? ''} onChange={setFromInput('eatingStyle')} placeholder="Skip breakfast, big lunch, takeout 3 nights a week" />
          </div>
          <div>
            <label className={labelCls}>Allergies or foods you will not eat</label>
            <input className={inputCls} value={answers.foodAllergies ?? ''} onChange={setFromInput('foodAllergies')} placeholder="No shellfish" />
          </div>
        </div>

        {/* Goals */}
        <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-6 space-y-5">
          <h2 className="font-display font-bold text-sm text-white uppercase tracking-wide">Your goal</h2>
          <div>
            <label className={labelCls}>90 days from now, what does success look like?</label>
            <textarea className={inputCls} rows={3} value={answers.ninetyDayGoal ?? ''} onChange={setFromInput('ninetyDayGoal')} placeholder="Down 10 lbs, comfortable in the gym, bench 185 again" />
          </div>
          <div>
            <label className={labelCls}>Anything else Anthony should know? (optional)</label>
            <textarea className={inputCls} rows={2} value={answers.anythingElse ?? ''} onChange={setFromInput('anythingElse')} />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm font-body">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-[#F76B16] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-[#D8590C] active:scale-[0.99] transition disabled:opacity-60"
        >
          {saving ? 'Saving…' : alreadyFilled ? 'Update my answers' : 'Send to Coach Anthony'}
        </button>
      </form>
    </div>
  )
}
