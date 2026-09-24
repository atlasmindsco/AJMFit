'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getCurrentUserId } from '@/lib/current-user'
import ResumeSession from '@/components/studio/ResumeSession'
import MacroRing from '@/components/ui/MacroRing'
import { fadeIn } from '@/lib/animations'

const BarcodeScanner = dynamic(() => import('@/components/studio/BarcodeScanner'), { ssr: false })
const FoodSearchSheet = dynamic(() => import('@/components/studio/FoodSearchSheet'), { ssr: false })
import {
  fetchTargets,
  fetchNutritionSetup,
  fetchMeals,
  fetchTodaysLogs,
  fetchDailyLog,
  fetchWeeklyCalories,
  ensureDefaultMeals,
  addFoodLog,
  updateFoodLog,
  deleteFoodLog,
  setWater,
  sumTotals,
  type MacroTargets,
  type MealRow,
  type FoodLogRow,
  type DailyCalories,
} from '@/lib/nutrition'
import {
  calculateBMR,
  calculateMaintenanceCalories,
  type ActivityLevel,
  type Sex,
} from '@/lib/nutrition-goals'
import { useRouter } from 'next/navigation'

/** Per-viewer display preference. Never anything the coach needs to read. */
const MACRO_PREF_KEY = 'ajmfit_show_all_macros'

const DEFAULT_TARGETS: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fats: 70 }
const WATER_GOAL_OZ = 100

/**
 * Serving sizes offered in the add-food form.
 *
 * This used to be a free-text box with a "quick sizes" helper that only
 * appeared once you had already typed something, so the shortcut showed up
 * after you no longer needed it. Picking from a list also gives the lookup a
 * phrase it can actually price: "1 cup egg whites" resolves to 132 calories,
 * where "egg whites" on its own returns a per-100g figure nobody ate.
 */
const SERVING_OPTIONS = [
  '1 serving', '1 oz', '2 oz', '3 oz', '4 oz', '6 oz', '8 oz',
  '1/4 cup', '1/3 cup', '1/2 cup', '1 cup', '2 cups',
  '1 tbsp', '2 tbsp', '1 tsp',
  '1 slice', '2 slices', '1 piece', '1 scoop', '100 g',
]

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
  const [targets, setTargets] = useState<MacroTargets>(DEFAULT_TARGETS)
  const [meals, setMeals] = useState<MealRow[]>([])
  const [logs, setLogs] = useState<FoodLogRow[]>([])
  const [waterOz, setWaterOz] = useState(0)
  const [weekly, setWeekly] = useState<DailyCalories[]>([])
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [addingToMeal, setAddingToMeal] = useState<string | null>(null)
  const [searchMealId, setSearchMealId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '', serving: '', quantity: '1' })
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ quantity: '1', calories: '', protein: '', carbs: '', fats: '' })
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisSource, setAnalysisSource] = useState<'usda' | 'mixed' | 'gpt' | 'off' | null>(null)
  const [analysisComponents, setAnalysisComponents] = useState<Array<{ name: string; grams: number; source: 'usda' | 'gpt' | 'off' }>>([])
  const [typedLookupActive, setTypedLookupActive] = useState(false)
  const [customServing, setCustomServing] = useState(false)
  const [scanningMealId, setScanningMealId] = useState<string | null>(null)
  const lookupAbortRef = useRef<AbortController | null>(null)
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const macroFieldsTouchedRef = useRef(false)

  // Calories and protein are what decide the result for almost everyone.
  // Carbs and fat stay available but are off by default, because three rings
  // a client was never asked to hit mostly manufacture a feeling of failure.
  const [showAllMacros, setShowAllMacros] = useState(false)
  const [maintenance, setMaintenance] = useState<number | null>(null)

  useEffect(() => {
    try {
      setShowAllMacros(localStorage.getItem(MACRO_PREF_KEY) === '1')
    } catch {
      // Private browsing or blocked storage. The default stands.
    }
  }, [])

  const toggleMacros = () => {
    setShowAllMacros((prev) => {
      const next = !prev
      try {
        localStorage.setItem(MACRO_PREF_KEY, next ? '1' : '0')
      } catch {
        // Preference just will not persist. Not worth telling anyone about.
      }
      return next
    })
  }

  useEffect(() => {
    ;(async () => {
      const id = await getCurrentUserId()
      setUserId(id)
      if (!id) {
        setLoading(false)
        return
      }
      try {
        const setup = await fetchNutritionSetup(id)
        if (!setup.nutrition_goal_setup_complete) {
          router.push('/studio/setup-nutrition')
          return
        }

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

        // Maintenance is recomputed here rather than stored, so it always
        // reflects the client's current weight. The deficit shown below is
        // measured against the target actually in force, which means it stays
        // honest when Anthony has set targets by hand.
        if (setup.current_weight && setup.height && setup.age && setup.sex && setup.activity_level) {
          const bmrValue = calculateBMR(
            Number(setup.current_weight),
            Number(setup.height),
            Number(setup.age),
            setup.sex as Sex
          )
          setMaintenance(calculateMaintenanceCalories(bmrValue, setup.activity_level as ActivityLevel))
        }
      } catch (err) {
        console.error('[Nutrition] Failed to load:', err)
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
    setAddForm({ name: '', calories: '', protein: '', carbs: '', fats: '', serving: '', quantity: '1' })
    setAddingToMeal(null)
    setAnalysisSource(null)
    setAnalysisError(null)
    setAnalysisComponents([])
    macroFieldsTouchedRef.current = false
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    lookupAbortRef.current?.abort()
    lookupAbortRef.current = null
    setTypedLookupActive(false)
    setCustomServing(false)
  }

  /**
   * Picking a serving re-prices the food for that amount.
   *
   * The macro fields are marked untouched first: choosing a serving is an
   * explicit request for the right numbers, so it should override an earlier
   * manual edit rather than be blocked by it.
   */
  const applyServing = (serving: string) => {
    setAddForm((prev) => ({ ...prev, serving }))
    const name = addForm.name.trim()
    if (serving && name.length >= 3) {
      macroFieldsTouchedRef.current = false
      runTypedLookup(`${serving} ${name}`)
    }
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

  const handleUpdateFood = async (id: string) => {
    setSubmitting(true)
    try {
      const updated = await updateFoodLog({
        id,
        calories: parseInt(editForm.calories) || 0,
        protein: parseFloat(editForm.protein) || 0,
        carbs: parseFloat(editForm.carbs) || 0,
        fats: parseFloat(editForm.fats) || 0,
        servingSize: editForm.quantity.trim() || undefined,
      })
      setLogs((prev) => prev.map((log) => (log.id === id ? updated : log)))
      setEditingId(null)
    } catch (err) {
      console.error('[Update food] Failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const applyQuantityMultiplier = (log: FoodLogRow, multiplier: number) => {
    const updated = {
      ...log,
      calories: Math.round(log.calories * multiplier),
      protein: Math.round(log.protein * multiplier * 10) / 10,
      carbs: Math.round(log.carbs * multiplier * 10) / 10,
      fats: Math.round(log.fats * multiplier * 10) / 10,
    }
    setEditForm({
      quantity: log.serving_size || '',
      calories: updated.calories.toString(),
      protein: updated.protein.toString(),
      carbs: updated.carbs.toString(),
      fats: updated.fats.toString(),
    })
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
      setAddForm((prev) => ({
        ...prev,
        name: data.foodName,
        serving: data.servingSize,
        calories: String(data.calories),
        protein: String(data.protein),
        carbs: String(data.carbs),
        fats: String(data.fats),
      }))
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
      setAddForm((prev) => ({
        ...prev,
        name: data.foodName,
        serving: data.servingSize,
        calories: String(data.calories),
        protein: String(data.protein),
        carbs: String(data.carbs),
        fats: String(data.fats),
      }))
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
        <div className="w-8 h-8 border-2 border-brand-navy/10 border-t-brand-blue rounded-full animate-spin" />
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
      {searchMealId && userId && (() => {
        const searchMeal = meals.find((m) => m.id === searchMealId)
        if (!searchMeal) return null
        return (
          <FoodSearchSheet
            meal={searchMeal}
            userId={userId}
            onClose={() => setSearchMealId(null)}
            onAdded={(log) => setLogs((prev) => [...prev, log])}
          />
        )
      })()}

      <div className="mb-4 flex items-center justify-end">
        <a
          href="/studio/setup-nutrition"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-blue to-brand-bluedark text-white rounded-control font-display font-bold text-sm uppercase tracking-[0.08em] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue transition-[transform,box-shadow] duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-5.971m0 0V9.348m0 9.295h4.992m-9.992 2.964h9.987M2.985 9.348h16.338M21.984 19.644v2.986m0 0v-2.986m0 2.986H4.014M4.014 19.644h17.97m0 0h-9.987" />
          </svg>
          Recalculate Macros
        </a>
      </div>

      <motion.div
        custom={0}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-card border border-brand-navy/[0.06] p-6 mb-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl text-brand-navy tracking-tight">Today&apos;s Nutrition</h1>
                <a
                  href="/studio/setup-nutrition?edit=true"
                  className="px-3 py-1 text-xs font-display font-semibold uppercase tracking-wide rounded bg-brand-navy/[0.08] text-brand-navy hover:bg-brand-navy/[0.12] transition-colors"
                >
                  Edit
                </a>
                <button
                  onClick={async () => {
                    if (!confirm('Delete all nutrition goals and start over? This cannot be undone.')) return
                    try {
                      const res = await fetch('/api/nutrition/delete-setup', { method: 'POST' })
                      if (res.ok) {
                        router.push('/studio/setup-nutrition')
                      } else {
                        alert('Failed to delete nutrition setup')
                      }
                    } catch (err) {
                      alert('Error deleting nutrition setup')
                    }
                  }}
                  className="px-3 py-1 text-xs font-display font-semibold uppercase tracking-wide rounded bg-red-500/[0.1] text-red-600 hover:bg-red-500/[0.15] transition-colors"
                >
                  Delete
                </button>
              </div>
              <span className="text-brand-navy text-sm font-body font-semibold">
                {totals.calories.toLocaleString()} / {targets.calories.toLocaleString()} kcal
              </span>
            </div>
            <div className="w-full h-4 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${calPct > 100 ? 'bg-brand-orange' : 'bg-brand-blue'}`}
                style={{ width: `${Math.min(calPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-brand-slate text-xs font-body">{Math.round(calPct)}% of daily goal</span>
              <span className={`text-xs font-body font-medium ${totals.calories > targets.calories ? 'text-brand-orange' : 'text-emerald-500'}`}>
                {Math.abs(targets.calories - totals.calories)} kcal {totals.calories > targets.calories ? 'over' : 'remaining'}
              </span>
            </div>

            {/* Why this number is this number. A target a client does not
                understand is a target they stop following. */}
            {maintenance !== null && (
              <p className="text-brand-slate text-xs font-body mt-3 leading-relaxed">
                You burn roughly{' '}
                <span className="text-brand-navy font-semibold">{maintenance.toLocaleString()}</span> kcal a
                day.{' '}
                {(() => {
                  const delta = targets.calories - maintenance
                  const lbs = Math.abs((delta * 7) / 3500).toFixed(1)
                  if (Math.abs(delta) < 60) return 'Your target holds you roughly level.'
                  return delta < 0
                    ? `Eating ${Math.abs(delta)} under that is about ${lbs} lbs of loss a week.`
                    : `Eating ${delta} over that is about ${lbs} lbs of gain a week.`
                })()}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center lg:items-end gap-3">
          <div className="flex items-center justify-around lg:justify-end gap-6 lg:gap-8">
            {[
              { label: 'Protein', current: totals.protein, goal: targets.protein, unit: 'g', color: '#1A7BFF' },
              ...(showAllMacros
                ? [
                    { label: 'Carbs', current: totals.carbs, goal: targets.carbs, unit: 'g', color: '#F76B16' },
                    { label: 'Fats', current: totals.fats, goal: targets.fats, unit: 'g', color: '#64748B' },
                  ]
                : []),
            ].map((macro) => (
              <div key={macro.label} className="flex flex-col items-center">
                <div className="relative">
                  <MacroRing current={macro.current} goal={macro.goal} color={macro.color} size={80} bgStroke="#E5E7EB" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display font-bold text-brand-navy text-sm">
                      {Math.round(macro.current)}{macro.unit}
                    </span>
                  </div>
                </div>
                <span className="font-body font-semibold text-brand-navy text-xs mt-1.5">{macro.label}</span>
                <span className="text-brand-slate text-2xs font-body">
                  / {macro.goal}{macro.unit}
                </span>
              </div>
            ))}
          </div>
            <button
              onClick={toggleMacros}
              className="text-brand-slate hover:text-brand-navy text-xs font-body underline underline-offset-2 transition-colors"
            >
              {showAllMacros ? 'Hide carbs and fat' : 'Show carbs and fat'}
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-card border border-brand-navy/[0.06]">
            <div className="px-5 py-4 border-b border-brand-navy/[0.06] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-brand-navy">Meal Plan</h2>
              <span className="text-brand-slate text-xs font-body">
                {meals.filter((m) => logsByMeal(m.id).length > 0).length} / {meals.length} logged
              </span>
            </div>
            <div className="divide-y divide-brand-navy/[0.04]">
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
                        <div className={`w-8 h-8 rounded-control flex items-center justify-center shrink-0 ${isLogged ? 'bg-emerald-500/10' : 'bg-brand-navy/[0.04]'}`}>
                          {isLogged ? (
                            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-brand-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-body font-semibold text-brand-navy text-sm">{meal.name}</p>
                          <p className="text-brand-slate text-xs font-body">{formatTime(meal.scheduled_time)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-brand-navy text-sm font-display font-bold">{mealCalories} kcal</span>
                        <svg className={`w-4 h-4 text-brand-slate transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                              <div className="bg-[#FAFBFD] rounded-control border border-brand-navy/[0.04] overflow-hidden">
                                <table className="w-full text-xs font-body">
                                  <thead>
                                    <tr className="text-brand-slate uppercase tracking-wide">
                                      <th className="text-left px-3 py-2 font-semibold">Food</th>
                                      <th className="text-right px-3 py-2 font-semibold">Cal</th>
                                      <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">P</th>
                                      <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">C</th>
                                      <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">F</th>
                                      <th className="w-12" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-brand-navy/[0.04]">
                                    {mealLogs.map((item) => (
                                      <tr key={item.id} className="group">
                                        <td className="px-3 py-2 text-brand-navy font-medium">
                                          {editingId === item.id ? (
                                            <div className="space-y-2">
                                              <input
                                                type="text"
                                                value={editForm.quantity}
                                                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                                placeholder="Portion size (e.g. 10 oz)"
                                                className="px-2 py-1 border border-brand-blue/30 rounded text-xs bg-white w-full"
                                              />
                                              <div className="flex gap-1">
                                                <button
                                                  onClick={() => applyQuantityMultiplier(item, 0.5)}
                                                  className="px-2 py-1 text-xs bg-brand-blue/10 text-brand-blue rounded hover:bg-brand-blue/20 font-semibold"
                                                >
                                                  0.5x
                                                </button>
                                                <button
                                                  onClick={() => applyQuantityMultiplier(item, 1)}
                                                  className="px-2 py-1 text-xs bg-brand-blue/10 text-brand-blue rounded hover:bg-brand-blue/20 font-semibold"
                                                >
                                                  1x
                                                </button>
                                                <button
                                                  onClick={() => applyQuantityMultiplier(item, 1.5)}
                                                  className="px-2 py-1 text-xs bg-brand-blue/10 text-brand-blue rounded hover:bg-brand-blue/20 font-semibold"
                                                >
                                                  1.5x
                                                </button>
                                                <button
                                                  onClick={() => applyQuantityMultiplier(item, 2)}
                                                  className="px-2 py-1 text-xs bg-brand-blue/10 text-brand-blue rounded hover:bg-brand-blue/20 font-semibold"
                                                >
                                                  2x
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              {item.food_name}
                                              {item.serving_size && (
                                                <span className="text-brand-slate text-2xs ml-1">({item.serving_size})</span>
                                              )}
                                            </>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-brand-navy">
                                          {editingId === item.id ? (
                                            <input
                                              type="number"
                                              value={editForm.calories}
                                              onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })}
                                              placeholder="0"
                                              className="px-2 py-1 border border-brand-blue/30 rounded text-xs bg-white w-16 text-right"
                                            />
                                          ) : (
                                            item.calories
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-brand-blue hidden sm:table-cell">
                                          {editingId === item.id ? (
                                            <input
                                              type="number"
                                              value={editForm.protein}
                                              onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })}
                                              placeholder="0"
                                              className="px-2 py-1 border border-brand-blue/30 rounded text-xs bg-white w-14 text-right"
                                            />
                                          ) : (
                                            `${item.protein}g`
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-brand-orange hidden sm:table-cell">
                                          {editingId === item.id ? (
                                            <input
                                              type="number"
                                              value={editForm.carbs}
                                              onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })}
                                              placeholder="0"
                                              className="px-2 py-1 border border-brand-blue/30 rounded text-xs bg-white w-14 text-right"
                                            />
                                          ) : (
                                            `${item.carbs}g`
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-brand-slate hidden sm:table-cell">
                                          {editingId === item.id ? (
                                            <input
                                              type="number"
                                              value={editForm.fats}
                                              onChange={(e) => setEditForm({ ...editForm, fats: e.target.value })}
                                              placeholder="0"
                                              className="px-2 py-1 border border-brand-blue/30 rounded text-xs bg-white w-14 text-right"
                                            />
                                          ) : (
                                            `${item.fats}g`
                                          )}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          {editingId === item.id ? (
                                            <div className="flex gap-1 justify-end">
                                              <button
                                                onClick={() => handleUpdateFood(item.id)}
                                                disabled={submitting}
                                                className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 font-semibold text-xs"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => setEditingId(null)}
                                                className="text-brand-slate hover:text-brand-navy font-semibold text-xs"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                              <button
                                                onClick={() => {
                                                  setEditingId(item.id)
                                                  setEditForm({
                                                    quantity: item.serving_size || '',
                                                    calories: item.calories.toString(),
                                                    protein: item.protein.toString(),
                                                    carbs: item.carbs.toString(),
                                                    fats: item.fats.toString(),
                                                  })
                                                }}
                                                className="text-brand-blue hover:text-brand-bluedark text-xs font-semibold"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                onClick={() => handleDeleteFood(item.id)}
                                                className="text-red-400 hover:text-red-600 text-xs font-semibold"
                                              >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-brand-slate text-xs font-body italic py-2">No food logged yet.</p>
                            )}

                            {isAdding ? (
                              <div className="mt-3 bg-[#FAFBFD] rounded-control border border-brand-blue/20 p-3">
                                {analysisSource && (
                                  <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2">
                                    <div className="flex items-center gap-2 text-2xs font-display font-bold uppercase tracking-wide text-emerald-700">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                      </svg>
                                      Auto-filled
                                      <span className={`ml-1 px-1.5 py-0.5 rounded ${
                                        analysisSource === 'usda' || analysisSource === 'off'
                                          ? 'bg-emerald-200 text-emerald-800'
                                          : analysisSource === 'mixed'
                                          ? 'bg-amber-200 text-amber-800'
                                          : 'bg-brand-navy/10 text-brand-navy'
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
                                  </div>
                                )}
                                {analysisError && (
                                  <div className="text-red-600 text-2xs font-body mb-2">{analysisError}</div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2 mb-2">
                                  <label className="block">
                                    <span className="block text-2xs font-display font-bold uppercase tracking-wide text-brand-slate mb-1">Food</span>
                                    {/* The lookup lands ~600ms after you stop typing and fills
                                        the macros. Every setAddForm here updates from prev
                                        rather than a captured addForm: spreading the captured
                                        copy meant the next keystroke wrote back a version from
                                        before the lookup, wiping the calories that had just
                                        appeared. */}
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="e.g. teriyaki chicken bowl"
                                        value={addForm.name}
                                        onChange={(e) => {
                                          const next = e.target.value
                                          setAddForm((prev) => ({ ...prev, name: next }))
                                          runTypedLookup(next)
                                        }}
                                        className="w-full px-3 py-2 pr-9 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                      />
                                      {typedLookupActive && (
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
                                      )}
                                    </div>
                                  </label>
                                  <label className="block">
                                    <span className="block text-2xs font-display font-bold uppercase tracking-wide text-brand-slate mb-1">Serving</span>
                                    {customServing ? (
                                      <input
                                        type="text"
                                        autoFocus
                                        placeholder="e.g. 2 slices"
                                        value={addForm.serving}
                                        onChange={(e) => setAddForm((prev) => ({ ...prev, serving: e.target.value }))}
                                        onBlur={(e) => applyServing(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                      />
                                    ) : (
                                      <select
                                        value={SERVING_OPTIONS.includes(addForm.serving) ? addForm.serving : ''}
                                        onChange={(e) => {
                                          if (e.target.value === '__custom') {
                                            setCustomServing(true)
                                            setAddForm((prev) => ({ ...prev, serving: '' }))
                                            return
                                          }
                                          applyServing(e.target.value)
                                        }}
                                        className="w-full px-3 py-2 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                      >
                                        <option value="">
                                          {addForm.serving && !SERVING_OPTIONS.includes(addForm.serving)
                                            ? addForm.serving
                                            : 'Choose…'}
                                        </option>
                                        {SERVING_OPTIONS.map((s) => (
                                          <option key={s} value={s}>
                                            {s}
                                          </option>
                                        ))}
                                        <option value="__custom">Something else…</option>
                                      </select>
                                    )}
                                  </label>
                                  <label className="block">
                                    <span className="block text-2xs font-display font-bold uppercase tracking-wide text-brand-slate mb-1">Calories</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      placeholder="kcal"
                                      value={addForm.calories}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm((prev) => ({ ...prev, calories: e.target.value }))
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                  <label className="block">
                                    <span className="block text-2xs font-display font-bold uppercase tracking-wide text-brand-blue mb-1">Protein (g)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={addForm.protein}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm((prev) => ({ ...prev, protein: e.target.value }))
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="block text-2xs font-display font-bold uppercase tracking-wide text-brand-orange mb-1">Carbs (g)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={addForm.carbs}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm((prev) => ({ ...prev, carbs: e.target.value }))
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="block text-2xs font-display font-bold uppercase tracking-wide text-brand-slate mb-1">Fats (g)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={addForm.fats}
                                      onChange={(e) => {
                                        macroFieldsTouchedRef.current = true
                                        setAddForm((prev) => ({ ...prev, fats: e.target.value }))
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-white border border-brand-navy/10 rounded-control font-body focus:outline-none focus:border-brand-blue/50"
                                    />
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddFood(meal.id)}
                                    disabled={submitting || !addForm.name.trim()}
                                    className="px-4 py-2 bg-brand-blue text-white text-xs font-display font-bold uppercase tracking-wide rounded-control hover:bg-brand-bluedark disabled:opacity-50 transition-colors duration-200"
                                  >
                                    {submitting ? 'Adding...' : 'Add Food'}
                                  </button>
                                  <button
                                    onClick={resetAddState}
                                    className="px-4 py-2 bg-white border border-brand-navy/10 text-brand-slate text-xs font-display font-bold uppercase tracking-wide rounded-control hover:bg-[#FAFBFD] transition-colors duration-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button
                                  onClick={() => setSearchMealId(meal.id)}
                                  disabled={analyzing !== null}
                                  className="py-2 bg-brand-blue rounded-control text-white text-xs font-display font-bold uppercase tracking-wide hover:bg-brand-bluedark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue active:scale-[0.98] transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                  </svg>
                                  Search
                                </button>
                                <label className="cursor-pointer py-2 border border-dashed border-brand-orange/30 rounded-control text-brand-orange text-xs font-display font-bold uppercase tracking-wide hover:bg-brand-orange/[0.04] transition-colors duration-200 flex items-center justify-center gap-1.5">
                                  {analyzing === meal.id ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
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
                                      e.target.value = ''
                                    }}
                                  />
                                </label>
                                <button
                                  onClick={() => {
                                    macroFieldsTouchedRef.current = false
                                    setScanningMealId(meal.id)
                                  }}
                                  disabled={analyzing !== null}
                                  className="py-2 border border-dashed border-brand-blue/30 rounded-control text-brand-blue text-xs font-display font-bold uppercase tracking-wide hover:bg-brand-blue/[0.04] transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                                  className="py-2 border border-dashed border-brand-navy/15 rounded-control text-brand-slate text-xs font-display font-bold uppercase tracking-wide hover:border-brand-blue/30 hover:text-brand-blue transition-colors duration-200"
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

          <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-card border border-brand-navy/[0.06]">
            <div className="px-5 py-4 border-b border-brand-navy/[0.06]">
              <h2 className="font-display font-bold text-sm text-brand-navy">Weekly Calorie Trend</h2>
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
                      <span className="text-2xs font-display font-bold text-brand-navy">
                        {day.calories > 0 ? day.calories : '--'}
                      </span>
                      <div className="w-full rounded-t-md overflow-hidden" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                        <div
                          className={`w-full h-full rounded-t-md ${
                            day.calories === 0 ? 'bg-[#E5E7EB]' : onTarget ? 'bg-brand-blue' : 'bg-brand-orange'
                          }`}
                        />
                      </div>
                      <span className="text-2xs font-body text-brand-slate">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <motion.div custom={3} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-card border border-brand-navy/[0.06]">
            <div className="px-5 py-4 border-b border-brand-navy/[0.06]">
              <h2 className="font-display font-bold text-sm text-brand-navy">Hydration</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustWater(-8)}
                    className="w-8 h-8 rounded-full bg-[#FAFBFD] border border-brand-navy/10 text-brand-navy font-display font-bold text-lg hover:bg-brand-blue/5 hover:border-brand-blue/30 transition-colors duration-200"
                    aria-label="Subtract 8 oz"
                  >
                    −
                  </button>
                  <button
                    onClick={() => adjustWater(8)}
                    className="w-8 h-8 rounded-full bg-brand-blue text-white font-display font-bold text-lg hover:bg-brand-bluedark transition-colors duration-200"
                    aria-label="Add 8 oz"
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <span className="font-display font-extrabold text-2xl text-brand-blue">{waterOz}</span>
                  <span className="text-brand-slate text-sm font-body"> / {WATER_GOAL_OZ} oz</span>
                </div>
              </div>
              <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-blue rounded-full transition-all duration-300"
                  style={{ width: `${waterPct}%` }}
                />
              </div>
              <p className="text-brand-slate text-2xs font-body mt-2 text-center">Each + adds 8 oz (one cup)</p>
            </div>
          </motion.div>

          <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-card border border-brand-navy/[0.06]">
            <div className="px-5 py-4 border-b border-brand-navy/[0.06]">
              <h2 className="font-display font-bold text-sm text-brand-navy">Nutrition Tip</h2>
            </div>
            <div className="p-5">
              <div className="p-3 rounded-control bg-brand-orange/[0.04] border border-brand-orange/10">
                <p className="text-brand-navy text-sm font-body leading-relaxed">
                  &ldquo;Try to get 30-40g of protein within 30 minutes post-workout. Your shake + a banana is a solid combo.&rdquo;
                </p>
                <p className="text-brand-slate text-xs font-body mt-2">, Anthony</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <p className="mt-8 text-brand-slate text-2xs font-body italic text-center max-w-2xl mx-auto leading-relaxed">
        Macro values are estimates. Photo recognition uses AI and the USDA FoodData Central database; portion sizes may be off. Always review and adjust entries to match what you actually ate.
      </p>
    </div>
  )
}
