'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

/* ── Animation ── */
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

/* ── Macro Ring ── */
function MacroRing({ current, goal, color, size = 80 }: { current: number; goal: number; color: string; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(current / goal, 1)
  const offset = circumference * (1 - pct)
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
    </svg>
  )
}

/* ── Daily Targets ── */
const dailyTargets = {
  calories: { current: 1750, goal: 2000 },
  protein: { current: 150, goal: 180 },
  carbs: { current: 220, goal: 250 },
  fats: { current: 60, goal: 70 },
  water: { current: 2.5, goal: 3.0 },
  fiber: { current: 22, goal: 30 },
}

/* ── Meal Plan ── */
const meals = [
  {
    name: 'Breakfast',
    time: '7:00 AM',
    calories: 450,
    items: [
      { food: 'Scrambled Eggs (3)', cal: 210, protein: 18, carbs: 3, fats: 15 },
      { food: 'Oatmeal w/ Berries', cal: 190, protein: 6, carbs: 34, fats: 4 },
      { food: 'Black Coffee', cal: 5, protein: 0, carbs: 1, fats: 0 },
    ],
    logged: true,
  },
  {
    name: 'Snack',
    time: '10:00 AM',
    calories: 200,
    items: [
      { food: 'Greek Yogurt', cal: 130, protein: 15, carbs: 8, fats: 4 },
      { food: 'Almonds (1 oz)', cal: 160, protein: 6, carbs: 6, fats: 14 },
    ],
    logged: true,
  },
  {
    name: 'Lunch',
    time: '12:30 PM',
    calories: 550,
    items: [
      { food: 'Grilled Chicken Breast (6 oz)', cal: 280, protein: 52, carbs: 0, fats: 6 },
      { food: 'Brown Rice (1 cup)', cal: 215, protein: 5, carbs: 45, fats: 2 },
      { food: 'Steamed Broccoli', cal: 55, protein: 4, carbs: 10, fats: 1 },
    ],
    logged: true,
  },
  {
    name: 'Pre-Workout',
    time: '4:00 PM',
    calories: 250,
    items: [
      { food: 'Banana', cal: 105, protein: 1, carbs: 27, fats: 0 },
      { food: 'Protein Shake', cal: 140, protein: 25, carbs: 3, fats: 2 },
    ],
    logged: false,
  },
  {
    name: 'Dinner',
    time: '7:30 PM',
    calories: 600,
    items: [
      { food: 'Salmon Fillet (6 oz)', cal: 350, protein: 34, carbs: 0, fats: 22 },
      { food: 'Sweet Potato', cal: 115, protein: 2, carbs: 27, fats: 0 },
      { food: 'Mixed Greens Salad', cal: 80, protein: 3, carbs: 8, fats: 4 },
    ],
    logged: false,
  },
]

/* ── Weekly Averages ── */
const weeklyAvg = [
  { day: 'Mon', calories: 2050, onTarget: true },
  { day: 'Tue', calories: 1920, onTarget: true },
  { day: 'Wed', calories: 2200, onTarget: false },
  { day: 'Thu', calories: 1980, onTarget: true },
  { day: 'Fri', calories: 1750, onTarget: true },
  { day: 'Sat', calories: 0, onTarget: false },
  { day: 'Sun', calories: 0, onTarget: false },
]

/* ── Supplements ── */
const supplements = [
  { name: 'Whey Protein', timing: 'Post-workout', taken: true },
  { name: 'Creatine (5g)', timing: 'Morning', taken: true },
  { name: 'Fish Oil', timing: 'With dinner', taken: false },
  { name: 'Vitamin D3', timing: 'Morning', taken: true },
  { name: 'Multivitamin', timing: 'Morning', taken: true },
]

export default function NutritionPage() {
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null)
  const calPct = (dailyTargets.calories.current / dailyTargets.calories.goal) * 100

  return (
    <div>
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
              <h1 className="font-display font-extrabold text-xl text-[#1B2D50] tracking-tight">
                Today&apos;s Nutrition
              </h1>
              <span className="text-[#1B2D50] text-sm font-body font-semibold">
                {dailyTargets.calories.current.toLocaleString()} / {dailyTargets.calories.goal.toLocaleString()} kcal
              </span>
            </div>
            <div className="w-full h-4 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2E6AB0] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(calPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[#64748B] text-xs font-body">{Math.round(calPct)}% of daily goal</span>
              <span className="text-emerald-500 text-xs font-body font-medium">
                {dailyTargets.calories.goal - dailyTargets.calories.current} kcal remaining
              </span>
            </div>
          </div>

          {/* Macro rings */}
          <div className="flex items-center justify-around lg:justify-end gap-6 lg:gap-8">
            {[
              { label: 'Protein', ...dailyTargets.protein, unit: 'g', color: '#2E6AB0' },
              { label: 'Carbs', ...dailyTargets.carbs, unit: 'g', color: '#F08B1E' },
              { label: 'Fats', ...dailyTargets.fats, unit: 'g', color: '#64748B' },
            ].map((macro) => (
              <div key={macro.label} className="flex flex-col items-center">
                <div className="relative">
                  <MacroRing current={macro.current} goal={macro.goal} color={macro.color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display font-bold text-[#1B2D50] text-sm">
                      {macro.current}{macro.unit}
                    </span>
                  </div>
                </div>
                <span className="font-body font-semibold text-[#1B2D50] text-xs mt-1.5">{macro.label}</span>
                <span className="text-[#64748B] text-[10px] font-body">/ {macro.goal}{macro.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Meal Plan */}
        <div className="lg:col-span-8 space-y-4">
          <motion.div
            custom={1}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Meal Plan</h2>
              <span className="text-[#64748B] text-xs font-body">{meals.filter(m => m.logged).length} / {meals.length} logged</span>
            </div>
            <div className="divide-y divide-[#1B2D50]/[0.04]">
              {meals.map((meal, i) => (
                <div key={i}>
                  <button
                    onClick={() => setExpandedMeal(expandedMeal === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        meal.logged ? 'bg-emerald-500/10' : 'bg-[#1B2D50]/[0.04]'
                      }`}>
                        {meal.logged ? (
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
                        <p className="text-[#64748B] text-xs font-body">{meal.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#1B2D50] text-sm font-display font-bold">{meal.calories} kcal</span>
                      <svg className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${expandedMeal === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {expandedMeal === i && (
                    <div className="px-5 pb-4">
                      <div className="bg-[#FAFBFD] rounded-lg border border-[#1B2D50]/[0.04] overflow-hidden">
                        <table className="w-full text-xs font-body">
                          <thead>
                            <tr className="text-[#64748B] uppercase tracking-wide">
                              <th className="text-left px-3 py-2 font-semibold">Food</th>
                              <th className="text-right px-3 py-2 font-semibold">Cal</th>
                              <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">P</th>
                              <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">C</th>
                              <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">F</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1B2D50]/[0.04]">
                            {meal.items.map((item, j) => (
                              <tr key={j}>
                                <td className="px-3 py-2 text-[#1B2D50] font-medium">{item.food}</td>
                                <td className="px-3 py-2 text-right text-[#1B2D50]">{item.cal}</td>
                                <td className="px-3 py-2 text-right text-[#2E6AB0] hidden sm:table-cell">{item.protein}g</td>
                                <td className="px-3 py-2 text-right text-[#F08B1E] hidden sm:table-cell">{item.carbs}g</td>
                                <td className="px-3 py-2 text-right text-[#64748B] hidden sm:table-cell">{item.fats}g</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Weekly Calorie Trend */}
          <motion.div
            custom={2}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Weekly Calorie Trend</h2>
            </div>
            <div className="p-5">
              <div className="flex items-end gap-2 h-36">
                {weeklyAvg.map((day) => {
                  const maxCal = 2500
                  const heightPct = day.calories > 0 ? (day.calories / maxCal) * 100 : 0
                  return (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-display font-bold text-[#1B2D50]">
                        {day.calories > 0 ? day.calories : '--'}
                      </span>
                      <div className="w-full rounded-t-md overflow-hidden" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                        <div className={`w-full h-full rounded-t-md ${
                          day.calories === 0 ? 'bg-[#E5E7EB]' : day.onTarget ? 'bg-[#2E6AB0]' : 'bg-[#F08B1E]'
                        }`} />
                      </div>
                      <span className="text-[10px] font-body text-[#64748B]">{day.day}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#2E6AB0]" />
                  <span className="text-[10px] font-body text-[#64748B]">On Target</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F08B1E]" />
                  <span className="text-[10px] font-body text-[#64748B]">Over/Under</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* RIGHT: Hydration, Supplements, Coach Tips */}
        <div className="lg:col-span-4 space-y-4">
          {/* Hydration */}
          <motion.div
            custom={3}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Hydration</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">💧</span>
                <div className="text-right">
                  <span className="font-display font-extrabold text-2xl text-[#2E6AB0]">{dailyTargets.water.current}L</span>
                  <span className="text-[#64748B] text-sm font-body"> / {dailyTargets.water.goal}L</span>
                </div>
              </div>
              <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2E6AB0] rounded-full"
                  style={{ width: `${(dailyTargets.water.current / dailyTargets.water.goal) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-4">
                {[0.5, 0.5, 0.5, 0.5, 0.5, 0.5].map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-10 rounded-md border-2 flex items-center justify-center text-xs ${
                      i < Math.floor(dailyTargets.water.current / 0.5)
                        ? 'border-[#2E6AB0] bg-[#2E6AB0]/10 text-[#2E6AB0]'
                        : 'border-[#E5E7EB] text-[#E5E7EB]'
                    }`}
                  >
                    💧
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Supplements */}
          <motion.div
            custom={4}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Supplements</h2>
            </div>
            <div className="p-5 space-y-3">
              {supplements.map((sup) => (
                <div key={sup.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                      sup.taken ? 'bg-emerald-500' : 'border-2 border-[#1B2D50]/15'
                    }`}>
                      {sup.taken && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[#1B2D50] text-sm font-body font-medium">{sup.name}</span>
                  </div>
                  <span className="text-[#64748B] text-xs font-body">{sup.timing}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Fiber Tracker */}
          <motion.div
            custom={5}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Fiber Intake</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#1B2D50] font-display font-bold text-lg">{dailyTargets.fiber.current}g</span>
                <span className="text-[#64748B] text-xs font-body">Goal: {dailyTargets.fiber.goal}g</span>
              </div>
              <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(dailyTargets.fiber.current / dailyTargets.fiber.goal) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>

          {/* Coach Nutrition Tip */}
          <motion.div
            custom={6}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Nutrition Tip</h2>
            </div>
            <div className="p-5">
              <div className="p-3 rounded-lg bg-[#F08B1E]/[0.04] border border-[#F08B1E]/10">
                <p className="text-[#1B2D50] text-sm font-body leading-relaxed">
                  &ldquo;Try to get 30-40g of protein within 30 minutes post-workout. Your shake + a banana is a solid combo.&rdquo;
                </p>
                <p className="text-[#64748B] text-xs font-body mt-2">— Anthony</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
