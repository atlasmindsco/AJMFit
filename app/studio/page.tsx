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
import { fetchMyProgram, type Program } from '@/lib/programs'
import { fetchMySessions, fetchMyTier, type Session } from '@/lib/scheduling'
import { fetchMyOnboarding } from '@/lib/onboarding'

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
  const [myProgram, setMyProgram] = useState<Program | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [tier, setTier] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!id) {
        if (active) setLoading(false)
        return
      }
      try {
        const [t, logs, dl, week, workouts, prRows, program, mySessions, onboarding, myTier] = await Promise.all([
          fetchTargets(id),
          fetchTodaysLogs(id),
          fetchDailyLog(id),
          fetchWeeklyCalories(id),
          fetchWorkoutsThisWeek(id),
          fetchPRs(id),
          fetchMyProgram(id),
          fetchMySessions(id),
          fetchMyOnboarding(id),
          fetchMyTier(id),
        ])
        if (!active) return
        setTargets(t)
        setTotals(sumTotals(logs))
        setWaterOz(dl.water_oz)
        setWeekCals(week)
        setWorkoutsThisWeek(workouts)
        setPrs(prRows)
        setMyProgram(program)
        setSessions(mySessions)
        setNeedsOnboarding(!onboarding)
        setTier(myTier)
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

  const val = (v: string | number) => (loading ? ', ' : v)
  const caloriesMax = Math.max(targets.calories, ...weekCals.map((d) => d.calories), 1)
  const recentPRs = [...prs].sort((a, b) => +new Date(b.set_at) - +new Date(a.set_at)).slice(0, 5)
  const upcomingSessions = [...sessions]
    .filter((s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() > Date.now())
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
    .slice(0, 3)

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

      {/* Blueprint is self-serve: no onboarding form, no call. Point them
          straight at the program picker until they've chosen one. */}
      {!loading && tier === 'blueprint' && !myProgram && (
        <Link
          href="/studio/programs"
          className="group flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-xl bg-[#1A7BFF]/10 border border-[#1A7BFF]/25 hover:bg-[#1A7BFF]/15 transition-colors duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#1A7BFF]/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#1A7BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white">Pick your training program</p>
              <p className="text-white/45 text-xs font-body mt-0.5">Choose your goal, days per week, and gym or home. Your program is ready in seconds.</p>
            </div>
          </div>
          <span className="shrink-0 text-[#1A7BFF] font-display font-bold text-xs uppercase tracking-[0.12em] group-hover:translate-x-0.5 transition-transform">
            Choose →
          </span>
        </Link>
      )}

      {/* Onboarding nudge (coaching tiers only): shown until the pre-call form
          is filled. Blueprint skips onboarding entirely. */}
      {!loading && needsOnboarding && tier !== 'blueprint' && (
        <Link
          href="/studio/onboarding"
          className="group flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-xl bg-[#F76B16]/10 border border-[#F76B16]/25 hover:bg-[#F76B16]/15 transition-colors duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#F76B16]/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white">Fill out your onboarding form</p>
              <p className="text-white/45 text-xs font-body mt-0.5">Coach Anthony uses it to build your plan and prep your onboarding call. About 3 minutes.</p>
            </div>
          </div>
          <span className="shrink-0 text-[#F76B16] font-display font-bold text-xs uppercase tracking-[0.12em] group-hover:translate-x-0.5 transition-transform">
            Start →
          </span>
        </Link>
      )}

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
          {/* Upcoming Sessions */}
          <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className={cardHeader}>
              <h2 className="font-display font-bold text-sm text-white">Upcoming Sessions</h2>
            </div>
            <div className="p-5">
              {loading ? (
                <p className="text-white/30 text-sm font-body">Loading…</p>
              ) : upcomingSessions.length === 0 ? (
                <p className="text-white/40 text-sm font-body">
                  No sessions scheduled. Coach Anthony will book your next call.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {upcomingSessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F76B16]/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-body font-medium truncate">{s.type || 'Session'}</p>
                        <p className="text-white/40 text-[11px] font-body mt-0.5">
                          {new Date(s.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {s.duration_min} min
                        </p>
                      </div>
                      {s.join_url && (
                        <a href={s.join_url} target="_blank" rel="noopener noreferrer" className="shrink-0 px-3 py-1.5 rounded-md bg-[#F76B16] text-white text-[11px] font-display font-bold uppercase tracking-wide hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200">
                          Join
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Nutrition Today */}
          <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className={cardHeader}>
              <h2 className="font-display font-bold text-sm text-white">Nutrition Today</h2>
              <div className="flex items-center gap-2">
                <Link href="/studio/setup-nutrition" className="text-[#1A7BFF] text-xs font-body hover:underline">
                  Macros →
                </Link>
                <span className="text-white/20">·</span>
                <Link href="/studio/nutrition" className="text-[#1A7BFF] text-xs font-body hover:underline">
                  Log →
                </Link>
              </div>
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
                        <span className="font-display font-bold text-white text-sm">{loading ? ', ' : `${macro.current}g`}</span>
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
            {loading ? (
              <p className="text-white/30 text-sm font-body mt-1 mb-4">Loading…</p>
            ) : myProgram ? (
              <>
                <p className="font-display font-extrabold text-lg text-white mt-2 leading-tight">{myProgram.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                  {myProgram.split && (
                    <span className="px-2 py-0.5 rounded-md bg-[#1A7BFF]/10 text-[#1A7BFF] text-[11px] font-body font-semibold">{myProgram.split}</span>
                  )}
                  {myProgram.days_per_week != null && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/60 text-[11px] font-body font-semibold">{myProgram.days_per_week}× / week</span>
                  )}
                  {myProgram.level && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/60 text-[11px] font-body font-semibold capitalize">{myProgram.level}</span>
                  )}
                </div>
                {myProgram.description && (
                  <p className="text-white/50 text-sm font-body mb-4 line-clamp-2">{myProgram.description}</p>
                )}
                <Link
                  href="/studio/programs"
                  className="block w-full text-center py-3 bg-[#1A7BFF] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-[#0F5FE0] active:scale-[0.98] transition-transform duration-200"
                >
                  Start Training
                </Link>
              </>
            ) : tier === 'blueprint' ? (
              <>
                <p className="text-white/50 text-sm font-body mt-1 mb-4">
                  Pick your program: goal, days per week, gym or home. Ready in seconds.
                </p>
                <Link
                  href="/studio/programs"
                  className="block w-full text-center py-3 bg-[#1A7BFF] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-[#0F5FE0] active:scale-[0.98] transition-transform duration-200"
                >
                  Pick Your Program
                </Link>
              </>
            ) : (
              <>
                <p className="text-white/50 text-sm font-body mt-1 mb-4">
                  Coach Anthony hasn&rsquo;t assigned your program yet. Browse the exercise library in the meantime.
                </p>
                <Link
                  href="/studio/programs"
                  className="block w-full text-center py-3 bg-white/[0.06] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-white/[0.10] active:scale-[0.98] transition-transform duration-200"
                >
                  Browse Exercises
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
