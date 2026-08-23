'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  ActivityLevel,
  FitnessGoal,
  NutritionGoalSetup,
  Sex,
  calculateNutritionTargets,
  getActivityLevelLabel,
  getGoalLabel,
  validateSetup,
} from '@/lib/nutrition-goals'

export default function SetupNutritionPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [setup, setSetup] = useState<NutritionGoalSetup>({
    currentWeight: 0,
    goalWeight: 0,
    height: 0,
    age: 0,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'maintain',
  })

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

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      console.log('[setup-nutrition] Submitting:', calculated)

      // ALWAYS save to localStorage first (guaranteed to work)
      if (typeof window !== 'undefined') {
        const goalsToSave = {
          calories: calculated.dailyCalories,
          protein: calculated.proteinGrams,
          carbs: calculated.carbGrams,
          fats: calculated.fatGrams,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem('nutrition_goals', JSON.stringify(goalsToSave))
        console.log('[setup-nutrition] ✓ Saved to localStorage:', goalsToSave)
        setSuccess(true)
      }

      // Then try to save to database (in background, don't block)
      fetch('/api/nutrition/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setup),
      })
        .then(res => res.json())
        .then(data => console.log('[setup-nutrition] Database save response:', data))
        .catch(err => console.error('[setup-nutrition] Database save error:', err))

      // Wait 1 second to show success message
      setTimeout(() => {
        router.push('/studio/nutrition')
        router.refresh()
      }, 1000)
    } catch (err: any) {
      const errorMsg = err.message || 'Something went wrong'
      console.error('[setup-nutrition] Error:', errorMsg)
      setError(errorMsg)
      setLoading(false)
    }
  }

  const calculated = calculateNutritionTargets(setup)

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

        <div className="bg-white rounded-sm border border-brand-navy/[0.08] shadow-[0_4px_40px_rgba(27,45,80,0.06)] p-8 md:p-10">
          {step === 'form' ? (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                Nutrition Setup
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
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
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
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                    placeholder="170"
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Height (inches)
                  </label>
                  <input
                    type="number"
                    value={setup.height || ''}
                    onChange={(e) => handleChange('height', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                    placeholder="72"
                  />
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
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
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
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Activity Level */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Activity Level
                  </label>
                  <select
                    value={setup.activityLevel}
                    onChange={(e) => handleChange('activityLevel', e.target.value as ActivityLevel)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
                  >
                    <option value="sedentary">Sedentary (little exercise)</option>
                    <option value="light">Light (1-3 days/week)</option>
                    <option value="moderate">Moderate (3-5 days/week)</option>
                    <option value="very_active">Very Active (6-7 days/week)</option>
                    <option value="extremely_active">Extremely Active (twice/day)</option>
                  </select>
                </div>

                {/* Fitness Goal */}
                <div>
                  <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2">
                    Fitness Goal
                  </label>
                  <select
                    value={setup.goal}
                    onChange={(e) => handleChange('goal', e.target.value as FitnessGoal)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors"
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
                  className="w-full py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-sm hover:bg-brand-navy/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 transition-all duration-200"
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-body text-brand-navy">
                    <strong>Goal:</strong> {getGoalLabel(setup.goal)}
                  </p>
                  <p className="text-sm font-body text-brand-navy mt-1">
                    <strong>Activity:</strong> {getActivityLevelLabel(setup.activityLevel)}
                  </p>
                  <p className="text-sm font-body text-brand-navy mt-1">
                    <strong>Target Weight:</strong> {setup.goalWeight} lbs
                  </p>
                </div>

                {/* Calories */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
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

                {/* Macros */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                    <p className="text-xs font-display uppercase tracking-[0.1em] text-orange-900">Protein</p>
                    <p className="text-2xl font-display font-bold text-orange-700 mt-1">{calculated.proteinGrams}g</p>
                    <p className="text-xs text-orange-600 mt-1">{Math.round(calculated.proteinGrams * 4)} cal</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                    <p className="text-xs font-display uppercase tracking-[0.1em] text-green-900">Carbs</p>
                    <p className="text-2xl font-display font-bold text-green-700 mt-1">{calculated.carbGrams}g</p>
                    <p className="text-xs text-green-600 mt-1">{Math.round(calculated.carbGrams * 4)} cal</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
                    <p className="text-xs font-display uppercase tracking-[0.1em] text-yellow-900">Fat</p>
                    <p className="text-2xl font-display font-bold text-yellow-700 mt-1">{calculated.fatGrams}g</p>
                    <p className="text-xs text-yellow-600 mt-1">{Math.round(calculated.fatGrams * 9)} cal</p>
                  </div>
                </div>

                {/* Verification */}
                <div className="text-xs text-brand-slate bg-brand-offwhite p-3 rounded">
                  {Math.round(calculated.proteinGrams * 4 + calculated.carbGrams * 4 + calculated.fatGrams * 9)} ={' '}
                  {calculated.dailyCalories} cal
                </div>
              </div>

              {success && (
                <div className="bg-green-100 border border-green-400 text-green-800 p-4 rounded mb-6">
                  ✓ Your nutrition goals have been saved!
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-gray-200 text-gray-800 font-display font-bold text-sm uppercase tracking-[0.12em] rounded-sm hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-sm hover:bg-brand-navy/90 active:scale-[0.98] disabled:opacity-60 transition-all"
                >
                  {loading ? 'Saving...' : 'Confirm & Continue'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
