'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getCurrentUserId } from '@/lib/current-user'
import ResumeSession from '@/components/studio/ResumeSession'
import MacroRing from '@/components/ui/MacroRing'
import { fadeIn } from '@/lib/animations'

const BarcodeScanner = dynamic(() => import('@/components/studio/BarcodeScanner'), { ssr: false })
import {
  fetchTargets,
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

const DEFAULT_TARGETS: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fats: 70 }
const WATER_GOAL_OZ = 100 // default daily goal

function formatTime(time: string | null) {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${m} ${ampm}`
}

export default function NutritionPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState<MacroTargets>(DEFAULT_TARGETS)
  const [meals, setMeals] = useState<MealRow[]>([])
  const [logs, setLogs] = useState<FoodLogRow[]>([])
  const [waterOz, setWaterOz] = useState(0)
  const [weekly, setWeekly] = useState<DailyCalories[]>([])
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [addingToMeal, setAddingToMeal] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '', serving: '' })
  const [submitting, setSubmitting] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null) // mealId being analyzed
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
        const [t, m, l, dl, w] = await Promise.all([
          fetchTargets(id),
          ensureDefaultMeals(id),
          fetchTodaysLogs(id),
          fetchDailyLog(id),
          fetchWeeklyCalories(id),
        ])
        setTargets(t)
        setMeals(m)
        setLogs(l)
        setWaterOz(dl.water_oz)
        setWeekly(w)
      } catch (err) {
        console.error('[Nutrition] Failed to load:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
    if (macroFieldsTouchedRef.current) return // user is editing macros, leave them alone

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
        if (macroFieldsTouchedRef.current) return // user typed in macros mid-flight
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
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const weekMax = Math.max(targets.calories * 1.2, ...weekly.map((d) => d.calories))
  const caloriesRemaining = Math.max(0, targets.calories - totals.calories)

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen pb-8">
      {scanningMealId && (
        <BarcodeScanner
          onDetect={handleBarcodeDetected}
          onClose={() => setScanningMealId(null)}
        />
      )}

      {/* Header with Remaining Calories */}
      <motion.div
        custom={0}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-8 mb-6 rounded-b-3xl shadow-md"
      >
        <div className="max-w-7xl mx-auto">
          <p className="text-blue-100 text-sm font-semibold mb-2">CALORIES REMAINING</p>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-display font-extrabold text-5xl">{caloriesRemaining}</span>
            <span className="text-blue-100 text-lg">of {targets.calories} kcal</span>
          </div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.min(calPct, 100)}%` }}
            />
          </div>
          <p className="text-blue-100 text-xs mt-2">{Math.round(calPct)}% of daily goal</p>
        </div>
      </motion.div>

      {/* Macro Summary Cards */}
      <motion.div
        custom={1}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-6 mb-6 grid grid-cols-3 gap-3"
      >
        {[
          { label: 'Protein', current: totals.protein, goal: targets.protein, unit: 'g', color: 'from-blue-400 to-blue-500', textColor: 'text-blue-600' },
          { label: 'Carbs', current: totals.carbs, goal: targets.carbs, unit: 'g', color: 'from-orange-400 to-orange-500', textColor: 'text-orange-600' },
          { label: 'Fats', current: totals.fats, goal: targets.fats, unit: 'g', color: 'from-green-400 to-green-500', textColor: 'text-green-600' },
        ].map((macro) => (
          <div key={macro.label} className={`bg-gradient-to-br ${macro.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-white/80 text-xs font-semibold mb-2">{macro.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="font-display font-bold text-2xl">{Math.round(macro.current)}</span>
              <span className="text-white/70 text-xs">/ {macro.goal}{macro.unit}</span>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min((macro.current / macro.goal) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </motion.div>

      <div className="max-w-7xl mx-auto px-6">
        {/* Meals List */}
        <div className="space-y-3 mb-8">
          {meals.map((meal) => {
            const mealLogs = logsByMeal(meal.id)
            const mealCalories = mealLogs.reduce((sum, l) => sum + l.calories, 0)
            const mealProtein = mealLogs.reduce((sum, l) => sum + l.protein, 0)
            const mealCarbs = mealLogs.reduce((sum, l) => sum + l.carbs, 0)
            const mealFats = mealLogs.reduce((sum, l) => sum + l.fats, 0)
            const isLogged = mealLogs.length > 0
            const isExpanded = expandedMeal === meal.id
            const isAdding = addingToMeal === meal.id
            return (
              <motion.div
                key={meal.id}
                custom={2}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-display font-bold text-lg ${
                      meal.name === 'Breakfast' ? 'bg-yellow-100 text-yellow-600' :
                      meal.name === 'Lunch' ? 'bg-green-100 text-green-600' :
                      meal.name === 'Dinner' ? 'bg-orange-100 text-orange-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {meal.name.charAt(0)}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-body font-semibold text-gray-800 text-sm">{meal.name}</p>
                      <p className="text-gray-500 text-xs font-body">{mealLogs.length} items • {mealCalories} kcal</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-gray-200"
                    >
                      <div className="px-5 py-4">
                        {mealLogs.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {mealLogs.map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                                <div className="flex-1">
                                  <p className="font-body font-semibold text-gray-800 text-sm">{item.food_name}</p>
                                  {item.serving_size && (
                                    <p className="text-gray-500 text-xs">{item.serving_size}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 ml-4">
                                  <div className="text-right">
                                    <p className="font-display font-bold text-gray-800 text-sm">{item.calories}</p>
                                    <p className="text-gray-500 text-xs">cal</p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteFood(item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1"
                                    aria-label="Delete food"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                            {/* Meal Totals */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex justify-between text-sm">
                                <span className="font-semibold text-gray-800">Totals</span>
                                <div className="flex gap-4 text-xs">
                                  <span className="text-blue-600 font-semibold">P: {Math.round(mealProtein)}g</span>
                                  <span className="text-orange-600 font-semibold">C: {Math.round(mealCarbs)}g</span>
                                  <span className="text-green-600 font-semibold">F: {Math.round(mealFats)}g</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm font-body italic py-2">No food logged yet.</p>
                        )}

                        {/* Add food form */}
                        {isAdding ? (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            {analysisSource && (
                              <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2">
                                    <div className="flex items-center gap-2 text-[10px] font-display font-bold uppercase tracking-wide text-emerald-700">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                      </svg>
                                      Auto-filled
                                      <span className={`ml-1 px-1.5 py-0.5 rounded ${
                                        analysisSource === 'usda' || analysisSource === 'off'
                                          ? 'bg-emerald-200 text-emerald-800'
                                          : analysisSource === 'mixed'
                                          ? 'bg-amber-200 text-amber-800'
                                          : 'bg-[#1B2D50]/10 text-[#1B2D50]'
                                      }`}>
                                        {analysisSource === 'usda'
                                          ? 'USDA verified'
                                          : analysisSource === 'off'
                                          ? 'Open Food Facts'
                                          : analysisSource === 'mixed'
                                          ? 'partially verified'
                                          : 'AI estimate'}
                                      </span>
                                    </div>
                                    {analysisComponents.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {analysisComponents.map((c, i) => (
                                          <span
                                            key={i}
                                            className={`text-[10px] font-body px-1.5 py-0.5 rounded border ${
                                              c.source === 'usda' || c.source === 'off'
                                                ? 'bg-white border-emerald-200 text-emerald-700'
                                                : 'bg-white border-[#1B2D50]/15 text-[#64748B]'
                                            }`}
                                            title={
                                              c.source === 'usda'
                                                ? 'Macros from USDA database'
                                                : c.source === 'off'
                                                ? 'Macros from Open Food Facts'
                                                : 'Macros estimated by AI'
                                            }
                                          >
                                            {c.name}
                                            {c.grams > 0 && <span className="opacity-60"> ({c.grams}g)</span>}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-[10px] text-emerald-700/80 font-body mt-1.5 leading-relaxed">
                                      <strong>Review before saving.</strong> {analysisSource === 'off' ? 'Macros come from the product label, verify the serving size matches what you ate.' : 'Portion sizes are estimates and may be off by ±20%.'}
                                    </p>
                                  </div>
                                )}
                                {analysisError && (
                                  <div className="text-red-600 text-[11px] font-body mb-2">{analysisError}</div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2 mb-2">
                                  <label className="block">
                                    <span className="block text-[10px] font-display font-bold uppercase tracking-wide text-[#64748B] mb-1">Food</span>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="e.g. teriyaki chicken bowl"
                                        value={addForm.name}
                                        onChange={(e) => {
                                          const next = e.target.value
                                          setAddForm({ ...addForm, name: next })
                                          runTypedLookup(next)
                                        }}
                                        className="w-full px-3 py-2 pr-9 text-sm bg-white border border-[#1B2D50]/10 rounded-md font-body focus:outline-none focus:border-[#1A7BFF]/50"
                                      />
                                      {typedLookupActive && (
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#1A7BFF]/20 border-t-[#1A7BFF] rounded-full animate-spin" />
                                      )}
                                    </div>
                                  </label>
                                  <label className="block">
                                    <span className="block text-[10px] font-display font-bold uppercase tracking-wide text-[#64748B] mb-1">Serving</span>
                                    <input
                                      type="text"
                                      placeholder="optional"
                                      value={addForm.serving}
                                      onChange={(e) => setAddForm({ ...addForm, serving: e.target.value })}
                                      className="w-full px-3 py-2 text-sm bg-white border border-[#1B2D50]/10 rounded-md font-body focus:outline-none focus:border-[#1A7BFF]/50"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="block text-[10px] font-display font-bold uppercase tracking-wide text-[#64748B] mb-1">Calories</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      placeholder="kcal"
                                      value={addForm.calories}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm({ ...addForm, calories: e.target.value })
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-[#1B2D50]/10 rounded-md font-body focus:outline-none focus:border-[#1A7BFF]/50"
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                  <label className="block">
                                    <span className="block text-[10px] font-display font-bold uppercase tracking-wide text-[#1A7BFF] mb-1">Protein (g)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={addForm.protein}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm({ ...addForm, protein: e.target.value })
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-[#1B2D50]/10 rounded-md font-body focus:outline-none focus:border-[#1A7BFF]/50"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="block text-[10px] font-display font-bold uppercase tracking-wide text-[#F76B16] mb-1">Carbs (g)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={addForm.carbs}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm({ ...addForm, carbs: e.target.value })
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-[#1B2D50]/10 rounded-md font-body focus:outline-none focus:border-[#1A7BFF]/50"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="block text-[10px] font-display font-bold uppercase tracking-wide text-[#64748B] mb-1">Fats (g)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={addForm.fats}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm({ ...addForm, fats: e.target.value })
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-[#1B2D50]/10 rounded-md font-body focus:outline-none focus:border-[#1A7BFF]/50"
                                    />
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddFood(meal.id)}
                                    disabled={submitting || !addForm.name.trim()}
                                    className="px-4 py-2 bg-[#1A7BFF] text-white text-xs font-display font-bold uppercase tracking-wide rounded-md hover:bg-[#0F5FE0] disabled:opacity-50 transition-colors duration-200"
                                  >
                                    {submitting ? 'Adding...' : 'Add Food'}
                                  </button>
                                  <button
                                    onClick={resetAddState}
                                    className="px-4 py-2 bg-white border border-[#1B2D50]/10 text-[#64748B] text-xs font-display font-bold uppercase tracking-wide rounded-md hover:bg-[#FAFBFD] transition-colors duration-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <label className="cursor-pointer py-2 border border-dashed border-[#F76B16]/30 rounded-lg text-[#F76B16] text-xs font-display font-bold uppercase tracking-wide hover:bg-[#F76B16]/[0.04] transition-colors duration-200 flex items-center justify-center gap-1.5">
                                  {analyzing === meal.id ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-[#F76B16]/30 border-t-[#F76B16] rounded-full animate-spin" />
                                      Analyzing...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.823-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                                      </svg>
                                      Photo
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={analyzing !== null}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0]
                                      if (f) handlePhotoAnalyze(meal.id, f)
                                      e.target.value = '' // allow re-upload of same file
                                    }}
                                  />
                                </label>
                                <button
                                  onClick={() => {
                                    macroFieldsTouchedRef.current = false
                                    setScanningMealId(meal.id)
                                  }}
                                  disabled={analyzing !== null}
                                  className="py-2 border border-dashed border-[#1A7BFF]/30 rounded-lg text-[#1A7BFF] text-xs font-display font-bold uppercase tracking-wide hover:bg-[#1A7BFF]/[0.04] transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5v15m3-15v15m3-15v15m3-15v15m3-15v15m3-15v15M21 4.5v15" />
                                  </svg>
                                  Barcode
                                </button>
                                <button
                                  onClick={() => {
                                    macroFieldsTouchedRef.current = false
                                    setAddingToMeal(meal.id)
                                  }}
                                  className="py-2 border border-dashed border-[#1B2D50]/15 rounded-lg text-[#64748B] text-xs font-display font-bold uppercase tracking-wide hover:border-[#1A7BFF]/30 hover:text-[#1A7BFF] transition-colors duration-200"
                                >
                                  + Manual
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Weekly Calorie Trend */}
          <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-xl border border-[#1B2D50]/[0.06]">
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Weekly Calorie Trend</h2>
            </div>
            <div className="p-5">
              <div className="flex items-end gap-2 h-36">
                {weekly.map((day) => {
                  const heightPct = day.calories > 0 ? (day.calories / weekMax) * 100 : 0
                  const onTarget = Math.abs(day.calories - targets.calories) < targets.calories * 0.15
                  const dateObj = new Date(day.date + 'T00:00:00')
                  const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-display font-bold text-[#1B2D50]">
                        {day.calories > 0 ? day.calories : '--'}
                      </span>
                      <div className="w-full rounded-t-md overflow-hidden" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                        <div
                          className={`w-full h-full rounded-t-md ${
                            day.calories === 0 ? 'bg-[#E5E7EB]' : onTarget ? 'bg-[#1A7BFF]' : 'bg-[#F76B16]'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] font-body text-[#64748B]">{label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#1A7BFF]" />
                  <span className="text-[10px] font-body text-[#64748B]">On Target (±15%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F76B16]" />
                  <span className="text-[10px] font-body text-[#64748B]">Over/Under</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Weekly Trend */}
        <motion.div
          custom={3}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8"
        >
          <h2 className="font-display font-bold text-lg text-gray-800 mb-6">This Week</h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {weekly.map((day) => {
              const heightPct = day.calories > 0 ? (day.calories / weekMax) * 100 : 0
              const onTarget = Math.abs(day.calories - targets.calories) < targets.calories * 0.15
              const dateObj = new Date(day.date + 'T00:00:00')
              const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-display font-bold text-gray-600 h-5">
                    {day.calories > 0 ? day.calories.toLocaleString() : '--'}
                  </span>
                  <div className="w-full rounded-lg overflow-hidden bg-gray-100 flex-1 flex items-end" style={{ minHeight: '120px' }}>
                    <div
                      className={`w-full rounded-lg transition-all ${
                        day.calories === 0 ? 'bg-gray-200' : onTarget ? 'bg-blue-500' : 'bg-orange-500'
                      }`}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs font-body text-gray-500 h-4">{label}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Hydration Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div
            custom={4}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
          >
            <h3 className="font-display font-bold text-lg text-gray-800 mb-4">💧 Hydration</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display font-extrabold text-4xl text-blue-500">{waterOz}</span>
              <span className="text-gray-600 text-lg">/ {WATER_GOAL_OZ} oz</span>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${waterPct}%` }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => adjustWater(-8)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                aria-label="Remove 8 oz"
              >
                − 8 oz
              </button>
              <button
                onClick={() => adjustWater(8)}
                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                aria-label="Add 8 oz"
              >
                + 8 oz
              </button>
            </div>
          </motion.div>

          {/* Coach Tip */}
          <motion.div
            custom={5}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 shadow-sm p-6"
          >
            <h3 className="font-display font-bold text-lg text-gray-800 mb-3">💡 Nutrition Tip</h3>
            <p className="text-gray-700 text-sm font-body leading-relaxed mb-2">
              &ldquo;Try to get 30-40g of protein within 30 minutes post-workout. Your shake + a banana is a solid combo.&rdquo;
            </p>
            <p className="text-gray-600 text-xs font-body">— Anthony</p>
          </motion.div>
        </div>
      </div>

      {/* Disclaimer footer */}
      <p className="mt-8 text-[#64748B] text-[11px] font-body italic text-center max-w-2xl mx-auto leading-relaxed">
        Macro values are estimates. Photo recognition uses AI and the USDA FoodData Central database; portion sizes may be off. Always review and adjust entries to match what you actually ate.
      </p>
    </div>
  )
}
