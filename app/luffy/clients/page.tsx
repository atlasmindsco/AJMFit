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

const clients = [
  {
    name: 'Marcus Johnson',
    email: 'marcus.j@email.com',
    tier: 'The Full Experience',
    status: 'active',
    compliance: 94,
    startDate: 'Jan 15, 2026',
    weight: { current: 180, start: 210 },
    nextSession: 'Today, 5:00 PM',
    program: 'Muscle Builder — Intermediate',
    phase: 'Phase 2',
    lastCheckin: '2 hours ago',
  },
  {
    name: 'Sarah Kim',
    email: 'sarah.k@email.com',
    tier: 'The Accelerator',
    status: 'active',
    compliance: 88,
    startDate: 'Feb 1, 2026',
    weight: { current: 145, start: 160 },
    nextSession: 'Tomorrow, 9:00 AM',
    program: 'Shred Program — Intermediate',
    phase: 'Phase 3',
    lastCheckin: '1 day ago',
  },
  {
    name: 'David Reeves',
    email: 'david.r@email.com',
    tier: 'The Blueprint',
    status: 'active',
    compliance: 72,
    startDate: 'Feb 20, 2026',
    weight: { current: 195, start: 200 },
    nextSession: 'N/A',
    program: 'Muscle Builder — Beginner',
    phase: 'Phase 1',
    lastCheckin: '3 days ago',
  },
  {
    name: 'Tanya Bell',
    email: 'tanya.b@email.com',
    tier: 'The Accelerator',
    status: 'active',
    compliance: 91,
    startDate: 'Dec 10, 2025',
    weight: { current: 135, start: 155 },
    nextSession: 'Thu, 6:30 PM',
    program: 'Muscle Builder — Intermediate',
    phase: 'Phase 2',
    lastCheckin: '5 hours ago',
  },
  {
    name: 'Chris Okafor',
    email: 'chris.o@email.com',
    tier: 'The Full Experience',
    status: 'paused',
    compliance: 65,
    startDate: 'Nov 5, 2025',
    weight: { current: 220, start: 240 },
    nextSession: '--',
    program: 'Shred Program — Intermediate',
    phase: 'Phase 2 (Paused)',
    lastCheckin: '14 days ago',
  },
  {
    name: 'Jasmine Torres',
    email: 'jasmine.t@email.com',
    tier: 'The Full Experience',
    status: 'active',
    compliance: 96,
    startDate: 'Jan 3, 2026',
    weight: { current: 128, start: 140 },
    nextSession: 'Fri, 8:00 AM',
    program: 'Strength Builder — Intermediate',
    phase: 'Phase 3',
    lastCheckin: '6 hours ago',
  },
  {
    name: 'Andre Williams',
    email: 'andre.w@email.com',
    tier: 'The Blueprint',
    status: 'active',
    compliance: 78,
    startDate: 'Mar 1, 2026',
    weight: { current: 205, start: 205 },
    nextSession: 'Sat, 10:00 AM',
    program: 'Strength Builder — Beginner',
    phase: 'Phase 1',
    lastCheckin: '1 day ago',
  },
  {
    name: 'Mia Chen',
    email: 'mia.c@email.com',
    tier: 'The Accelerator',
    status: 'active',
    compliance: 85,
    startDate: 'Feb 14, 2026',
    weight: { current: 118, start: 125 },
    nextSession: 'Wed, 6:00 PM',
    program: 'Shred Program — Beginner',
    phase: 'Phase 2',
    lastCheckin: '12 hours ago',
  },
]

function getTierColor(tier: string) {
  if (tier.includes('Full')) return 'bg-[#F08B1E]/15 text-[#F08B1E]'
  if (tier.includes('Accelerator')) return 'bg-[#2E6AB0]/15 text-[#2E6AB0]'
  return 'bg-white/[0.06] text-white/50'
}

function getComplianceColor(val: number) {
  if (val >= 85) return 'text-emerald-400'
  if (val >= 70) return 'text-amber-400'
  return 'text-red-400'
}

function getComplianceBg(val: number) {
  if (val >= 85) return 'bg-emerald-500'
  if (val >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

type FilterType = 'all' | 'active' | 'paused'

export default function ClientsPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedClient, setSelectedClient] = useState<number | null>(null)

  const filtered = filter === 'all' ? clients : clients.filter(c => c.status === filter)
  const activeCount = clients.filter(c => c.status === 'active').length
  const pausedCount = clients.filter(c => c.status === 'paused').length

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-extrabold text-3xl uppercase tracking-tight text-white"
          >
            Clients
          </motion.h1>
          <p className="text-white/40 font-body text-sm mt-1">
            {activeCount} active &middot; {pausedCount} paused
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'paused'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
                filter === f
                  ? 'bg-[#F08B1E] text-white'
                  : 'bg-white/[0.04] text-white/40 hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Client Cards */}
        <div className="lg:col-span-8 space-y-3">
          {filtered.map((client, i) => (
            <motion.div
              key={client.name}
              custom={i}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              onClick={() => setSelectedClient(selectedClient === i ? null : i)}
              className={`bg-white/[0.03] border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                selectedClient === i
                  ? 'border-[#F08B1E]/30 bg-white/[0.05]'
                  : 'border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    client.status === 'active'
                      ? 'bg-gradient-to-br from-[#F08B1E] to-[#e07810]'
                      : 'bg-white/[0.06]'
                  }`}>
                    <span className={`text-xs font-display font-bold ${
                      client.status === 'active' ? 'text-white' : 'text-white/40'
                    }`}>
                      {client.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-body font-semibold">{client.name}</p>
                      {client.status === 'paused' && (
                        <span className="text-[9px] font-display uppercase tracking-wide bg-white/[0.06] text-white/30 px-2 py-0.5 rounded">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded ${getTierColor(client.tier)}`}>
                        {client.tier}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div className="hidden sm:block">
                    <p className="text-white/30 text-[10px] font-display uppercase tracking-wide">Compliance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getComplianceBg(client.compliance)}`} style={{ width: `${client.compliance}%` }} />
                      </div>
                      <span className={`text-sm font-display font-bold ${getComplianceColor(client.compliance)}`}>
                        {client.compliance}%
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-white/30 text-[10px] font-display uppercase tracking-wide">Next Session</p>
                    <p className="text-white/60 text-xs font-body mt-1">{client.nextSession}</p>
                  </div>
                  <svg className={`w-4 h-4 text-white/20 transition-transform duration-200 ${selectedClient === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedClient === i && (
                <div className="mt-5 pt-5 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Program</p>
                    <p className="text-white/70 text-sm font-body mt-1">{client.program}</p>
                    <p className="text-white/30 text-xs font-body">{client.phase}</p>
                  </div>
                  <div>
                    <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Weight</p>
                    <p className="text-white/70 text-sm font-body mt-1">{client.weight.current} lbs</p>
                    <p className="text-emerald-400 text-xs font-body">
                      {client.weight.current - client.weight.start} lbs from start
                    </p>
                  </div>
                  <div>
                    <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Start Date</p>
                    <p className="text-white/70 text-sm font-body mt-1">{client.startDate}</p>
                  </div>
                  <div>
                    <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Last Check-in</p>
                    <p className="text-white/70 text-sm font-body mt-1">{client.lastCheckin}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tier Breakdown */}
          <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Tier Breakdown</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { tier: 'The Full Experience', count: clients.filter(c => c.tier.includes('Full')).length, color: '#F08B1E', revenue: '$997/mo' },
                { tier: 'The Accelerator', count: clients.filter(c => c.tier.includes('Accelerator')).length, color: '#2E6AB0', revenue: '$497/mo' },
                { tier: 'The Blueprint', count: clients.filter(c => !c.tier.includes('Full') && !c.tier.includes('Accelerator')).length, color: '#64748B', revenue: '$197/mo' },
              ].map((t) => (
                <div key={t.tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
                    <div>
                      <p className="text-white/70 text-sm font-body">{t.tier}</p>
                      <p className="text-white/25 text-xs font-body">{t.revenue} each</p>
                    </div>
                  </div>
                  <span className="font-display font-bold text-white text-lg">{t.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Applications */}
          <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">New Applications</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { name: 'Jordan West', date: 'Mar 25', tier: 'The Accelerator', status: 'pending' },
                { name: 'Lisa Park', date: 'Mar 23', tier: 'The Full Experience', status: 'pending' },
              ].map((app) => (
                <div key={app.name} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div>
                    <p className="text-white text-sm font-body font-medium">{app.name}</p>
                    <p className="text-white/30 text-xs font-body">{app.date} &middot; {app.tier}</p>
                  </div>
                  <button className="px-3 py-1.5 bg-[#F08B1E] text-white text-[10px] font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#e07810] transition-colors duration-200">
                    Review
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* At-Risk Clients */}
          <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">At-Risk</h2>
            </div>
            <div className="p-5 space-y-3">
              {clients.filter(c => c.compliance < 80).map((client) => (
                <div key={client.name} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-white/70 text-sm font-body">{client.name}</p>
                    <p className="text-white/25 text-xs font-body">
                      {client.compliance}% compliance &middot; Last: {client.lastCheckin}
                    </p>
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
