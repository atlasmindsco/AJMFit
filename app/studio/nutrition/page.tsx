'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getCurrentUserId } from '@/lib/current-user'
import ResumeSession from '@/components/studio/ResumeSession'
import { fadeIn } from '@/lib/animations'

const BarcodeScanner = dynamic(() => import('@/components/studio/BarcodeScanner'), { ssr: false })
import {
  fetchTargets,
  fetchNutritionSetup,
  fetchMeals,
  fetchTodaysLogs,
  fetchDailyLog,
  fetchWeeklyCalories,
  ensureDefaultMeals,
  addFoodLog,
  deleteFoodLog,
  setWater,
  sumTotals,
  type MacroTargets,
  type MealRow,
  type FoodLogRow,
  type DailyCalories,
} from '@/lib/nutrition'
import { useRouter } from 'next/navigation'

const DEFAULT_TARGETS: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fats: 70 }
const WATER_GOAL_OZ = 100
const VALID_MEAL_NAMES = new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack'])

function formatTime(time: string | null) {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${m} ${ampm}`
}

export default function NutritionPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // TEST: Hardcoded values to verify display works
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2500, protein: 200, carbs: 300, fats: 85 })
  const [meals, setMeals] = useState<MealRow[]>([])
  const [logs, setLogs] = useState<FoodLogRow[]>([])
  const [waterOz, setWaterOz] = useState(0)
  const [weekly, setWeekly] = useState<DailyCalories[]>([])
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [addingToMeal, setAddingToMeal] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '', serving: '' })
  const [submitting, setSubmitting] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisSource, setAnalysisSource] = useState<'usda' | 'mixed' | 'gpt' | 'off' | null>(null)
  const [analysisComponents, setAnalysisComponents] = useState<Array<{ name: string; grams: number; source: 'usda' | 'gpt' | 'off' }>>([])
  const [typedLookupActive, setTypedLookupActive] = useState(false)
  const [scanningMealId, setScanningMealId] = useState<string | null>(null)
  const lookupAbortRef = useRef<AbortController | null>(null)
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const macroFieldsTouchedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      const id = await getCurrentUserId()
      setUserId(id)
      if (!id) {
        setLoading(false)
        return
      }
      try {
        // Check URL params first (passed from setup page)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const urlCalories = params.get('calories')
          if (urlCalories) {
            const urlTargets = {
              calories: parseInt(urlCalories),
              protein: parseInt(params.get('protein') || '150'),
              carbs: parseInt(params.get('carbs') || '250'),
              fats: parseInt(params.get('fats') || '70'),
            }
            console.log('[nutrition] Loaded from URL params:', urlTargets)
            setTargets(urlTargets)
          }
        }

        const [t, m, l, dl, w] = await Promise.all([
          fetchTargets(id),
          ensureDefaultMeals(id),
          fetchTodaysLogs(id),
          fetchDailyLog(id),
          fetchWeeklyCalories(id),
        ])

        // Use URL params if available, otherwise use database/localStorage
        let finalTargets = t
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const urlCalories = params.get('calories')
          if (urlCalories) {
            finalTargets = {
              calories: parseInt(urlCalories),
              protein: parseInt(params.get('protein') || '150'),
              carbs: parseInt(params.get('carbs') || '250'),
              fats: parseInt(params.get('fats') || '70'),
            }
          } else {
            // Fall back to localStorage
            const stored = localStorage.getItem('nutrition_goals')
            if (stored) {
              try {
                const parsed = JSON.parse(stored)
                finalTargets = {
                  calories: parsed.calories || 2000,
                  protein: parsed.protein || 150,
                  carbs: parsed.carbs || 250,
                  fats: parsed.fats || 70,
                }
              } catch (e) {}
            }
          }
        }

        setTargets(finalTargets)
        setMeals(m)
        setLogs(l)
        setWaterOz(dl.water_oz)
        setWeekly(w)
      } catch (err) {
        console.error('[Nutrition] Failed to load:', err)
        if (err instanceof Error && err.message.includes('no rows')) {
          router.push('/studio/setup-nutrition')
          return
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const totals = sumTotals(logs)
  const calPct = (totals.calories / targets.calories) * 100
  const waterPct = Math.min((waterOz / WATER_GOAL_OZ) * 100, 100)
  const logsByMeal = (mealId: string) => logs.filter((l) => l.meal_id === mealId)

  const resetAddState = () => {
    setAddForm({ name: '', calories: '', protein: '', carbs: '', fats: '', serving: '' })
    setAddingToMeal(null)
    setAnalysisSource(null)
    setAnalysisError(null)
    setAnalysisComponents([])
    macroFieldsTouchedRef.current = false
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    lookupAbortRef.current?.abort()
    lookupAbortRef.current = null
    setTypedLookupActive(false)
  }

  const handleAddFood = async (mealId: string) => {
    if (!userId) return
    if (!addForm.name.trim()) return
    setSubmitting(true)
    try {
      const newLog = await addFoodLog({
        userId,
        mealId,
        foodName: addForm.name.trim(),
        calories: parseInt(addForm.calories) || 0,
        protein: parseFloat(addForm.protein) || 0,
        carbs: parseFloat(addForm.carbs) || 0,
        fats: parseFloat(addForm.fats) || 0,
        servingSize: addForm.serving.trim() || undefined,
      })
      setLogs((prev) => [...prev, newLog])
      resetAddState()
    } catch (err) {
      console.error('[Add food] Failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteFood = async (id: string) => {
    const prevLogs = logs
    setLogs(logs.filter((l) => l.id !== id))
    try {
      await deleteFoodLog(id)
    } catch (err) {
      console.error('[Delete food] Failed:', err)
      setLogs(prevLogs)
    }
  }

  const handlePhotoAnalyze = async (mealId: string, file: File) => {
    setAnalyzing(mealId)
    setAnalysisError(null)
    setAnalysisSource(null)
    setAddingToMeal(mealId)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/analyze-food', { method: 'POST', body: formData })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error ?? `Analysis failed (${res.status})`)
      }
      const data = await res.json()
      setAddForm({
        name: data.foodName,
        serving: data.servingSize,
        calories: String(data.calories),
        protein: String(data.protein),
        carbs: String(data.carbs),
        fats: String(data.fats),
      })
      setAnalysisSource(data.source)
      setAnalysisComponents(data.components ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not analyze photo'
      setAnalysisError(message)
    } finally {
      setAnalyzing(null)
    }
  }

  const runTypedLookup = (query: string) => {
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    lookupAbortRef.current?.abort()

    if (query.trim().length < 3) {
      setTypedLookupActive(false)
      return
    }
    if (macroFieldsTouchedRef.current) return

    lookupTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      lookupAbortRef.current = controller
      setTypedLookupActive(true)
      setAnalysisError(null)
      try {
        const res = await fetch('/api/lookup-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error ?? `Lookup failed (${res.status})`)
        }
        const data = await res.json()
        if (controller.signal.aborted) return
        if (macroFieldsTouchedRef.current) return
        setAddForm((prev) => ({
          ...prev,
          serving: prev.serving || data.servingSize,
          calories: String(data.calories),
          protein: String(data.protein),
          carbs: String(data.carbs),
          fats: String(data.fats),
        }))
        setAnalysisSource(data.source)
        setAnalysisComponents(data.components ?? [])
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[Typed lookup] Failed:', err)
      } finally {
        if (lookupAbortRef.current === controller) {
          setTypedLookupActive(false)
          lookupAbortRef.current = null
        }
      }
    }, 600)
  }

  const handleBarcodeDetected = async (barcode: string) => {
    const mealId = scanningMealId
    setScanningMealId(null)
    if (!mealId) return
    setAddingToMeal(mealId)
    setAnalyzing(mealId)
    setAnalysisError(null)
    setAnalysisSource(null)
    setAnalysisComponents([])
    macroFieldsTouchedRef.current = false
    try {
      const res = await fetch('/api/lookup-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      })
      if (res.status === 404) {
        setAnalysisError(`Barcode ${barcode} not found, try the photo or type the product name.`)
        return
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error ?? `Lookup failed (${res.status})`)
      }
      const data = await res.json()
      setAddForm({
        name: data.foodName,
        serving: data.servingSize,
        calories: String(data.calories),
        protein: String(data.protein),
        carbs: String(data.carbs),
        fats: String(data.fats),
      })
      setAnalysisSource(data.source)
      setAnalysisComponents(data.components ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not look up barcode'
      setAnalysisError(message)
    } finally {
      setAnalyzing(null)
    }
  }

  const adjustWater = async (ozDelta: number) => {
    if (!userId) return
    const next = Math.max(0, waterOz + ozDelta)
    setWaterOz(next)
    try {
      await setWater(userId, next)
    } catch (err) {
      console.error('[Water] Failed:', err)
    }
  }

  if (!userId && !loading) {
    return <ResumeSession title="Sign in to track your nutrition" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {scanningMealId && (
        <BarcodeScanner onDetect={handleBarcodeDetected} onClose={() => setScanningMealId(null)} />
      )}

      {/* MyFitnessPal-style Header */}
      <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-lg border border-gray-300 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
          <a
            href="/studio/setup-nutrition"
            className="text-sm font-medium px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Update Goals
          </a>
        </div>

        {/* Calorie Summary */}
        <div className="grid grid-cols-3 gap-4 mb-5 pb-5 border-b border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Logged</p>
            <p className="text-3xl font-bold text-gray-900">{totals.calories}</p>
          </div>
          <div className="text-center border-l border-r border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Goal</p>
            <p className="text-3xl font-bold text-gray-900">{targets.calories}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Remaining</p>
            <p className={`text-3xl font-bold ${totals.calories > targets.calories ? 'text-red-600' : 'text-green-600'}`}>
              {Math.abs(targets.calories - totals.calories)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${calPct > 100 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(calPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 text-center">{Math.round(calPct)}% of goal</p>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Protein', current: totals.protein, goal: targets.protein },
            { label: 'Carbs', current: totals.carbs, goal: targets.carbs },
            { label: 'Fat', current: totals.fats, goal: targets.fats },
          ].map((m) => (
            <div key={m.label} className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xs font-medium text-gray-600">{m.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {Math.round(m.current)}/{m.goal}g
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{Math.round((m.current / m.goal) * 100)}%</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Meals */}
      <div className="space-y-3">
        {meals.filter((meal) => VALID_MEAL_NAMES.has(meal.name)).map((meal) => {
          const mealLogs = logsByMeal(meal.id)
          const mealCalories = mealLogs.reduce((sum, l) => sum + l.calories, 0)
          const isExpanded = expandedMeal === meal.id
          const isAdding = addingToMeal === meal.id

          return (
            <motion.div key={meal.id} custom={meals.indexOf(meal)} variants={fadeIn} initial="hidden" animate="visible">
              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                {/* Meal Header */}
                <button
                  onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{meal.name}</p>
                    {meal.scheduled_time && <p className="text-xs text-gray-500">{formatTime(meal.scheduled_time)}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900">{mealCalories}</span>
                    <svg
                      className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {/* Meal Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-gray-200 bg-gray-50"
                    >
                      <div className="p-4 space-y-3">
                        {/* Food List */}
                        {mealLogs.length > 0 ? (
                          <div className="space-y-2">
                            {mealLogs.map((log) => (
                              <div key={log.id} className="flex items-center justify-between bg-white p-3 rounded text-sm">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{log.food_name}</p>
                                  {log.serving_size && <p className="text-xs text-gray-500">{log.serving_size}</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-gray-900 text-right min-w-12">{log.calories}</span>
                                  <button
                                    onClick={() => handleDeleteFood(log.id)}
                                    className="text-gray-400 hover:text-red-600"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No foods logged yet</p>
                        )}

                        {/* Add Food */}
                        {isAdding ? (
                          <div className="bg-white p-4 rounded space-y-3 border border-blue-300">
                            {analysisError && <div className="text-sm text-red-600">{analysisError}</div>}
                            {analysisSource && (
                              <div className="text-xs bg-green-50 p-2 rounded text-green-700">
                                <strong>Auto-filled:</strong> {analysisSource === 'usda' ? 'USDA verified' : analysisSource === 'off' ? 'Open Food Facts' : 'AI estimate'}
                              </div>
                            )}
                            <input
                              type="text"
                              placeholder="Food name"
                              value={addForm.name}
                              onChange={(e) => {
                                setAddForm({ ...addForm, name: e.target.value })
                                runTypedLookup(e.target.value)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="number"
                              placeholder="Calories"
                              value={addForm.calories}
                              onChange={(e) => {
                                macroFieldsTouchedRef.current = true
                                setAddForm({ ...addForm, calories: e.target.value })
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'Protein (g)', key: 'protein' },
                                { label: 'Carbs (g)', key: 'carbs' },
                                { label: 'Fat (g)', key: 'fats' },
                              ].map((field) => (
                                <input
                                  key={field.key}
                                  type="number"
                                  placeholder={field.label}
                                  value={addForm[field.key as keyof typeof addForm]}
                                  onChange={(e) => {
                                    macroFieldsTouchedRef.current = true
                                    setAddForm({ ...addForm, [field.key]: e.target.value })
                                  }}
                                  className="px-2 py-2 border border-gray-300 rounded text-sm"
                                />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddFood(meal.id)}
                                disabled={submitting || !addForm.name.trim()}
                                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {submitting ? 'Adding...' : 'Add'}
                              </button>
                              <button
                                onClick={resetAddState}
                                className="flex-1 px-3 py-2 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center justify-center p-3 border-2 border-dashed border-orange-400 rounded cursor-pointer hover:bg-orange-50">
                              {analyzing === meal.id ? (
                                <span className="text-xs font-medium text-orange-600">Analyzing...</span>
                              ) : (
                                <>
                                  <span className="text-xs font-medium text-orange-600">📸 Photo</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) handlePhotoAnalyze(meal.id, e.target.files[0])
                                    }}
                                  />
                                </>
                              )}
                            </label>
                            <button
                              onClick={() => setScanningMealId(meal.id)}
                              className="p-3 border-2 border-dashed border-blue-400 rounded text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              📊 Barcode
                            </button>
                            <button
                              onClick={() => setAddingToMeal(meal.id)}
                              className="p-3 border-2 border-dashed border-gray-400 rounded text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              + Add Food
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 italic text-center mt-8">
        Macro values are estimates. Always review entries to match what you actually ate.
      </p>
    </div>
  )
}
