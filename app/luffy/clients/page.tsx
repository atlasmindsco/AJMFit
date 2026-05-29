'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  fetchClients,
  acceptApplication,
  declineApplication,
  tierLabel,
  relativeTime,
  type ClientRow,
  type UserStatus,
} from '@/lib/admin'
import { fadeInAdmin as fadeIn } from '@/lib/animations'

function getTierColor(tier: string) {
  if (tier.includes('Full')) return 'bg-[#F76B16]/15 text-[#F76B16]'
  if (tier.includes('Accelerator')) return 'bg-[#1A7BFF]/15 text-[#1A7BFF]'
  return 'bg-white/[0.06] text-white/50'
}

function getStatusBadge(status: UserStatus) {
  const map: Record<UserStatus, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400' },
    active: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-400' },
    paused: { label: 'Paused', className: 'bg-white/[0.06] text-white/40' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/15 text-red-400' },
  }
  return map[status]
}

type FilterType = 'all' | 'active' | 'pending' | 'paused'

export default function ClientsPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const loadClients = () => {
    setLoading(true)
    fetchClients()
      .then(setClients)
      .catch((err) => {
        console.error('[Clients] Failed to load:', err)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadClients()
  }, [])

  const filtered = filter === 'all' ? clients : clients.filter((c) => c.status === filter)
  const counts = {
    all: clients.length,
    active: clients.filter((c) => c.status === 'active').length,
    pending: clients.filter((c) => c.status === 'pending').length,
    paused: clients.filter((c) => c.status === 'paused').length,
  }

  const pendingApplications = clients.filter(
    (c) => c.application && c.application.status === 'pending'
  )

  const handleAccept = async (client: ClientRow) => {
    if (!client.application) return
    setProcessing(client.id)
    try {
      await acceptApplication(client.application.id, client.id)
      loadClients()
    } catch (err) {
      console.error('[Accept] Failed:', err)
    } finally {
      setProcessing(null)
    }
  }

  const handleDecline = async (client: ClientRow) => {
    if (!client.application) return
    if (!confirm(`Decline ${client.name}'s application?`)) return
    setProcessing(client.id)
    try {
      await declineApplication(client.application.id, client.id)
      loadClients()
    } catch (err) {
      console.error('[Decline] Failed:', err)
    } finally {
      setProcessing(null)
    }
  }

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
            {counts.active} active &middot; {counts.pending} pending &middot; {counts.paused} paused
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'pending', 'paused'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
                filter === f ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
              }`}
            >
              {f}
              <span className={`text-[10px] ${filter === f ? 'text-white/70' : 'text-white/30'}`}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
          <p className="text-white/40 font-body">No clients yet. Applications will appear here when submitted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Client Cards */}
          <div className="lg:col-span-8 space-y-3">
            {filtered.map((client, i) => {
              const tierLabelStr = tierLabel(client.application?.tier)
              const statusBadge = getStatusBadge(client.status)
              const isExpanded = selectedClient === client.id
              const isPendingApp = client.application?.status === 'pending'
              return (
                <motion.div
                  key={client.id}
                  custom={i}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  onClick={() => setSelectedClient(isExpanded ? null : client.id)}
                  className={`bg-white/[0.03] border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                    isExpanded ? 'border-[#F76B16]/30 bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                          client.status === 'active'
                            ? 'bg-gradient-to-br from-[#F76B16] to-[#D8590C]'
                            : client.status === 'pending'
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                            : 'bg-white/[0.06]'
                        }`}
                      >
                        <span className={`text-xs font-display font-bold ${client.status !== 'paused' ? 'text-white' : 'text-white/40'}`}>
                          {client.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-body font-semibold">{client.name}</p>
                          <span className={`text-[9px] font-display uppercase tracking-wide px-2 py-0.5 rounded ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded ${getTierColor(tierLabelStr)}`}>
                            {tierLabelStr}
                          </span>
                          <span className="text-white/25 text-[11px] font-body">{client.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {isPendingApp ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleAccept(client)}
                            disabled={processing === client.id}
                            className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-display font-bold uppercase tracking-wide rounded-lg hover:bg-emerald-500/25 transition-colors duration-200 disabled:opacity-50"
                          >
                            {processing === client.id ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(client)}
                            disabled={processing === client.id}
                            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] text-white/50 text-[10px] font-display font-bold uppercase tracking-wide rounded-lg hover:bg-white/[0.06] transition-colors duration-200 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="hidden md:block text-right">
                            <p className="text-white/30 text-[10px] font-display uppercase tracking-wide">Last Workout</p>
                            <p className="text-white/60 text-xs font-body mt-1">{relativeTime(client.last_workout_at)}</p>
                          </div>
                          <svg
                            className={`w-4 h-4 text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && client.application && (
                    <div className="mt-5 pt-5 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Goals</p>
                        <p className="text-white/70 text-sm font-body mt-1 leading-relaxed">{client.application.goals}</p>
                      </div>
                      <div>
                        <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Equipment</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {client.application.equipment.length > 0 ? (
                            client.application.equipment.map((eq) => (
                              <span key={eq} className="bg-white/[0.04] text-white/60 text-[11px] font-body px-2 py-0.5 rounded">
                                {eq}
                              </span>
                            ))
                          ) : (
                            <span className="text-white/40 text-[11px] font-body">—</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Availability</p>
                        <p className="text-white/70 text-sm font-body mt-1">{client.application.availability}</p>
                      </div>
                      <div>
                        <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Billing</p>
                        <p className="text-white/70 text-sm font-body mt-1 capitalize">{client.application.billing_cycle}</p>
                      </div>
                      {client.application.health_limitations && (
                        <div className="sm:col-span-2">
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Health Limitations</p>
                          <p className="text-white/70 text-sm font-body mt-1 leading-relaxed">{client.application.health_limitations}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Phone</p>
                        <p className="text-white/70 text-sm font-body mt-1">{client.phone ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Applied</p>
                        <p className="text-white/70 text-sm font-body mt-1">
                          {new Date(client.application.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {client.application.referral && (
                        <div className="sm:col-span-2">
                          <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">How they heard about us</p>
                          <p className="text-white/70 text-sm font-body mt-1">{client.application.referral}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}

            {filtered.length === 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
                <p className="text-white/40 font-body text-sm">No {filter} clients.</p>
              </div>
            )}
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
                  {
                    tier: 'The Full Experience',
                    count: clients.filter((c) => c.application?.tier === 'full-experience' && c.status === 'active').length,
                    color: '#F76B16',
                    price: '$697/mo',
                  },
                  {
                    tier: 'The Accelerator',
                    count: clients.filter((c) => c.application?.tier === 'accelerator' && c.status === 'active').length,
                    color: '#1A7BFF',
                    price: '$497/mo',
                  },
                  {
                    tier: 'The Blueprint',
                    count: clients.filter((c) => c.application?.tier === 'blueprint' && c.status === 'active').length,
                    color: '#64748B',
                    price: '$297/mo',
                  },
                ].map((t) => (
                  <div key={t.tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
                      <div>
                        <p className="text-white/70 text-sm font-body">{t.tier}</p>
                        <p className="text-white/25 text-xs font-body">{t.price} each</p>
                      </div>
                    </div>
                    <span className="font-display font-bold text-white text-lg">{t.count}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Pending Applications */}
            <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">New Applications</h2>
                {pendingApplications.length > 0 && (
                  <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                    {pendingApplications.length}
                  </span>
                )}
              </div>
              <div className="p-5 space-y-3">
                {pendingApplications.length === 0 ? (
                  <p className="text-white/30 text-xs font-body text-center py-2">No pending applications</p>
                ) : (
                  pendingApplications.slice(0, 5).map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-body font-medium truncate">{client.name}</p>
                        <p className="text-white/30 text-xs font-body">
                          {new Date(client.application!.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &middot; {tierLabel(client.application!.tier)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setFilter('pending')
                          setSelectedClient(client.id)
                        }}
                        className="px-3 py-1.5 bg-[#F76B16] text-white text-[10px] font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#D8590C] transition-colors duration-200"
                      >
                        Review
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}
