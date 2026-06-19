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
    if (macroFieldsTouchedRef.current) return // user is editing macros — leave them alone

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
        setAnalysisError(`Barcode ${barcode} not found — try the photo or type the product name.`)
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
        <div className="w-8 h-8 border-2 border-[#1B2D50]/10 border-t-[#1A7BFF] rounded-full animate-spin" />
      </div>
    )
  }

  const weekMax = Math.max(targets.calories * 1.2, ...weekly.map((d) => d.calories))

  return (
    <div>
      {scanningMealId && (
        <BarcodeScanner
          onDetect={handleBarcodeDetected}
          onClose={() => setScanningMealId(null)}
        />
      )}
      {/* Top Macro Summary */}
      <motion.div
        custom={0}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-xl border border-[#1B2D50]/[0.06] p-6 mb-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Calorie bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="font-display font-extrabold text-xl text-[#1B2D50] tracking-tight">Today&apos;s Nutrition</h1>
              <span className="text-[#1B2D50] text-sm font-body font-semibold">
                {totals.calories.toLocaleString()} / {targets.calories.toLocaleString()} kcal
              </span>
            </div>
            <div className="w-full h-4 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${calPct > 100 ? 'bg-[#F76B16]' : 'bg-[#1A7BFF]'}`}
                style={{ width: `${Math.min(calPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[#64748B] text-xs font-body">{Math.round(calPct)}% of daily goal</span>
              <span className={`text-xs font-body font-medium ${totals.calories > targets.calories ? 'text-[#F76B16]' : 'text-emerald-500'}`}>
                {Math.abs(targets.calories - totals.calories)} kcal {totals.calories > targets.calories ? 'over' : 'remaining'}
              </span>
            </div>
          </div>

          {/* Macro rings */}
          <div className="flex items-center justify-around lg:justify-end gap-6 lg:gap-8">
            {[
              { label: 'Protein', current: totals.protein, goal: targets.protein, unit: 'g', color: '#1A7BFF' },
              { label: 'Carbs', current: totals.carbs, goal: targets.carbs, unit: 'g', color: '#F76B16' },
              { label: 'Fats', current: totals.fats, goal: targets.fats, unit: 'g', color: '#64748B' },
            ].map((macro) => (
              <div key={macro.label} className="flex flex-col items-center">
                <div className="relative">
                  <MacroRing current={macro.current} goal={macro.goal} color={macro.color} size={80} bgStroke="#E5E7EB" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display font-bold text-[#1B2D50] text-sm">
                      {Math.round(macro.current)}{macro.unit}
                    </span>
                  </div>
                </div>
                <span className="font-body font-semibold text-[#1B2D50] text-xs mt-1.5">{macro.label}</span>
                <span className="text-[#64748B] text-[10px] font-body">
                  / {macro.goal}{macro.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Meal Plan */}
        <div className="lg:col-span-8 space-y-4">
          <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-xl border border-[#1B2D50]/[0.06]">
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Meal Plan</h2>
              <span className="text-[#64748B] text-xs font-body">
                {meals.filter((m) => logsByMeal(m.id).length > 0).length} / {meals.length} logged
              </span>
            </div>
            <div className="divide-y divide-[#1B2D50]/[0.04]">
              {meals.map((meal) => {
                const mealLogs = logsByMeal(meal.id)
                const mealCalories = mealLogs.reduce((sum, l) => sum + l.calories, 0)
                const isLogged = mealLogs.length > 0
                const isExpanded = expandedMeal === meal.id
                const isAdding = addingToMeal === meal.id
                return (
                  <div key={meal.id}>
                    <button
                      onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isLogged ? 'bg-emerald-500/10' : 'bg-[#1B2D50]/[0.04]'}`}>
                          {isLogged ? (
                            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-body font-semibold text-[#1B2D50] text-sm">{meal.name}</p>
                          <p className="text-[#64748B] text-xs font-body">{formatTime(meal.scheduled_time)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#1B2D50] text-sm font-display font-bold">{mealCalories} kcal</span>
                        <svg className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4">
                            {mealLogs.length > 0 ? (
                              <div className="bg-[#FAFBFD] rounded-lg border border-[#1B2D50]/[0.04] overflow-hidden">
                                <table className="w-full text-xs font-body">
                                  <thead>
                                    <tr className="text-[#64748B] uppercase tracking-wide">
                                      <th className="text-left px-3 py-2 font-semibold">Food</th>
                                      <th className="text-right px-3 py-2 font-semibold">Cal</th>
                                      <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">P</th>
                                      <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">C</th>
                                      <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">F</th>
                                      <th className="w-8" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#1B2D50]/[0.04]">
                                    {mealLogs.map((item) => (
                                      <tr key={item.id} className="group">
                                        <td className="px-3 py-2 text-[#1B2D50] font-medium">
                                          {item.food_name}
                                          {item.serving_size && (
                                            <span className="text-[#64748B] text-[11px] ml-1">({item.serving_size})</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-[#1B2D50]">{item.calories}</td>
                                        <td className="px-3 py-2 text-right text-[#1A7BFF] hidden sm:table-cell">{item.protein}g</td>
                                        <td className="px-3 py-2 text-right text-[#F76B16] hidden sm:table-cell">{item.carbs}g</td>
                                        <td className="px-3 py-2 text-right text-[#64748B] hidden sm:table-cell">{item.fats}g</td>
                                        <td className="px-2 py-2 text-right">
                                          <button
                                            onClick={() => handleDeleteFood(item.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity duration-150"
                                            aria-label="Delete food"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-[#64748B] text-xs font-body italic py-2">No food logged yet.</p>
                            )}

                            {/* Add food form */}
                            {isAdding ? (
                              <div className="mt-3 bg-[#FAFBFD] rounded-lg border border-[#1A7BFF]/20 p-3">
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
                                      <strong>Review before saving.</strong> {analysisSource === 'off' ? 'Macros come from the product label — verify the serving size matches what you ate.' : 'Portion sizes are estimates and may be off by ±20%.'}
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

        {/* RIGHT: Hydration + Tip */}
        <div className="lg:col-span-4 space-y-4">
          {/* Hydration */}
          <motion.div custom={3} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-xl border border-[#1B2D50]/[0.06]">
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Hydration</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustWater(-8)}
                    className="w-8 h-8 rounded-full bg-[#FAFBFD] border border-[#1B2D50]/10 text-[#1B2D50] font-display font-bold text-lg hover:bg-[#1A7BFF]/5 hover:border-[#1A7BFF]/30 transition-colors duration-200"
                    aria-label="Subtract 8 oz"
                  >
                    −
                  </button>
                  <button
                    onClick={() => adjustWater(8)}
                    className="w-8 h-8 rounded-full bg-[#1A7BFF] text-white font-display font-bold text-lg hover:bg-[#0F5FE0] transition-colors duration-200"
                    aria-label="Add 8 oz"
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <span className="font-display font-extrabold text-2xl text-[#1A7BFF]">{waterOz}</span>
                  <span className="text-[#64748B] text-sm font-body"> / {WATER_GOAL_OZ} oz</span>
                </div>
              </div>
              <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1A7BFF] rounded-full transition-all duration-300"
                  style={{ width: `${waterPct}%` }}
                />
              </div>
              <p className="text-[#64748B] text-[10px] font-body mt-2 text-center">Each + adds 8 oz (one cup)</p>
            </div>
          </motion.div>

          {/* Coach Nutrition Tip (placeholder for future coach-authored tips) */}
          <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-xl border border-[#1B2D50]/[0.06]">
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Nutrition Tip</h2>
            </div>
            <div className="p-5">
              <div className="p-3 rounded-lg bg-[#F76B16]/[0.04] border border-[#F76B16]/10">
                <p className="text-[#1B2D50] text-sm font-body leading-relaxed">
                  &ldquo;Try to get 30-40g of protein within 30 minutes post-workout. Your shake + a banana is a solid combo.&rdquo;
                </p>
                <p className="text-[#64748B] text-xs font-body mt-2">— Anthony</p>
              </div>
            </div>
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
