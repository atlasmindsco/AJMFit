'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import { fetchClients, tierLabel, relativeTime, type ClientRow } from '@/lib/admin'
import { fetchFeedback, type Feedback } from '@/lib/feedback'

interface Stats {
  activeClients: number
  totalClients: number
  pendingApplications: number
  revenueMtdCents: number
}

function getTierColor(tier: string) {
  if (tier.includes('Full')) return 'text-[#F76B16]'
  if (tier.includes('Accelerator')) return 'text-[#1A7BFF]'
  return 'text-white/50'
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [s, c, f] = await Promise.all([
          fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)),
          fetchClients(),
          fetchFeedback().catch(() => []),
        ])
        if (!active) return
        setStats(s)
        setClients(c)
        setFeedback(f)
      } catch (err) {
        console.error('[Admin dashboard] load failed', err)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const dash = (v: number | string | undefined) => (loading || v === undefined ? ', ' : v)
  const pending = clients.filter((c) => c.application?.status === 'pending')

  const cards = [
    { label: 'Active Clients', value: dash(stats?.activeClients) },
    { label: 'Pending Applications', value: dash(stats?.pendingApplications) },
    { label: 'Total Clients', value: dash(stats?.totalClients) },
    {
      label: 'Revenue (MTD)',
      value: loading || !stats ? ', ' : `$${(stats.revenueMtdCents / 100).toLocaleString()}`,
    },
  ]

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-white">
          Dashboard
        </motion.h1>
        <p className="text-white/40 font-body text-sm mt-2">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {cards.map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <p className="text-white/40 text-[11px] font-display uppercase tracking-[0.15em]">{stat.label}</p>
            <p className="font-display font-extrabold text-3xl text-white tracking-tight mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Clients */}
        <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible" className="xl:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Clients</h2>
            <Link href="/luffy/clients" className="text-xs text-[#F76B16] font-body hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>
            ) : clients.length === 0 ? (
              <p className="p-8 text-white/30 text-sm font-body text-center">No clients yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] font-display uppercase tracking-[0.2em] text-white/25 border-b border-white/[0.04]">
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Tier</th>
                    <th className="px-6 py-3 font-semibold">Last Active</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 8).map((client) => {
                    const tier = tierLabel(client.application?.tier)
                    return (
                      <tr key={client.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150">
                        <td className="px-6 py-4">
                          <span className="text-white text-sm font-body font-medium">{client.name}</span>
                          <span className="block text-white/30 text-[11px] font-body">{client.email}</span>
                        </td>
                        <td className="px-6 py-4"><span className={`text-xs font-body ${getTierColor(tier)}`}>{tier}</span></td>
                        <td className="px-6 py-4"><span className="text-white/40 text-xs font-body">{relativeTime(client.last_workout_at)}</span></td>
                        <td className="px-6 py-4">
                          <span className={`inline-block text-[10px] font-display uppercase tracking-[0.15em] font-semibold px-2.5 py-1 rounded-md ${
                            client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400'
                              : client.status === 'pending' ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-white/[0.06] text-white/30'
                          }`}>{client.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {/* Pending applications */}
        <motion.div custom={5} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Pending Applications</h2>
            {pending.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#F76B16] flex items-center justify-center text-white text-[10px] font-display font-bold">{pending.length}</span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {loading ? (
              <p className="px-2 py-3 text-white/30 text-sm font-body">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="px-2 py-3 text-white/40 text-sm font-body">No applications waiting. You&rsquo;re all caught up.</p>
            ) : (
              pending.map((c) => (
                <Link key={c.id} href="/luffy/clients" className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors duration-150">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-[#F76B16]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-body leading-snug">{c.name}</p>
                    <span className="text-[10px] font-display uppercase tracking-[0.15em] text-white/30 mt-1 inline-block">
                      {tierLabel(c.application?.tier)} · review →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Beta feedback */}
      <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-xl">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Beta Feedback</h2>
          {feedback.length > 0 && <span className="text-xs text-white/30 font-body">{feedback.length}</span>}
        </div>
        <div className="p-4 space-y-2">
          {feedback.length === 0 ? (
            <p className="px-2 py-3 text-white/40 text-sm font-body">No feedback yet.</p>
          ) : (
            feedback.slice(0, 12).map((f) => (
              <div key={f.id} className="p-3 rounded-lg bg-white/[0.02]">
                <p className="text-white/80 text-sm font-body">{f.message}</p>
                <p className="text-white/30 text-[11px] font-body mt-1">
                  {f.name || 'Member'}{f.page ? ` · ${f.page}` : ''} · {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
