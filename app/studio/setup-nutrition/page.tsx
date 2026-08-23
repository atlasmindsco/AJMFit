'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    const calculated = calculateNutritionTargets(setup)

    try {
      // Save to localStorage (GUARANTEED to work)
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'nutrition_goals',
          JSON.stringify({
            calories: calculated.dailyCalories,
            protein: calculated.proteinGrams,
            carbs: calculated.carbGrams,
            fats: calculated.fatGrams,
          })
        )
      }

      // Try to save to database (background, don't block user)
      fetch('/api/nutrition/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setup),
      }).catch(() => {})

      // Pass the calculated values through URL to nutrition page
      const params = new URLSearchParams({
        calories: calculated.dailyCalories.toString(),
        protein: calculated.proteinGrams.toString(),
        carbs: calculated.carbGrams.toString(),
        fats: calculated.fatGrams.toString(),
      })
      router.push(`/studio/nutrition?${params.toString()}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const calculated = calculateNutritionTargets(setup)

  return (
    <div className="min-h-screen bg-brand-offwhite flex flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-10">
          <Link href="/">
            <h1 className="text-2xl font-bold">AJMFit</h1>
          </Link>
        </div>

        <div className="bg-white rounded border border-gray-300 p-8">
          {step === 'form' ? (
            <>
              <h1 className="font-bold text-2xl mb-2">Nutrition Setup</h1>
              <p className="text-sm text-gray-600 mb-6">Enter your details to calculate your nutrition targets</p>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Current Weight (lbs)</label>
                  <input
                    type="number"
                    value={setup.currentWeight || ''}
                    onChange={(e) => handleChange('currentWeight', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="180"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Goal Weight (lbs)</label>
                  <input
                    type="number"
                    value={setup.goalWeight || ''}
                    onChange={(e) => handleChange('goalWeight', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="170"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Height (inches)</label>
                  <input
                    type="number"
                    value={setup.height || ''}
                    onChange={(e) => handleChange('height', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="72"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    value={setup.age || ''}
                    onChange={(e) => handleChange('age', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="25"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Sex</label>
                  <select
                    value={setup.sex}
                    onChange={(e) => handleChange('sex', e.target.value as Sex)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Activity Level</label>
                  <select
                    value={setup.activityLevel}
                    onChange={(e) => handleChange('activityLevel', e.target.value as ActivityLevel)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light (1-3 days/week)</option>
                    <option value="moderate">Moderate (3-5 days/week)</option>
                    <option value="very_active">Very Active (6-7 days/week)</option>
                    <option value="extremely_active">Extremely Active (twice/day)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Fitness Goal</label>
                  <select
                    value={setup.goal}
                    onChange={(e) => handleChange('goal', e.target.value as FitnessGoal)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="lose_fat">Lose Fat</option>
                    <option value="build_muscle">Build Muscle</option>
                    <option value="body_recomposition">Body Recomposition</option>
                    <option value="maintain">Maintain Weight</option>
                  </select>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded hover:bg-blue-700"
                >
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-bold text-2xl mb-2">Your Macro Targets</h1>
              <p className="text-sm text-gray-600 mb-6">Based on your information</p>

              <div className="space-y-4 mb-6">
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm">
                    <strong>Daily Calories:</strong> {calculated.dailyCalories}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded">
                  <p className="text-sm">
                    <strong>Protein:</strong> {calculated.proteinGrams}g
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <p className="text-sm">
                    <strong>Carbs:</strong> {calculated.carbGrams}g
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded">
                  <p className="text-sm">
                    <strong>Fat:</strong> {calculated.fatGrams}g
                  </p>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-300 text-gray-800 font-bold text-sm rounded hover:bg-gray-400 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
