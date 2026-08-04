'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
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
import { NutritionSetupData } from '@/lib/nutrition'

interface NutritionSettingsProps {
  setup: NutritionSetupData
  onClose: () => void
  onSaved: () => void
}

export default function NutritionSettings({ setup, onClose, onSaved }: NutritionSettingsProps) {
  const [mode, setMode] = useState<'edit' | 'review'>('edit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState<NutritionGoalSetup>({
    currentWeight: setup.current_weight || 0,
    goalWeight: setup.goal_weight || 0,
    height: setup.height || 0,
    age: setup.age || 0,
    sex: (setup.sex as Sex) || 'male',
    activityLevel: (setup.activity_level as ActivityLevel) || 'moderate',
    goal: (setup.nutrition_goal as FitnessGoal) || 'maintain',
  })

  const handleChange = (field: keyof NutritionGoalSetup, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleContinue = () => {
    const errors = validateSetup(formData)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }
    setMode('review')
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/nutrition/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save nutrition goals')
      }

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const calculated = calculateNutritionTargets(formData)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="font-display font-bold text-xl text-gray-800">Nutrition Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {mode === 'edit' ? (
            <div className="space-y-5">
              {/* Current Weight */}
              <div>
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Current Weight (lbs)
                </label>
                <input
                  type="number"
                  value={formData.currentWeight || ''}
                  onChange={(e) => handleChange('currentWeight', parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                  placeholder="180"
                />
              </div>

              {/* Goal Weight */}
              <div>
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Goal Weight (lbs)
                </label>
                <input
                  type="number"
                  value={formData.goalWeight || ''}
                  onChange={(e) => handleChange('goalWeight', parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                  placeholder="170"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Height (inches)
                </label>
                <input
                  type="number"
                  value={formData.height || ''}
                  onChange={(e) => handleChange('height', parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                  placeholder="72"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={formData.age || ''}
                  onChange={(e) => handleChange('age', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                  placeholder="25"
                />
              </div>

              {/* Sex */}
              <div>
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Sex
                </label>
                <select
                  value={formData.sex}
                  onChange={(e) => handleChange('sex', e.target.value as Sex)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Activity Level */}
              <div>
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Activity Level
                </label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => handleChange('activityLevel', e.target.value as ActivityLevel)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
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
                <label className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-gray-700 mb-2">
                  Fitness Goal
                </label>
                <select
                  value={formData.goal}
                  onChange={(e) => handleChange('goal', e.target.value as FitnessGoal)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-body text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                >
                  <option value="lose_fat">Lose Fat</option>
                  <option value="build_muscle">Build Muscle</option>
                  <option value="body_recomposition">Body Recomposition</option>
                  <option value="maintain">Maintain Weight</option>
                </select>
              </div>

              {error && <p className="text-sm font-body text-red-500">{error}</p>}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-display font-bold text-sm uppercase tracking-[0.12em] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-lg transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-body text-gray-800">
                  <strong>Goal:</strong> {getGoalLabel(formData.goal)}
                </p>
                <p className="text-sm font-body text-gray-800 mt-1">
                  <strong>Activity:</strong> {getActivityLevelLabel(formData.activityLevel)}
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
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-xs font-display uppercase tracking-[0.1em] text-orange-900">Protein</p>
                  <p className="text-2xl font-display font-bold text-orange-700 mt-1">{calculated.proteinGrams}g</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-display uppercase tracking-[0.1em] text-green-900">Carbs</p>
                  <p className="text-2xl font-display font-bold text-green-700 mt-1">{calculated.carbGrams}g</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-xs font-display uppercase tracking-[0.1em] text-yellow-900">Fat</p>
                  <p className="text-2xl font-display font-bold text-yellow-700 mt-1">{calculated.fatGrams}g</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setMode('edit')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-display font-bold text-sm uppercase tracking-[0.12em] rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-lg transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
