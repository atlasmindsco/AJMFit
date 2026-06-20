'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import MacroRing from '@/components/ui/MacroRing'
import { fadeIn } from '@/lib/animations'
import { getCurrentUserId } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'
import {
  fetchTargets,
  fetchTodaysLogs,
  fetchDailyLog,
  fetchWeeklyCalories,
  sumTotals,
  type MacroTargets,
  type NutritionTotals,
} from '@/lib/nutrition'
import { fetchPRs, fetchWorkoutsThisWeek, type PRRow } from '@/lib/workout'

const CheckIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
)
const FlameIcon = (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 23c-4.97 0-9-3.58-9-8 0-5.5 9-13 9-13s9 7.5 9 13c0 4.42-4.03 8-9 8zm0-18.58C9.12 7.38 5 12.13 5 15c0 3.31 3.13 6 7 6s7-2.69 7-6c0-2.87-4.12-7.62-7-10.58z" />
  </svg>
)
const BoltIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
)
const DropIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a8.25 8.25 0 0 0 5.834-14.084L12 2.25 6.166 6.916A8.25 8.25 0 0 0 12 21Z" />
  </svg>
)

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

const cardHeader =
  'px-5 py-4 border-b border-white/[0.10] flex items-center justify-between'

export default function ClientDashboard() {
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(true)
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0)
  const [totals, setTotals] = useState<NutritionTotals>({ calories: 0, protein: 0, carbs: 0, fats: 0 })
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2000, protein: 180, carbs: 250, fats: 70 })
  const [waterOz, setWaterOz] = useState(0)
  const [weekCals, setWeekCals] = useState<Array<{ date: string; calories: number }>>([])
  const [prs, setPrs] = useState<PRRow[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!id) {
        if (active) setLoading(false)
        return
      }
      try {
        const [t, logs, dl, week, workouts, prRows] = await Promise.all([
          fetchTargets(id),
          fetchTodaysLogs(id),
          fetchDailyLog(id),
          fetchWeeklyCalories(id),
          fetchWorkoutsThisWeek(id),
          fetchPRs(id),
        ])
        if (!active) return
        setTargets(t)
        setTotals(sumTotals(logs))
        setWaterOz(dl.water_oz)
        setWeekCals(week)
        setWorkoutsThisWeek(workouts)
        setPrs(prRows)
      } catch (err) {
        console.error('[Dashboard] Failed to load:', err)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !active) return
      const { data: u } = await supabase
        .from('users')
        .select('name')
        .eq('auth_id', data.user.id)
        .maybeSingle<{ name: string | null }>()
      if (active && u?.name) setFirstName(u.name.trim().split(/\s+/)[0])
    })
    return () => {
      active = false
    }
  }, [])

  const val = (v: string | number) => (loading ? '—' : v)
  const caloriesMax = Math.max(targets.calories, ...weekCals.map((d) => d.calories), 1)
  const recentPRs = [...prs].sort((a, b) => +new Date(b.set_at) - +new Date(a.set_at)).slice(0, 5)

  const stats = [
    {
      label: 'Workouts This Week',
      value: val(workoutsThisWeek),
      sub: 'logged',
      icon: CheckIcon,
      iconBg: 'bg-[#1A7BFF]/10',
      iconColor: 'text-[#1A7BFF]',
    },
    {
      label: 'Calories Today',
      value: val(totals.calories.toLocaleString()),
      sub: `/ ${targets.calories.toLocaleString()}`,
      icon: FlameIcon,
      iconBg: 'bg-[#F76B16]/10',
      iconColor: 'text-[#F76B16]',
    },
    {
      label: 'Protein Today',
      value: val(Math.round(totals.protein)),
      sub: `/ ${targets.protein}g`,
      icon: BoltIcon,
      iconBg: 'bg-[#1A7BFF]/10',
      iconColor: 'text-[#1A7BFF]',
    },
    {
      label: 'Water Today',
      value: val(waterOz),
      sub: 'oz',
      icon: DropIcon,
      iconBg: 'bg-[#1A7BFF]/10',
      iconColor: 'text-[#1A7BFF]',
    },
  ]

  const macroRings = [
    { name: 'Protein', current: Math.round(totals.protein), goal: targets.protein, color: '#1A7BFF' },
    { name: 'Carbs', current: Math.round(totals.carbs), goal: targets.carbs, color: '#F76B16' },
    { name: 'Fats', current: Math.round(totals.fats), goal: targets.fats, color: '#64748B' },
  ]
  const caloriePct = targets.calories > 0 ? Math.min((totals.calories / targets.calories) * 100, 100) : 0

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-white/40 text-sm font-body mt-1">Here&rsquo;s your training snapshot.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-5 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl ${stat.iconBg} flex items-center justify-center shrink-0 ${stat.iconColor}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-white/40 text-[11px] font-body uppercase tracking-wide">{stat.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-extrabold text-2xl text-white tracking-tight">{stat.value}</span>
                <span className="text-white/40 text-xs font-body">{stat.sub}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: chart + PRs */}
        <div className="lg:col-span-8 space-y-4">
          {/* Calories This Week */}
          <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className={cardHeader}>
              <h2 className="font-display font-bold text-sm text-white">Calories This Week</h2>
              <span className="text-white/30 text-xs font-body">target {targets.calories.toLocaleString()}</span>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="h-44 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex items-end justify-between gap-2 sm:gap-3 h-44">
                  {weekCals.map((d) => {
                    const h = caloriesMax > 0 ? (d.calories / caloriesMax) * 100 : 0
                    const onTarget = d.calories > 0 && d.calories <= targets.calories
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                        <span className="text-white/50 text-[10px] font-body">{d.calories > 0 ? d.calories.toLocaleString() : ''}</span>
                        <div className="w-full bg-white/[0.04] rounded-md flex items-end h-full">
                          <div
                            className={`w-full rounded-md ${onTarget ? 'bg-[#1A7BFF]' : 'bg-[#F76B16]'}`}
                            style={{ height: `${Math.max(h, d.calories > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="text-white/40 text-[10px] font-body">{dayLabel(d.date)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent PRs */}
          <motion.div custom={5} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className={cardHeader}>
              <h2 className="font-display font-bold text-sm text-white">Recent PRs</h2>
              <Link href="/studio/programs" className="text-[#1A7BFF] text-xs font-body hover:underline">
                Train →
              </Link>
            </div>
            <div className="p-5">
              {loading ? (
                <p className="text-white/30 text-sm font-body">Loading…</p>
              ) : recentPRs.length === 0 ? (
                <p className="text-white/40 text-sm font-body">
                  No personal records yet. Log a workout to set your first PR.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentPRs.map((pr) => (
                    <div key={pr.exercise_name + pr.set_at} className="flex items-center justify-between">
                      <div>
                        <p className="font-body font-semibold text-white text-sm">{pr.exercise_name}</p>
                        <p className="text-white/40 text-xs font-body">
                          {new Date(pr.set_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {pr.previous_weight ? ` · prev ${Number(pr.previous_weight)} lbs` : ''}
                        </p>
                      </div>
                      <span className="font-display font-extrabold text-white text-sm">
                        {Number(pr.weight)} lbs <span className="text-white/40 text-xs font-body">× {pr.reps}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT: nutrition + today's workout */}
        <div className="lg:col-span-4 space-y-4">
          {/* Nutrition Today */}
          <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className={cardHeader}>
              <h2 className="font-display font-bold text-sm text-white">Nutrition Today</h2>
              <Link href="/studio/nutrition" className="text-[#1A7BFF] text-xs font-body hover:underline">
                Log →
              </Link>
            </div>
            <div className="p-5">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/50 text-xs font-body uppercase tracking-wide">Calories</span>
                  <span className="text-white text-sm font-body font-semibold">
                    {val(totals.calories.toLocaleString())} / {targets.calories.toLocaleString()} kcal
                  </span>
                </div>
                <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1A7BFF] rounded-full transition-[width] duration-500" style={{ width: `${loading ? 0 : caloriePct}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-around">
                {macroRings.map((macro) => (
                  <div key={macro.name} className="flex flex-col items-center">
                    <div className="relative">
                      <MacroRing current={macro.current} goal={macro.goal} color={macro.color} size={72} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display font-bold text-white text-sm">{loading ? '—' : `${macro.current}g`}</span>
                      </div>
                    </div>
                    <span className="font-body font-semibold text-white text-xs mt-2">{macro.name}</span>
                    <span className="text-white/40 text-[10px] font-body">Goal {macro.goal}g</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Today's Workout CTA */}
          <motion.div custom={7} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-5">
            <h2 className="font-display font-bold text-sm text-white">Today&rsquo;s Training</h2>
            <p className="text-white/50 text-sm font-body mt-1 mb-4">
              Your program is ready — jump in and log today&rsquo;s session.
            </p>
            <Link
              href="/studio/programs"
              className="block w-full text-center py-3 bg-[#1A7BFF] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-[#0F5FE0] active:scale-[0.98] transition-transform duration-200"
            >
              Go to Programs
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
