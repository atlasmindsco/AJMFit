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
        // Check if nutrition setup is complete
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
        <div className="w-8 h-8 border-2 border-[#1B2D50]/10 border-t-[#1A7BFF] rounded-full animate-spin" />
      </div>
    )
  }

  const weekMax = Math.max(targets.calories * 1.2, ...weekly.map((d) => d.calories))

  // Temporary: nutrition rendering has a merge conflict issue
  // Features like edit/delete nutrition setup are working
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFD] to-[#F3F5F7] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display font-extrabold text-3xl text-[#1B2D50] mb-8">Nutrition Tracking</h1>
        <div className="bg-white rounded-xl border border-[#1B2D50]/[0.06] p-8">
          <p className="text-lg text-[#1B2D50] mb-6">Your nutrition dashboard is being updated. Your goals are saved and you can edit them anytime.</p>
          <div className="flex gap-4">
            <a href="/studio/setup-nutrition?edit=true" className="px-6 py-3 bg-[#1A7BFF] text-white rounded-lg font-display font-bold hover:bg-[#0F5FE0] transition-colors">
              Edit Nutrition Goals
            </a>
            <a href="/studio" className="px-6 py-3 bg-[#1B2D50]/[0.08] text-[#1B2D50] rounded-lg font-display font-bold hover:bg-[#1B2D50]/[0.12] transition-colors">
              Back to Studio
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
