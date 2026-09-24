'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUserId } from '@/lib/current-user'
import { fetchMyOnboarding } from '@/lib/onboarding'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  EMPTY_HEALTH_SCREEN,
  FitnessGoal,
  HEALTH_SCREEN_QUESTIONS,
  HealthScreen,
  JOB_ACTIVITY_OPTIONS,
  JobActivity,
  NutritionGoalSetup,
  Sex,
  activityMultiplier,
  calculateNutritionTargets,
  clampExplanation,
  nearestActivityLevel,
  getActivityLevelLabel,
  getGoalLabel,
  screenHealth,
  validateSetup,
} from '@/lib/nutrition-goals'

export default function SetupNutritionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEditing = searchParams.get('edit') === 'true'

  // The screen comes first and cannot be skipped: it decides whether this
  // client should be given an automated calorie target at all.
  const [step, setStep] = useState<'screen' | 'form' | 'review' | 'blocked'>('screen')
  const [loading, setLoading] = useState(isEditing)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(isEditing)
  const [health, setHealth] = useState<HealthScreen>(EMPTY_HEALTH_SCREEN)
  const [blockMessage, setBlockMessage] = useState('')

  const [setup, setSetup] = useState<NutritionGoalSetup>({
    currentWeight: 0,
    goalWeight: 0,
    height: 0,
    age: 0,
    sex: 'male',
    // Kept and still written for anything that reads activity_level, but it is
    // derived from the two fields below rather than chosen by the client.
    activityLevel: 'moderate',
    goal: 'maintain',
    jobActivity: 'sedentary',
    trainingDaysPerWeek: 3,
  })
  const [prefilled, setPrefilled] = useState(false)
  const [heightFeet, setHeightFeet] = useState(0)
  const [heightInches, setHeightInches] = useState(0)

  // Pre-fill the two activity facts from onboarding. The client already
  // answered both; asking again in different words is how the old dropdown
  // ended up being the least reliable input in the calculation.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const id = await getCurrentUserId()
        if (!id || !active) return
        const form = await fetchMyOnboarding(id)
        if (!form || !active) return
        const job = form.answers.jobActivity
        const days = parseInt(form.answers.daysPerWeek ?? '', 10)
        const validJob = JOB_ACTIVITY_OPTIONS.some((o) => o.value === job)
        if (!validJob && !Number.isFinite(days)) return
        setSetup((prev) => ({
          ...prev,
          ...(validJob ? { jobActivity: job as JobActivity } : {}),
          ...(Number.isFinite(days) ? { trainingDaysPerWeek: Math.max(0, Math.min(7, days)) } : {}),
        }))
        setPrefilled(true)
      } catch {
        // Onboarding is optional. The defaults stand.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Load existing setup if editing
  useEffect(() => {
    if (!isEditing) {
      setPageLoading(false)
      return
    }

    ;(async () => {
      try {
        const res = await fetch('/api/nutrition/get-setup')
        if (!res.ok) throw new Error('Failed to load setup')

        const data = await res.json()
        const heightInchesTotal = data.height || 0
        const feet = Math.floor(heightInchesTotal / 12)
        const inches = heightInchesTotal % 12

        setSetup({
          currentWeight: data.currentWeight || 0,
          goalWeight: data.goalWeight || 0,
          height: heightInchesTotal,
          age: data.age || 0,
          sex: data.sex || 'male',
          activityLevel: data.activityLevel || 'moderate',
          goal: data.goal || 'maintain',
          jobActivity: data.jobActivity ?? 'sedentary',
          trainingDaysPerWeek: data.trainingDaysPerWeek ?? 3,
        })
        setHeightFeet(feet)
        setHeightInches(inches)
        if (data.healthScreen) {
          setHealth({ ...EMPTY_HEALTH_SCREEN, ...data.healthScreen })
        }
      } catch (err) {
        console.error('Failed to load setup:', err)
        setError('Could not load your nutrition setup')
      } finally {
        setPageLoading(false)
      }
    })()
  }, [isEditing])

  const handleChange = (field: keyof NutritionGoalSetup, value: any) => {
    setSetup((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleContinue = () => {
    const errors = validateSetup(setup)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }
    setStep('review')
  }

  const handleScreenContinue = () => {
    const outcome = screenHealth(health)
    if (outcome.blocked) {
      setBlockMessage(outcome.message ?? '')
      setStep('blocked')
      // Tell the server so Anthony is flagged, even though the client stops here.
      void fetch('/api/nutrition/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...setup, healthScreen: health }),
      }).catch(() => {})
      return
    }
    setStep('form')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      // No localStorage mirror. There used to be one, paired with a fallback
      // in fetchTargets that treated 2,000 calories as "the save failed" and
      // silently restored stale local values over a real target.
      // activity_level is still written so nothing reading that column breaks.
      // It is derived from the two facts above rather than asked for.
      const derived =
        setup.jobActivity && typeof setup.trainingDaysPerWeek === 'number'
          ? nearestActivityLevel(activityMultiplier(setup.jobActivity, setup.trainingDaysPerWeek))
          : setup.activityLevel

      const response = await fetch('/api/nutrition/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...setup, activityLevel: derived, healthScreen: health }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.blocked) {
          setBlockMessage(data.error ?? '')
          setStep('blocked')
          setLoading(false)
          return
        }
        throw new Error(data.error || 'Failed to save nutrition goals')
      }

      // If editing, just go back to nutrition page; if new, same destination
      router.push('/studio/nutrition')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const calculated = calculateNutritionTargets(setup)

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-brand-offwhite flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-navy/10 border-t-brand-navy/40 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-offwhite flex flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Image src="/AJMfit.png" alt="AJMFit" width={80} height={80} className="w-20 h-20 object-contain" />
          </Link>
        </div>

        <div className="bg-white rounded-control border border-brand-navy/[0.08] shadow-[0_4px_40px_rgba(27,45,80,0.06)] p-8 md:p-10">
          {step === 'screen' ? (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                Before we start
              </h1>
              <p className="text-center text-sm font-body text-brand-slate mt-2">
                Tick anything that applies. If none do, carry straight on.
              </p>

              <div className="mt-8 space-y-2.5">
                {HEALTH_SCREEN_QUESTIONS.map((q) => (
                  <label
                    key={q.key}
                    className="flex items-start gap-3 p-3.5 rounded-control border border-brand-navy/[0.08] bg-brand-offwhite cursor-pointer hover:border-brand-blue/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={health[q.key]}
                      onChange={(e) => setHealth((p) => ({ ...p, [q.key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 shrink-0 accent-brand-blue"
                    />
                    <span className="font-body text-sm text-brand-navy leading-snug">{q.label}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs font-body text-brand-slate mt-4 leading-relaxed">
                Anthony is a certified personal trainer, not a dietitian. Some situations need
                nutrition advice from a medical professional, and this is how we catch them.
              </p>

              <button
                type="button"
                onClick={handleScreenContinue}
                className="mt-6 w-full py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-control hover:bg-brand-navy/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 transition-all duration-200"
              >
                Continue
              </button>
            </>
          ) : step === 'blocked' ? (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                Let&apos;s do this properly
              </h1>
              <div className="mt-6 p-4 rounded-control bg-brand-blue/[0.06] border border-brand-blue/20">
                <p className="font-body text-sm text-brand-navy leading-relaxed">{blockMessage}</p>
              </div>
              <p className="text-sm font-body text-brand-slate mt-4 leading-relaxed">
                Your training plan is unaffected. This only pauses automatic calorie and macro
                targets.
              </p>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep('screen')}
                  className="flex-1 py-3.5 bg-gray-200 text-gray-800 font-display font-bold text-sm uppercase tracking-[0.12em] rounded-control hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <Link
                  href="/studio/messages"
                  className="flex-1 py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-control hover:bg-brand-navy/90 transition-all text-center"
                >
                  Message Anthony
                </Link>
              </div>
            </>
          ) : step === 'form' ? (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                {isEditing ? 'Update Nutrition' : 'Nutrition Setup'}
              </h1>
              <p className="text-center text-sm font-body text-brand-slate mt-2">
                Let's calculate your personalized macro targets
              </p>

              <form className="mt-8 space-y-5">
                {/* Current Weight */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Current Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={setup.currentWeight || ''}
                    onChange={(e) => handleChange('currentWeight', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                    placeholder="180"
                  />
                </div>

                {/* Goal Weight */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Goal Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={setup.goalWeight || ''}
                    onChange={(e) => handleChange('goalWeight', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                    placeholder="170"
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Height
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={heightFeet || ''}
                        onChange={(e) => {
                          const feet = parseInt(e.target.value) || 0
                          setHeightFeet(feet)
                          handleChange('height', feet * 12 + (heightInches || 0))
                        }}
                        className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                        placeholder="5"
                        min="0"
                      />
                      <p className="text-xs text-brand-navy/40 mt-1 font-body">Feet</p>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={heightInches || ''}
                        onChange={(e) => {
                          const inches = parseInt(e.target.value) || 0
                          setHeightInches(inches)
                          handleChange('height', (heightFeet || 0) * 12 + inches)
                        }}
                        className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                        placeholder="10"
                        min="0"
                        max="11"
                      />
                      <p className="text-xs text-brand-navy/40 mt-1 font-body">Inches</p>
                    </div>
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    value={setup.age || ''}
                    onChange={(e) => handleChange('age', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                    placeholder="25"
                  />
                </div>

                {/* Sex */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Sex
                  </label>
                  <select
                    value={setup.sex}
                    onChange={(e) => handleChange('sex', e.target.value as Sex)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Activity, as two facts rather than one self-assessed band.
                    Both are pre-filled from onboarding where we already have
                    them, so for most clients this is a confirmation. */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Your day job
                  </label>
                  <select
                    value={setup.jobActivity ?? 'sedentary'}
                    onChange={(e) => handleChange('jobActivity', e.target.value as JobActivity)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                  >
                    {JOB_ACTIVITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Training days per week
                  </label>
                  <select
                    value={setup.trainingDaysPerWeek ?? 3}
                    onChange={(e) => handleChange('trainingDaysPerWeek', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? 'Not training yet' : `${d} day${d === 1 ? '' : 's'}`}
                      </option>
                    ))}
                  </select>
                  {prefilled && (
                    <p className="text-xs text-brand-navy/40 mt-1.5 font-body">
                      Filled in from what you told us at onboarding. Change it if it has moved.
                    </p>
                  )}
                </div>

                {/* Fitness Goal */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Fitness Goal
                  </label>
                  <select
                    value={setup.goal}
                    onChange={(e) => handleChange('goal', e.target.value as FitnessGoal)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                  >
                    <option value="lose_fat">Lose Fat</option>
                    <option value="build_muscle">Build Muscle</option>
                    <option value="body_recomposition">Body Recomposition</option>
                    <option value="maintain">Maintain Weight</option>
                  </select>
                </div>

                {error && <p className="text-sm font-body text-red-500">{error}</p>}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-control hover:bg-brand-navy/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 transition-all duration-200"
                >
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                Your Macro Targets
              </h1>
              <p className="text-center text-sm font-body text-brand-slate mt-2">
                Based on your goal and activity level
              </p>

              <div className="mt-8 space-y-4">
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-control p-4">
                  <p className="text-sm font-body text-brand-navy">
                    <strong>Goal:</strong> {getGoalLabel(setup.goal)}
                  </p>
                  <p className="text-sm font-body text-brand-navy mt-1">
                    <strong>Activity:</strong>{' '}
                    {JOB_ACTIVITY_OPTIONS.find((o) => o.value === setup.jobActivity)?.label ??
                      getActivityLevelLabel(setup.activityLevel)}
                    {', '}
                    {setup.trainingDaysPerWeek === 0
                      ? 'not training yet'
                      : `training ${setup.trainingDaysPerWeek}x a week`}
                  </p>
                  <p className="text-sm font-body text-brand-navy mt-1">
                    <strong>Target Weight:</strong> {setup.goalWeight} lbs
                  </p>
                </div>

                {/* Calories */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-control p-5 text-white">
                  <p className="text-sm font-display uppercase tracking-[0.1em] opacity-90">Daily Calories</p>
                  <p className="text-4xl font-display font-bold mt-2">{calculated.dailyCalories}</p>
                  {calculated.calorieDeficitOrSurplus !== 0 && (
                    <p className="text-sm mt-2 opacity-90">
                      {calculated.calorieDeficitOrSurplus > 0
                        ? `+${calculated.calorieDeficitOrSurplus} surplus`
                        : `${calculated.calorieDeficitOrSurplus} deficit`}
                    </p>
                  )}
                </div>

                {/* Where the number came from. A target a client does not
                    understand is a target they abandon in week three. */}
                <div className="rounded-control border border-brand-navy/[0.08] divide-y divide-brand-navy/[0.06]">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm font-body text-brand-slate">You burn about</span>
                    <span className="text-sm font-body font-semibold text-brand-navy">
                      {calculated.maintenanceCalories} cal/day
                    </span>
                  </div>
                  {calculated.expectedLbsPerWeek !== 0 && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-sm font-body text-brand-slate">
                        Expected {calculated.expectedLbsPerWeek < 0 ? 'loss' : 'gain'}
                      </span>
                      <span className="text-sm font-body font-semibold text-brand-navy">
                        {Math.abs(calculated.expectedLbsPerWeek)} lbs/week
                      </span>
                    </div>
                  )}
                  {calculated.weeksToGoal !== null && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-sm font-body text-brand-slate">
                        {setup.goalWeight} lbs by about
                      </span>
                      <span className="text-sm font-body font-semibold text-brand-navy">
                        {new Date(
                          Date.now() + calculated.weeksToGoal * 7 * 86400000
                        ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>

                {calculated.clamp && (
                  <div className="p-4 rounded-control bg-brand-orange/[0.06] border border-brand-orange/20">
                    <p className="font-body text-sm text-brand-navy leading-relaxed">
                      {clampExplanation(calculated.clamp, setup.sex)}
                    </p>
                  </div>
                )}

                {/* Macros */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-control p-4">
                    <p className="text-xs font-display uppercase tracking-[0.1em] text-orange-900">Protein</p>
                    <p className="text-2xl font-display font-bold text-orange-700 mt-1">{calculated.proteinGrams}g</p>
                    <p className="text-xs text-orange-600 mt-1">{Math.round(calculated.proteinGrams * 4)} cal</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-control p-4">
                    <p className="text-xs font-display uppercase tracking-[0.1em] text-green-900">Carbs</p>
                    <p className="text-2xl font-display font-bold text-green-700 mt-1">{calculated.carbGrams}g</p>
                    <p className="text-xs text-green-600 mt-1">{Math.round(calculated.carbGrams * 4)} cal</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-control p-4">
                    <p className="text-xs font-display uppercase tracking-[0.1em] text-yellow-900">Fat</p>
                    <p className="text-2xl font-display font-bold text-yellow-700 mt-1">{calculated.fatGrams}g</p>
                    <p className="text-xs text-yellow-600 mt-1">{Math.round(calculated.fatGrams * 9)} cal</p>
                  </div>
                </div>

                <p className="text-xs font-body text-brand-slate leading-relaxed">
                  These are a starting estimate from your height, weight, age and activity, not a
                  measurement of you. Anthony will adjust them from what your weight actually does
                  over the next few weeks.
                </p>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 py-3.5 bg-gray-200 text-gray-800 font-display font-bold text-sm uppercase tracking-[0.12em] rounded-control hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-control hover:bg-brand-navy/90 active:scale-[0.98] disabled:opacity-60 transition-all"
                >
                  {loading ? 'Saving...' : isEditing ? 'Update & Continue' : 'Confirm & Continue'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
