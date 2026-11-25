'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { fetchActiveBlocks, fetchEverAssigned, type Assignment } from '@/lib/programs'
import { fetchPainSwaps } from '@/lib/workout'
import { blockProgress } from '@/lib/blocks'
import Link from 'next/link'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import { fetchClients, tierLabel, relativeTime, fetchStalledLifts, fetchPendingNutritionProposals, fetchRecentWins, type ClientRow, type RecentWin } from '@/lib/admin'
import type { StalledLift } from '@/lib/coach-signals'
import { TIER_EXPERIENCE } from '@/lib/tiers'
import { fetchAllCheckIns, type CheckIn } from '@/lib/check-ins'
import { fetchUnansweredThreads } from '@/lib/messages'
import { cronHealth, cronWarning } from '@/lib/cron-health'
import { fetchCronRuns } from '@/lib/admin'
import { clientStatus, STATUS_META, STATUS_ORDER } from '@/lib/client-status'
import { fetchFeedback, type Feedback } from '@/lib/feedback'

interface Stats {
  activeClients: number
  totalClients: number
  pendingApplications: number
  revenueMtdCents: number
}

function getTierColor(tier: string) {
  if (tier.includes('Full')) return 'text-brand-orange'
  if (tier.includes('Accelerator')) return 'text-brand-blue'
  return 'text-ink-2'
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [blocks, setBlocks] = useState<Map<string, Assignment>>(new Map())
  // Who has EVER had a program, so a client between blocks is not accused of
  // having been given nothing.
  const [everAssigned, setEverAssigned] = useState<Set<string>>(new Set())
  // Exercises clients swapped out because something hurt. Collected since the
  // swap feature shipped; never once shown to anyone until now.
  const [painSwaps, setPainSwaps] = useState<Array<{ user_id: string; original_exercise_name: string; created_at: string }>>([])
  const [stalls, setStalls] = useState<Map<string, StalledLift[]>>(new Map())
  const [proposals, setProposals] = useState<Map<string, { created_at: string }>>(new Map())
  const [wins, setWins] = useState<RecentWin[]>([])
  /** Whether the daily jobs are still running. See lib/cron-health.ts. */
  /**
   * Clients whose last message has no reply, oldest wait first.
   *
   * The ranking read training signals and never this, so Shane's message sat
   * 154 days and Jamel's 105 without surfacing anywhere. Somebody waiting on
   * an answer outranks every training signal there is.
   */
  const [waiting, setWaiting] = useState<Map<string, number>>(new Map())
  const [cronWarn, setCronWarn] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [s, c, f, ci, bl, st, pr, rw, ea, ps] = await Promise.all([
          fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)),
          fetchClients(),
          fetchFeedback().catch(() => []),
          fetchAllCheckIns().catch(() => []),
          fetchActiveBlocks().catch(() => new Map()),
          fetchStalledLifts().catch(() => new Map()),
          fetchPendingNutritionProposals().catch(() => new Map()),
          fetchRecentWins().catch(() => []),
          fetchEverAssigned().catch(() => new Set<string>()),
          fetchPainSwaps().catch(() => []),
        ])
        if (!active) return
        setStats(s)
        // Second line of defence. The GitHub Action emails on failure; this
        // makes a silent stop visible on the screen the coach already opens,
        // because an email that stops arriving is what nobody notices.
        void fetchUnansweredThreads()
          .then((rows) => {
            if (active) setWaiting(new Map(rows.map((r) => [r.userId, r.waitingDays])))
          })
          .catch(() => {})
        void fetchCronRuns()
          .then((runs) => {
            if (active) setCronWarn(cronWarning(cronHealth(runs, ['digest', 'reminders'])))
          })
          .catch(() => {})
        setClients(c)
        setFeedback(f)
        setCheckIns(ci)
        setBlocks(bl)
        setStalls(st)
        setProposals(pr)
        setWins(rw)
        setEverAssigned(ea)
        setPainSwaps(ps)
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

  const dash = (v: number | string | undefined) => (loading || v === undefined ? '—' : v)
  const pending = clients.filter((c) => c.application?.status === 'pending')

  const cards = [
    { label: 'Active Clients', value: dash(stats?.activeClients) },
    { label: 'Pending Applications', value: dash(stats?.pendingApplications) },
    { label: 'Total Clients', value: dash(stats?.totalClients) },
    {
      label: 'Revenue (MTD)',
      value: loading || !stats ? '—' : `$${(stats.revenueMtdCents / 100).toLocaleString()}`,
    },
  ]

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-white">
          Dashboard
        </motion.h1>
        <p className="text-ink-3 font-body text-sm mt-2">{today}</p>
      </div>

      {cronWarn && (
        <div className="mb-8 rounded-card bg-state-danger/[0.10] border border-state-danger/30 px-5 py-4">
          <p className="font-display font-bold text-sm text-white">The daily jobs are not running</p>
          <p className="text-ink-2 text-xs font-body mt-1 leading-relaxed">
            {cronWarn}. Nobody is being reminded and you are not getting the digest. Check the Daily
            jobs workflow in GitHub Actions.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {cards.map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-card p-6">
            <p className="text-ink-3 text-2xs font-display uppercase tracking-[0.15em]">{stat.label}</p>
            <p className="font-display font-extrabold text-3xl text-white tracking-tight mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Clients */}
        <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible" className="xl:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Clients</h2>
            <Link href="/luffy/clients" className="text-xs text-brand-orange font-body hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>
            ) : clients.length === 0 ? (
              <p className="p-8 text-ink-4 text-sm font-body text-center">No clients yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-2xs font-display uppercase tracking-[0.2em] text-ink-4 border-b border-white/[0.04]">
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Tier</th>
                    <th className="px-6 py-3 font-semibold">Last Active</th>
                    <th className="px-6 py-3 font-semibold">Needs</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ranked by what needs the coach first, rather than by
                      signup date. Finding out who was struggling used to mean
                      opening every client in turn. */}
                  {clients
                    .filter((c) => c.status === 'active')
                    .map((client) => {
                      const tier = client.application?.tier
                      const { status, reason } = clientStatus({
                        coached: tier === 'accelerator' || tier === 'full-experience',
                        lastWorkoutAt: client.last_workout_at,
                        checkIns: checkIns.filter((ci) => ci.user_id === client.id),
                        signedUpAt: client.created_at,
                        stalledLifts: stalls.get(client.id) ?? [],
                        // Hold the coach to what the tier actually sold.
                        responseHours: tier ? TIER_EXPERIENCE[tier].responseHours : null,
                        // Explicit boolean: undefined would mean "do not judge".
                        hasProgram: everAssigned.has(client.id),
                        painSwaps: painSwaps
                          .filter((p) => p.user_id === client.id)
                          .map((p) => ({ exerciseName: p.original_exercise_name, at: p.created_at })),
                        blockEndsInDays: (() => {
                          const b = blocks.get(client.id)
                          return b ? blockProgress(b.assigned_at, b.block_weeks).daysLeft : null
                        })(),
                      })
                      return { client, status, reason }
                    })
                    /* Somebody waiting on a reply goes above everything.
                       A missed workout is a pattern; an unanswered question
                       is a broken promise, and the ranking could not see it
                       at all until now. */
                    .map((r) => ({ ...r, waitingDays: waiting.get(r.client.id) ?? null }))
                    .sort((a, b) => {
                      if ((a.waitingDays ?? -1) !== (b.waitingDays ?? -1)) {
                        return (b.waitingDays ?? -1) - (a.waitingDays ?? -1)
                      }
                      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
                    })
                    /* Three, not ten. The engine finds eleven flaggable
                       clients out of fifteen, and a list of eleven is the
                       client list again rather than a priority list. If a
                       fourth genuinely matters it is here tomorrow. */
                    .slice(0, 3)
                    .map(({ client, status, reason, waitingDays }) => {
                      const tier = tierLabel(client.application?.tier)
                      const meta = STATUS_META[status]
                      return (
                        <tr key={client.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="px-6 py-4">
                            <span className="text-white text-sm font-body font-medium">{client.name}</span>
                            <span className="block text-ink-4 text-2xs font-body">{client.email}</span>
                          </td>
                          <td className="px-6 py-4"><span className={`text-xs font-body ${getTierColor(tier)}`}>{tier}</span></td>
                          <td className="px-6 py-4"><span className="text-ink-3 text-xs font-body">{relativeTime(client.last_workout_at)}</span></td>
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                              <span>
                                <span className={`block text-xs font-display font-bold ${meta.tone}`}>{meta.label}</span>
                                <span className="block text-ink-4 text-2xs font-body">
                                  {waitingDays != null
                                    ? `Message waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'}`
                                    : reason}
                                </span>
                                {/* A queued nutrition change rides alongside
                                    rather than competing for the status, which
                                    stays one-per-client. The cron files these
                                    weekly and the only place they showed was a
                                    separate tab. */}
                                {proposals.has(client.id) && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-brand-orange/15 text-brand-orange text-badge font-display font-bold uppercase tracking-wide">
                                    Nutrition change waiting
                                  </span>
                                )}
                              </span>
                            </span>
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
        <motion.div custom={5} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-card">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Pending Applications</h2>
            {pending.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-orange flex items-center justify-center text-white text-2xs font-display font-bold">{pending.length}</span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {loading ? (
              <p className="px-2 py-3 text-ink-4 text-sm font-body">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="px-2 py-3 text-ink-3 text-sm font-body">No applications waiting. You&rsquo;re all caught up.</p>
            ) : (
              pending.map((c) => (
                <Link key={c.id} href="/luffy/clients" className="flex items-start gap-3 p-3 rounded-control hover:bg-white/[0.02] transition-colors duration-150">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-brand-orange" />
                  <div className="flex-1 min-w-0">
                    <p className="text-ink text-sm font-body leading-snug">{c.name}</p>
                    <span className="text-2xs font-display uppercase tracking-[0.15em] text-ink-4 mt-1 inline-block">
                      {tierLabel(c.application?.tier)} · review →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent wins.
          Replaces the per-PR email, which fired on every record across every
          client and told the coach something good that needed no action. A
          dashboard showing only problems is one you avoid opening. */}
      {wins.length > 0 && (
        <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-card">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Recent Wins</h2>
          </div>
          <div className="px-6 py-2">
            {wins.map((w) => (
              <div key={`${w.userId}-${w.exerciseName}-${w.at}`} className="py-3 border-b border-white/[0.04] last:border-0 flex items-baseline gap-3">
                <span className="text-white text-sm font-body font-medium shrink-0">{w.name}</span>
                <span className="text-ink-2 text-sm font-body min-w-0 truncate">
                  {w.exerciseName} &mdash; {w.weight} lb &times; {w.reps}
                </span>
                <span className="text-ink-4 text-2xs font-body ml-auto shrink-0">{relativeTime(w.at)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Beta feedback */}
      <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible" className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-card">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">Beta Feedback</h2>
          {feedback.length > 0 && <span className="text-xs text-ink-4 font-body">{feedback.length}</span>}
        </div>
        <div className="p-4 space-y-2">
          {feedback.length === 0 ? (
            <p className="px-2 py-3 text-ink-3 text-sm font-body">No feedback yet.</p>
          ) : (
            feedback.slice(0, 12).map((f) => (
              <div key={f.id} className="p-3 rounded-control bg-white/[0.02]">
                <p className="text-ink text-sm font-body">{f.message}</p>
                <p className="text-ink-4 text-2xs font-body mt-1">
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
