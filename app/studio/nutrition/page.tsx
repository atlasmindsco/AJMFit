'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { getCurrentUserId } from '@/lib/current-user'
import ResumeSession from '@/components/studio/ResumeSession'
import MacroRing from '@/components/ui/MacroRing'
import { fadeIn } from '@/lib/animations'
import FoodSearchModal from '@/components/studio/FoodSearchModal'
import { FoodNutrition, FoodUnit } from '@/lib/nutrition-calc'
import { useNutritionFoods } from '@/lib/useNutritionFoods'

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
  const [foodSearchOpen, setFoodSearchOpen] = useState<string | null>(null)

  const { loaded: foodsLoaded, saveToRecent, getRecent } = useNutritionFoods()

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
  const caloriesRemaining = Math.max(0, targets.calories - totals.calories)

  const logsByMeal = (mealId: string) => logs.filter((l) => l.meal_id === mealId)

  const handleAddFood = async (
    mealId: string,
    quantity: number,
    unit: FoodUnit,
    totalNutrition: any,
    foodName: string
  ) => {
    if (!userId) return
    try {
      const servingSize = `${quantity} ${unit.abbreviation}`
      const newLog = await addFoodLog({
        userId,
        mealId,
        foodName,
        calories: Math.round(totalNutrition.calories),
        protein: totalNutrition.protein,
        carbs: totalNutrition.carbs,
        fats: totalNutrition.fats,
        servingSize,
      })
      setLogs((prev) => [...prev, newLog])

      // Save to recent
      const food: FoodNutrition = {
        name: foodName,
        baseWeight: 100,
        baseNutrition: totalNutrition,
        availableUnits: [unit],
      }
      saveToRecent(food, quantity, unit)
    } catch (err) {
      console.error('[Add food] Failed:', err)
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

  if (loading || !foodsLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const weekMax = Math.max(targets.calories * 1.2, ...weekly.map((d) => d.calories))

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen pb-8">
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
          { label: 'Protein', current: totals.protein, goal: targets.protein, unit: 'g', color: 'from-blue-400 to-blue-500' },
          { label: 'Carbs', current: totals.carbs, goal: targets.carbs, unit: 'g', color: 'from-orange-400 to-orange-500' },
          { label: 'Fats', current: totals.fats, goal: targets.fats, unit: 'g', color: 'from-green-400 to-green-500' },
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

      {/* Meals */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="space-y-3 mb-8">
          {meals.map((meal) => {
            const mealLogs = logsByMeal(meal.id)
            const mealCalories = mealLogs.reduce((sum, l) => sum + l.calories, 0)
            const mealProtein = mealLogs.reduce((sum, l) => sum + l.protein, 0)
            const mealCarbs = mealLogs.reduce((sum, l) => sum + l.carbs, 0)
            const mealFats = mealLogs.reduce((sum, l) => sum + l.fats, 0)
            const isExpanded = expandedMeal === meal.id

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
                  <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
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
                      <div className="px-5 py-4 space-y-4">
                        {mealLogs.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {mealLogs.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                                  <div className="flex-1">
                                    <p className="font-body font-semibold text-gray-800 text-sm">{item.food_name}</p>
                                    {item.serving_size && <p className="text-gray-500 text-xs">{item.serving_size}</p>}
                                  </div>
                                  <div className="flex items-center gap-3 ml-4">
                                    <div className="text-right">
                                      <p className="font-display font-bold text-gray-800 text-sm">{item.calories}</p>
                                      <p className="text-gray-500 text-xs">cal</p>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteFood(item.id)}
                                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1"
                                      aria-label="Delete"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="pt-3 border-t border-gray-200">
                              <div className="flex justify-between text-sm">
                                <span className="font-semibold text-gray-800">Totals</span>
                                <div className="flex gap-4 text-xs">
                                  <span className="text-blue-600 font-semibold">P: {Math.round(mealProtein)}g</span>
                                  <span className="text-orange-600 font-semibold">C: {Math.round(mealCarbs)}g</span>
                                  <span className="text-green-600 font-semibold">F: {Math.round(mealFats)}g</span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-gray-500 text-sm font-body italic py-2">No food logged yet.</p>
                        )}

                        <button
                          onClick={() => setFoodSearchOpen(meal.id)}
                          className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                        >
                          + Add Food
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
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

        {/* Hydration + Tip */}
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
              >
                − 8 oz
              </button>
              <button
                onClick={() => adjustWater(8)}
                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                + 8 oz
              </button>
            </div>
          </motion.div>

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

      {/* Food Search Modal */}
      <AnimatePresence>
        {foodSearchOpen && (
          <FoodSearchModal
            mealId={foodSearchOpen}
            recentFoods={getRecent([]) || []}
            onAdd={handleAddFood}
            onClose={() => setFoodSearchOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
