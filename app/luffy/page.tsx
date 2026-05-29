'use client'

import { motion } from 'framer-motion'
import { fadeInAdmin as fadeIn } from '@/lib/animations'

const stats = [
  {
    label: 'Active Clients',
    value: '12',
    change: '+2 this month',
    up: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    label: 'Sessions This Week',
    value: '18',
    change: '3 remaining',
    up: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    label: 'Revenue (MTD)',
    value: '$5,364',
    change: '+12% vs last month',
    up: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: 'Avg. Compliance',
    value: '87%',
    change: '-2% vs last week',
    up: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
]

const recentClients = [
  { name: 'Marcus Johnson', tier: 'The Full Experience', status: 'active', compliance: 94, nextSession: 'Today, 5:00 PM' },
  { name: 'Sarah Kim', tier: 'The Accelerator', status: 'active', compliance: 88, nextSession: 'Tomorrow, 9:00 AM' },
  { name: 'David Reeves', tier: 'The Blueprint', status: 'active', compliance: 72, nextSession: 'N/A' },
  { name: 'Tanya Bell', tier: 'The Accelerator', status: 'active', compliance: 91, nextSession: 'Thu, 6:30 PM' },
  { name: 'Chris Okafor', tier: 'The Full Experience', status: 'paused', compliance: 65, nextSession: '--' },
]

const upcomingSessions = [
  { client: 'Marcus Johnson', type: 'Live Training', time: 'Today, 5:00 PM', duration: '45 min' },
  { client: 'Sarah Kim', type: 'Video Check-in', time: 'Tomorrow, 9:00 AM', duration: '30 min' },
  { client: 'Tanya Bell', type: 'Live Training', time: 'Thu, 6:30 PM', duration: '45 min' },
]

const pendingActions = [
  { text: 'Review form video from David Reeves', type: 'Form Review', urgent: false },
  { text: 'Send Phase 2 program to Sarah Kim', type: 'Program', urgent: true },
  { text: 'Follow up with Chris Okafor (paused 14 days)', type: 'Outreach', urgent: true },
  { text: 'New application: Jordan West', type: 'Application', urgent: false },
]


function getTierColor(tier: string) {
  if (tier.includes('Full')) return 'text-[#F76B16]'
  if (tier.includes('Accelerator')) return 'text-[#1A7BFF]'
  return 'text-white/50'
}

function getComplianceColor(val: number) {
  if (val >= 85) return 'bg-emerald-500/20 text-emerald-400'
  if (val >= 70) return 'bg-amber-500/20 text-amber-400'
  return 'bg-red-500/20 text-red-400'
}

export default function AdminDashboard() {
  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-10">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-white"
        >
          Dashboard
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-white/40 font-body text-sm mt-2"
        >
          Thursday, March 6, 2026
        </motion.p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 text-[#F76B16]">
              {stat.icon}
            </div>
            <div>
              <p className="text-white/40 text-[11px] font-display uppercase tracking-[0.15em]">
                {stat.label}
              </p>
              <p className="font-display font-extrabold text-2xl text-white tracking-tight">
                {stat.value}
              </p>
              <p className={`text-xs font-body mt-0.5 ${stat.up ? 'text-emerald-400' : 'text-amber-400'}`}>
                {stat.change}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Client List */}
        <motion.div
          custom={4}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="xl:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">
              Clients
            </h2>
            <span className="text-xs text-white/30 font-body">{recentClients.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] font-display uppercase tracking-[0.2em] text-white/25 border-b border-white/[0.04]">
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Tier</th>
                  <th className="px-6 py-3 font-semibold">Compliance</th>
                  <th className="px-6 py-3 font-semibold">Next Session</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentClients.map((client) => (
                  <tr
                    key={client.name}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <span className="text-white text-sm font-body font-medium">{client.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-body ${getTierColor(client.tier)}`}>
                        {client.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block text-xs font-body font-semibold px-2.5 py-1 rounded-md ${getComplianceColor(client.compliance)}`}>
                        {client.compliance}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white/40 text-xs font-body">{client.nextSession}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block text-[10px] font-display uppercase tracking-[0.15em] font-semibold px-2.5 py-1 rounded-md ${
                        client.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-white/[0.06] text-white/30'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          <motion.div
            custom={5}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl"
          >
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">
                Upcoming Sessions
              </h2>
            </div>
            <div className="p-4 space-y-2">
              {upcomingSessions.map((session) => (
                <div
                  key={`${session.client}-${session.time}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors duration-150"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#F76B16]/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#F76B16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-body font-medium truncate">{session.client}</p>
                    <p className="text-white/30 text-xs font-body">{session.type} &middot; {session.duration}</p>
                  </div>
                  <span className="text-white/30 text-[11px] font-body shrink-0">{session.time}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Action Items */}
          <motion.div
            custom={6}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl"
          >
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">
                Action Items
              </h2>
            </div>
            <div className="p-4 space-y-2">
              {pendingActions.map((action) => (
                <div
                  key={action.text}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors duration-150"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${action.urgent ? 'bg-[#F76B16]' : 'bg-white/20'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-sm font-body leading-snug">{action.text}</p>
                    <span className="text-[10px] font-display uppercase tracking-[0.15em] text-white/20 mt-1 inline-block">
                      {action.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
