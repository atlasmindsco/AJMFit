'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface CoachNutritionOverrideProps {
  userId: string
  currentTargets: {
    calories: number
    protein: number
    carbs: number
    fats: number
  }
  customTargets: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fats: number | null
  }
  onSaved: () => void
}

export default function CoachNutritionOverride({
  userId,
  currentTargets,
  customTargets,
  onSaved,
}: CoachNutritionOverrideProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [overrides, setOverrides] = useState({
    calories: customTargets.calories ?? currentTargets.calories,
    protein: customTargets.protein ?? currentTargets.protein,
    carbs: customTargets.carbs ?? currentTargets.carbs,
    fats: customTargets.fats ?? currentTargets.fats,
  })

  const hasOverrides =
    customTargets.calories !== null ||
    customTargets.protein !== null ||
    customTargets.carbs !== null ||
    customTargets.fats !== null

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/nutrition/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          targets: {
            calories: overrides.calories,
            protein: overrides.protein,
            carbs: overrides.carbs,
            fats: overrides.fats,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save overrides')
      }

      setOpen(false)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear all custom overrides and return to calculated values?')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/nutrition/override`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) throw new Error('Failed to clear overrides')

      setOpen(false)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {hasOverrides && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-display uppercase tracking-[0.1em] text-amber-900 font-semibold">
            Coach Override Active
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Custom targets: {overrides.calories} cal | {overrides.protein}g P | {overrides.carbs}g C |{' '}
            {overrides.fats}g F
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-display font-semibold text-sm uppercase tracking-[0.1em] rounded-lg transition-all"
      >
        {open ? 'Close Override' : hasOverrides ? 'Edit Override' : 'Set Custom Targets'}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4"
        >
          <p className="text-sm text-gray-600 font-body">
            Calculated values: {currentTargets.calories} cal | {currentTargets.protein}g P |{' '}
            {currentTargets.carbs}g C | {currentTargets.fats}g F
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Calories */}
            <div>
              <label className="block text-xs font-display uppercase tracking-[0.1em] text-gray-700 mb-1">
                Calories
              </label>
              <input
                type="number"
                value={overrides.calories}
                onChange={(e) => setOverrides((prev) => ({ ...prev, calories: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded font-body text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Protein */}
            <div>
              <label className="block text-xs font-display uppercase tracking-[0.1em] text-gray-700 mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                value={overrides.protein}
                onChange={(e) => setOverrides((prev) => ({ ...prev, protein: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded font-body text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Carbs */}
            <div>
              <label className="block text-xs font-display uppercase tracking-[0.1em] text-gray-700 mb-1">
                Carbs (g)
              </label>
              <input
                type="number"
                value={overrides.carbs}
                onChange={(e) => setOverrides((prev) => ({ ...prev, carbs: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded font-body text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Fats */}
            <div>
              <label className="block text-xs font-display uppercase tracking-[0.1em] text-gray-700 mb-1">
                Fats (g)
              </label>
              <input
                type="number"
                value={overrides.fats}
                onChange={(e) => setOverrides((prev) => ({ ...prev, fats: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded font-body text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-display font-semibold text-xs uppercase tracking-[0.1em] rounded transition-colors"
            >
              Cancel
            </button>
            {hasOverrides && (
              <button
                onClick={handleClear}
                disabled={loading}
                className="flex-1 py-2 bg-red-100 hover:bg-red-200 disabled:opacity-60 text-red-700 font-display font-semibold text-xs uppercase tracking-[0.1em] rounded transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-display font-semibold text-xs uppercase tracking-[0.1em] rounded transition-colors"
            >
              {loading ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
