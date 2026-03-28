'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
}

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const weekSchedule: Record<string, { time: string; client: string; type: string; duration: string; tier: string }[]> = {
  Mon: [
    { time: '6:00 AM', client: 'Jasmine Torres', type: 'Live Training', duration: '60 min', tier: 'Full' },
    { time: '9:00 AM', client: 'Mia Chen', type: 'Video Check-in', duration: '30 min', tier: 'Accelerator' },
    { time: '5:00 PM', client: 'Marcus Johnson', type: 'Live Training', duration: '45 min', tier: 'Full' },
    { time: '6:30 PM', client: 'Andre Williams', type: 'Form Review', duration: '15 min', tier: 'Blueprint' },
  ],
  Tue: [
    { time: '7:00 AM', client: 'Tanya Bell', type: 'Live Training', duration: '45 min', tier: 'Accelerator' },
    { time: '12:00 PM', client: 'Sarah Kim', type: 'Video Check-in', duration: '30 min', tier: 'Accelerator' },
    { time: '5:30 PM', client: 'David Reeves', type: 'Form Review', duration: '15 min', tier: 'Blueprint' },
  ],
  Wed: [
    { time: '6:00 AM', client: 'Jasmine Torres', type: 'Live Training', duration: '60 min', tier: 'Full' },
    { time: '10:00 AM', client: 'Community Q&A', type: 'Group Call', duration: '45 min', tier: 'All' },
    { time: '5:00 PM', client: 'Marcus Johnson', type: 'Live Training', duration: '45 min', tier: 'Full' },
  ],
  Thu: [
    { time: '7:00 AM', client: 'Mia Chen', type: 'Live Training', duration: '45 min', tier: 'Accelerator' },
    { time: '9:00 AM', client: 'Sarah Kim', type: 'Live Training', duration: '45 min', tier: 'Accelerator' },
    { time: '6:30 PM', client: 'Tanya Bell', type: 'Live Training', duration: '45 min', tier: 'Accelerator' },
  ],
  Fri: [
    { time: '6:00 AM', client: 'Jasmine Torres', type: 'Live Training', duration: '60 min', tier: 'Full' },
    { time: '8:00 AM', client: 'Andre Williams', type: 'Video Check-in', duration: '30 min', tier: 'Blueprint' },
    { time: '5:00 PM', client: 'Marcus Johnson', type: 'Live Training', duration: '45 min', tier: 'Full' },
  ],
  Sat: [
    { time: '8:00 AM', client: 'David Reeves', type: 'Live Training', duration: '45 min', tier: 'Blueprint' },
    { time: '10:00 AM', client: 'Andre Williams', type: 'Live Training', duration: '45 min', tier: 'Blueprint' },
  ],
  Sun: [],
}

function getTypeIcon(type: string) {
  if (type === 'Live Training') return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
  if (type === 'Video Check-in') return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
  if (type === 'Form Review') return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  )
}

function getTypeColor(type: string) {
  if (type === 'Live Training') return 'bg-[#F08B1E]/15 text-[#F08B1E]'
  if (type === 'Video Check-in') return 'bg-[#2E6AB0]/15 text-[#2E6AB0]'
  if (type === 'Form Review') return 'bg-purple-500/15 text-purple-400'
  return 'bg-emerald-500/15 text-emerald-400'
}

export default function SchedulePage() {
  const [selectedDay, setSelectedDay] = useState('Mon')
  const sessions = weekSchedule[selectedDay]

  // Weekly stats
  const totalSessions = Object.values(weekSchedule).flat().length
  const liveCount = Object.values(weekSchedule).flat().filter(s => s.type === 'Live Training').length
  const checkinCount = Object.values(weekSchedule).flat().filter(s => s.type === 'Video Check-in').length

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display font-extrabold text-3xl uppercase tracking-tight text-white"
        >
          Schedule
        </motion.h1>
        <p className="text-white/40 font-body text-sm mt-1">Week of March 24 – 30, 2026</p>
      </div>

      {/* Week Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sessions', value: totalSessions, color: 'text-[#F08B1E]' },
          { label: 'Live Training', value: liveCount, color: 'text-emerald-400' },
          { label: 'Check-ins', value: checkinCount, color: 'text-[#2E6AB0]' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center"
          >
            <p className={`font-display font-extrabold text-2xl ${stat.color}`}>{stat.value}</p>
            <p className="text-white/30 text-[10px] font-display uppercase tracking-wide mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Day Schedule */}
        <div className="lg:col-span-8">
          {/* Day Tabs */}
          <motion.div custom={3} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="flex border-b border-white/[0.06]">
              {daysOfWeek.map((day) => {
                const count = weekSchedule[day].length
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`flex-1 py-4 text-center border-b-2 transition-all duration-200 ${
                      selectedDay === day
                        ? 'border-[#F08B1E] text-[#F08B1E]'
                        : 'border-transparent text-white/30 hover:text-white/60'
                    }`}
                  >
                    <p className="text-xs font-display font-bold uppercase">{day}</p>
                    <p className="text-[10px] font-body mt-0.5 opacity-50">{count} session{count !== 1 ? 's' : ''}</p>
                  </button>
                )
              })}
            </div>

            <div className="p-5">
              {sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((session, i) => (
                    <div
                      key={`${session.client}-${session.time}`}
                      className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors duration-200"
                    >
                      <div className="w-16 text-center shrink-0">
                        <p className="text-white font-display font-bold text-sm">{session.time.split(' ')[0]}</p>
                        <p className="text-white/30 text-[10px] font-body">{session.time.split(' ')[1]}</p>
                      </div>
                      <div className="w-px h-10 bg-white/[0.06]" />
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getTypeColor(session.type)}`}>
                        {getTypeIcon(session.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-body font-semibold text-sm">{session.client}</p>
                        <p className="text-white/30 text-xs font-body">{session.type} &middot; {session.duration}</p>
                      </div>
                      <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded ${
                        session.tier === 'Full' ? 'bg-[#F08B1E]/15 text-[#F08B1E]' :
                        session.tier === 'Accelerator' ? 'bg-[#2E6AB0]/15 text-[#2E6AB0]' :
                        session.tier === 'All' ? 'bg-emerald-500/15 text-emerald-400' :
                        'bg-white/[0.06] text-white/40'
                      }`}>
                        {session.tier}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-3xl mb-3 block">🏖️</span>
                  <p className="text-white/30 text-sm font-body">No sessions scheduled — rest day</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: Week Overview */}
        <div className="lg:col-span-4 space-y-6">
          {/* Sessions by Day */}
          <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Week Overview</h2>
            </div>
            <div className="p-5 space-y-3">
              {daysOfWeek.map((day) => {
                const count = weekSchedule[day].length
                const maxCount = 5
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className={`text-xs font-display font-bold w-8 ${
                      day === selectedDay ? 'text-[#F08B1E]' : 'text-white/30'
                    }`}>{day}</span>
                    <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${count > 0 ? 'bg-[#F08B1E]' : ''}`}
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 text-xs font-body w-4 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Session Type Breakdown */}
          <motion.div custom={5} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Session Types</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { type: 'Live Training', count: liveCount, color: '#F08B1E' },
                { type: 'Video Check-in', count: checkinCount, color: '#2E6AB0' },
                { type: 'Form Review', count: Object.values(weekSchedule).flat().filter(s => s.type === 'Form Review').length, color: '#A855F7' },
                { type: 'Group Call', count: Object.values(weekSchedule).flat().filter(s => s.type === 'Group Call').length, color: '#10B981' },
              ].map((t) => (
                <div key={t.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
                    <span className="text-white/50 text-sm font-body">{t.type}</span>
                  </div>
                  <span className="text-white font-display font-bold text-sm">{t.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Hours This Week */}
          <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center">
            <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mb-2">Total Hours This Week</p>
            <p className="font-display font-extrabold text-4xl text-[#F08B1E]">14.5</p>
            <p className="text-white/30 text-xs font-body mt-1">across {totalSessions} sessions</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
