'use client'

import { motion } from 'framer-motion'

/* ── Stat cards ── */
const stats = [
  {
    label: 'Workouts This Week',
    value: '4',
    sub: '/ 5 Completed',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
    iconBg: 'bg-[#3B82F6]/10',
    iconColor: 'text-[#3B82F6]',
  },
  {
    label: 'Calories Burned',
    value: '2,350',
    sub: 'kcal',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 23c-4.97 0-9-3.58-9-8 0-5.5 9-13 9-13s9 7.5 9 13c0 4.42-4.03 8-9 8zm0-18.58C9.12 7.38 5 12.13 5 15c0 3.31 3.13 6 7 6s7-2.69 7-6c0-2.87-4.12-7.62-7-10.58z" />
      </svg>
    ),
    iconBg: 'bg-[#F08B1E]/10',
    iconColor: 'text-[#F08B1E]',
  },
  {
    label: 'Weight Progress',
    value: '180',
    sub: 'lbs',
    change: '-2 lbs',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    iconBg: 'bg-[#3B82F6]/10',
    iconColor: 'text-[#3B82F6]',
  },
  {
    label: 'Steps Today',
    value: '8,750',
    sub: 'Steps',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
      </svg>
    ),
    iconBg: 'bg-[#F08B1E]/10',
    iconColor: 'text-[#F08B1E]',
  },
]

/* ── Today's Workout ── */
const todayWorkout = {
  title: 'Upper Body Strength',
  exercises: [
    { name: 'Bench Press', sets: 3, reps: 8, weight: '120 lbs' },
    { name: 'Lat Pulldown', sets: 3, reps: 10, weight: '140 lbs' },
    { name: 'Bicep Curls', sets: 3, reps: 12, weight: '35 lbs' },
  ],
}

/* ── Upcoming Schedule ── */
const upcomingSchedule = [
  { name: 'Leg Day', when: 'Tomorrow', icon: '🏋️' },
  { name: 'Rest Day', when: 'Friday', sub: 'Recovery Day', icon: '😴' },
]

/* ── Progress Chart Data (SVG line) ── */
const weightData = [
  { month: 'Jan', value: 200 },
  { month: 'Feb', value: 195 },
  { month: 'Mar', value: 190 },
  { month: 'Apr', value: 185 },
  { month: 'May', value: 180 },
]

/* ── Daily Habits ── */
const dailyHabits = [
  { text: 'Drink 3L of Water', done: true },
  { text: 'Get 7+ Hours Sleep', done: true },
  { text: 'Stretch & Mobility', done: true },
]

/* ── Macros ── */
const macros = [
  { name: 'Protein', current: 150, goal: 180, color: '#3B82F6' },
  { name: 'Carbs', current: 220, goal: 250, color: '#F08B1E' },
  { name: 'Fats', current: 60, goal: 70, color: '#64748B' },
]

/* ── Community ── */
const forumPosts = [
  { title: 'Tips for Meal Prepping', time: '15 min ago', icon: '✅' },
  { title: 'Motivation Monday', time: '1 hour ago', icon: '🏆' },
]

const spotlight = { name: 'Sarah W.', achievement: 'Lost 25 lbs!' }

/* ── Helpers ── */
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

function MacroRing({ current, goal, color, size = 72 }: { current: number; goal: number; color: string; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(current / goal, 1)
  const offset = circumference * (1 - pct)

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  )
}

export default function ClientDashboard() {
  /* Progress chart scaling */
  const chartW = 380
  const chartH = 180
  const minVal = 170
  const maxVal = 205
  const padX = 40
  const padY = 20
  const points = weightData.map((d, i) => {
    const x = padX + (i / (weightData.length - 1)) * (chartW - padX * 2)
    const y = padY + ((maxVal - d.value) / (maxVal - minVal)) * (chartH - padY * 2)
    return { x, y, ...d }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div>
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
                {stat.change && (
                  <span className="text-emerald-400 text-xs font-body font-medium ml-1">
                    <span className="inline-block transform scale-y-[-1]">&#9660;</span> {stat.change}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-3 space-y-4">
          {/* Today's Workout */}
          <motion.div
            custom={4}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">Today&apos;s Workout</h2>
              <div className="flex items-center gap-1.5 text-white/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="font-display font-bold text-white text-sm">{todayWorkout.title}</span>
              </div>

              <div className="space-y-4 mb-5">
                {todayWorkout.exercises.map((ex) => (
                  <div key={ex.name}>
                    <p className="font-body font-semibold text-white text-sm">{ex.name}</p>
                    <p className="text-white/40 text-xs font-body">
                      {ex.sets} Sets x {ex.reps} Reps &middot; {ex.weight}
                    </p>
                  </div>
                ))}
              </div>

              <button className="w-full py-3 bg-[#3B82F6] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-[#2563EB] active:scale-[0.98] transition-transform duration-200">
                Start Workout
              </button>
            </div>
          </motion.div>

          {/* Upcoming Schedule */}
          <motion.div
            custom={5}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]"
          >
            <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">Upcoming Schedule</h2>
              <div className="flex items-center gap-1.5 text-white/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {upcomingSchedule.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="font-body font-semibold text-white text-sm">{item.name}</p>
                    <p className="text-white/40 text-xs font-body">
                      {item.when}{item.sub ? ` | ${item.sub}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CENTER COLUMN */}
        <div className="lg:col-span-5 space-y-4">
          {/* Progress Chart */}
          <motion.div
            custom={6}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]"
          >
            <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">Progress Chart</h2>
              <div className="flex items-center gap-1.5 text-white/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            <div className="p-5">
              <p className="text-white/40 text-xs font-body mb-3">Wt</p>
              <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  {[200, 195, 190, 185, 180].map((val) => {
                    const y = padY + ((maxVal - val) / (maxVal - minVal)) * (chartH - padY * 2)
                    return (
                      <g key={val}>
                        <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                        <text x={padX - 8} y={y + 4} textAnchor="end" className="text-[10px]" fill="rgba(255,255,255,0.3)" fontSize={10}>
                          {val}
                        </text>
                      </g>
                    )
                  })}

                  {/* Line */}
                  <path d={pathD} fill="none" stroke="#F08B1E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

                  {/* Points + labels */}
                  {points.map((p) => (
                    <g key={p.month}>
                      <circle cx={p.x} cy={p.y} r={4} fill="#F08B1E" />
                      <circle cx={p.x} cy={p.y} r={6} fill="none" stroke="#F08B1E" strokeWidth={1} opacity={0.3} />
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fill="white" fontWeight="700" fontSize={12}>
                        {p.value}
                      </text>
                      <text x={p.x} y={chartH + 20} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10}>
                        {p.month}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Daily Checklist */}
          <motion.div
            custom={7}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]"
          >
            <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">Daily Checklist</h2>
              <div className="flex items-center gap-1.5 text-white/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {dailyHabits.map((habit) => (
                <div key={habit.text} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    habit.done ? 'bg-emerald-500' : 'border-2 border-white/15'
                  }`}>
                    {habit.done && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-white text-sm font-body font-medium">{habit.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 space-y-4">
          {/* Nutrition Summary */}
          <motion.div
            custom={8}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]"
          >
            <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">Nutrition Summary</h2>
              <div className="flex items-center gap-1.5 text-white/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            <div className="p-5">
              {/* Calorie bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-[#3B82F6] text-white text-[10px] font-display font-bold px-2 py-0.5 rounded">MIN</span>
                  <span className="text-white text-sm font-body font-semibold">1,750 / 2,000 kcal</span>
                </div>
                <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: '87.5%' }} />
                </div>
              </div>

              {/* Macro rings */}
              <div className="flex items-center justify-around">
                {macros.map((macro) => (
                  <div key={macro.name} className="flex flex-col items-center">
                    <div className="relative">
                      <MacroRing current={macro.current} goal={macro.goal} color={macro.color} size={72} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display font-bold text-white text-sm">{macro.current} g</span>
                      </div>
                    </div>
                    <span className="font-body font-semibold text-white text-xs mt-2">{macro.name}</span>
                    <span className="text-white/40 text-[10px] font-body">Goal {macro.goal}g</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* AJM Fit Community */}
          <motion.div
            custom={9}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]"
          >
            <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">AJM Fit Community</h2>
              <div className="flex items-center gap-1.5 text-white/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            <div className="p-5">
              <p className="font-body font-semibold text-white text-xs uppercase tracking-wide mb-3">New Forum Posts</p>
              <div className="space-y-3 mb-5">
                {forumPosts.map((post) => (
                  <div key={post.title} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{post.icon}</span>
                      <span className="text-[#3B82F6] text-sm font-body font-medium">{post.title}</span>
                    </div>
                    <span className="text-white/40 text-xs font-body">{post.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Member Spotlight */}
          <motion.div
            custom={10}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]"
          >
            <div className="px-5 py-4 border-b border-white/[0.10]">
              <h2 className="font-display font-bold text-sm text-white">Member Spotlight</h2>
            </div>
            <div className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F08B1E] to-[#e07810] flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-display font-bold">SW</span>
              </div>
              <div>
                <p className="font-body font-semibold text-white text-sm">{spotlight.name}</p>
                <p className="text-white/50 text-sm font-body">{spotlight.achievement} 💪</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
