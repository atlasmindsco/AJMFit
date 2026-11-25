'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  fetchClients,
  acceptApplication,
  inviteClient,
  setUserBeta,
  tierLabel,
  relativeTime,
  type ClientRow,
  type UserStatus,
} from '@/lib/admin'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import { fetchAllOnboarding, ONBOARDING_LABELS, type OnboardingAnswers, type OnboardingForm } from '@/lib/onboarding'
import AssignProgram from '@/components/admin/AssignProgram'
import ProgramRecommendation from '@/components/admin/ProgramRecommendation'
import ClientPhotos from '@/components/admin/ClientPhotos'
import ClientTraining from '@/components/admin/ClientTraining'
import CoachNotes from '@/components/admin/CoachNotes'
import { rankRoster, rosterCounts, rosterFilters } from '@/lib/roster'
import { STATUS_META, type ClientStatus } from '@/lib/client-status'
import { fetchAllCheckIns } from '@/lib/check-ins'
import { fetchActiveBlocks, fetchEverAssigned } from '@/lib/programs'
import { fetchStalledLifts } from '@/lib/admin'
import { fetchPainSwaps } from '@/lib/workout'
import { findDuplicates } from '@/lib/duplicate-subs'
import { fetchAllSubscriptions } from '@/lib/admin'

function getTierColor(tier: string) {
  if (tier.includes('Full')) return 'bg-brand-orange/15 text-brand-orange'
  if (tier.includes('Accelerator')) return 'bg-brand-blue/15 text-brand-blue'
  return 'bg-white/[0.06] text-ink-2'
}

function getStatusBadge(status: UserStatus) {
  const map: Record<UserStatus, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400' },
    active: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-400' },
    paused: { label: 'Paused', className: 'bg-white/[0.06] text-ink-3' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/15 text-red-400' },
  }
  return map[status]
}

/**
 * The list used to filter on 'active | pending | paused' — the STRIPE
 * subscription status. It told the coach who was paying and nothing about who
 * was training, so a client who had never logged a set rendered identically
 * to one on a ten-week streak: both green, both Active.
 *
 * Measured the day this changed: 15 active clients, 7 who had never logged a
 * single set and 4 more who had not trained in 41 to 95 days.
 *
 * Billing states stay, because approving an application still needs them.
 * What is added is the state that says how somebody is actually doing.
 */
type FilterType = 'all' | 'active' | 'pending' | 'paused' | ClientStatus

export default function ClientsPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const [onboardingMap, setOnboardingMap] = useState<Map<string, OnboardingForm>>(new Map())
  /** Everything clientStatus needs to say how a client is really doing. */
  const [roster, setRoster] = useState<Map<string, { status: ClientStatus; reason: string }>>(new Map())
  const [rosterCount, setRosterCount] = useState<Record<string, number>>({})
  const [rosterStates, setRosterStates] = useState<ClientStatus[]>([])
  /**
   * Clients paying more than once, keyed by user id.
   *
   * Found four months late: Ruth had three active subscriptions across two
   * accounts and Luis had two, because the Blueprint checkout is a guest GET
   * link that never checks whether somebody already has one. Shown here
   * because this is the screen where a coach looks a client up.
   */
  const [duplicatePay, setDuplicatePay] = useState<Map<string, number>>(new Map())

  const loadClients = () => {
    setLoading(true)
    Promise.all([
      fetchClients(),
      fetchAllOnboarding().catch(() => new Map<string, OnboardingForm>()),
      fetchAllCheckIns().catch(() => []),
      fetchActiveBlocks().catch(() => new Map()),
      fetchEverAssigned().catch(() => new Set<string>()),
      fetchStalledLifts().catch(() => new Map()),
      fetchPainSwaps().catch(() => []),
      fetchAllSubscriptions().catch(() => []),
    ])
      .then(([rows, forms, checkIns, blocks, everAssigned, stalls, painSwaps, subs]) => {
        setClients(rows)
        setOnboardingMap(forms)
        // Ranked by lib/roster.ts, the same call the dashboard makes, so the
        // two screens cannot disagree about who needs attention.
        const ranked = rankRoster({ clients: rows, checkIns, stalls, painSwaps, blocks, everAssigned })
        setRoster(new Map(ranked.map((r) => [r.client.id, { status: r.status, reason: r.reason }])))
        setRosterCount(rosterCounts(ranked) as unknown as Record<string, number>)
        setRosterStates(rosterFilters(ranked))
        // Detection only. Cancelling or refunding is never automatic.
        const dupes = findDuplicates(rows, subs)
        const payMap = new Map<string, number>()
        for (const d of dupes) {
          for (const id of d.userIds) payMap.set(id, d.subscriptionIds.length)
        }
        setDuplicatePay(payMap)
      })
      .catch((err) => {
        console.error('[Clients] Failed to load:', err)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadClients()
  }, [])

  const isBilling = (f: FilterType): f is 'active' | 'pending' | 'paused' =>
    f === 'active' || f === 'pending' || f === 'paused'
  const filtered =
    filter === 'all'
      ? clients
      : isBilling(filter)
        ? clients.filter((c) => c.status === filter)
        : clients.filter((c) => roster.get(c.id)?.status === filter)
  const counts: Record<string, number> = {
    all: clients.length,
    active: clients.filter((c) => c.status === 'active').length,
    pending: clients.filter((c) => c.status === 'pending').length,
    paused: clients.filter((c) => c.status === 'paused').length,
    ...rosterCount,
  }

  const pendingApplications = clients.filter(
    (c) => c.application && c.application.status === 'pending'
  )

  const handleAccept = async (client: ClientRow) => {
    if (!client.application) return
    setProcessing(client.id)
    try {
      await acceptApplication(client.application.id, client.id)
      // Email the client their set-password invite so they can reach the studio.
      // Invite failure must not strand the (already-committed) acceptance;
      // the Resend invite button covers the retry.
      try {
        await inviteClient(client.id, { approval: true })
      } catch (inviteErr) {
        console.error('[Accept] Invite email failed:', inviteErr)
        alert(
          `${client.name} was approved, but the invite email failed to send. Use the "Resend invite" button on their card to try again.`
        )
      }
      loadClients()
    } catch (err) {
      console.error('[Accept] Failed:', err)
      alert(err instanceof Error ? err.message : 'Could not accept application.')
    } finally {
      setProcessing(null)
    }
  }

  const handleResendInvite = async (client: ClientRow) => {
    setProcessing(client.id)
    try {
      await inviteClient(client.id)
      alert(`Invite sent to ${client.email}. It may take a minute to arrive.`)
    } catch (err) {
      console.error('[Resend invite] Failed:', err)
      alert(err instanceof Error ? err.message : 'Could not send the invite.')
    } finally {
      setProcessing(null)
    }
  }

  // Decline flow: coach picks a reason (drives the polite email the applicant
  // receives) plus an optional personal note.
  const [declineTarget, setDeclineTarget] = useState<ClientRow | null>(null)
  const [declineReason, setDeclineReason] = useState<'capacity' | 'fit' | 'medical' | 'other'>('capacity')
  const [declineNote, setDeclineNote] = useState('')

  const DECLINE_REASONS: Array<{ key: typeof declineReason; label: string; hint: string }> = [
    { key: 'capacity', label: 'At capacity', hint: 'Roster is full. Invites them to the newsletter and to re-apply when spots open.' },
    { key: 'fit', label: 'Not the right fit', hint: 'Their goals need a different program or coach. Warm, no hard feelings.' },
    { key: 'medical', label: 'Needs doctor clearance', hint: 'Health notes warrant medical sign-off first. Invites re-apply after clearance.' },
    { key: 'other', label: 'Other', hint: 'General polite decline. Add a personal note below if you want to say more.' },
  ]

  const handleDecline = (client: ClientRow) => {
    if (!client.application) return
    setDeclineReason('capacity')
    setDeclineNote('')
    setDeclineTarget(client)
  }

  const submitDecline = async () => {
    const client = declineTarget
    if (!client?.application) return
    setProcessing(client.id)
    try {
      const res = await fetch('/api/admin/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: client.id,
          applicationId: client.application.id,
          reason: declineReason,
          note: declineNote.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not decline the application.')
      }
      setDeclineTarget(null)
      loadClients()
    } catch (err) {
      console.error('[Decline] Failed:', err)
      alert(err instanceof Error ? err.message : 'Could not decline the application.')
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
          <p className="text-ink-3 font-body text-sm mt-1">
            {counts.active} active &middot; {counts.pending} pending &middot; {counts.paused} paused
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Billing first, then how they are actually doing. Only states
              somebody is IN get a button — a filter for an empty state is a
              button that clears the screen. */}
          {([...(['all', 'active', 'pending', 'paused'] as FilterType[]), ...rosterStates]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-control text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
                filter === f ? 'bg-brand-orange text-white' : 'bg-white/[0.04] text-ink-3 hover:text-ink-2'
              }`}
            >
              {STATUS_META[f as ClientStatus]?.label ?? f}
              <span className={`text-2xs ${filter === f ? 'text-ink-2' : 'text-ink-4'}`}>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-card p-12 text-center">
          <p className="text-ink-3 font-body">No clients yet. Applications will appear here when submitted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Client Cards */}
          <div className="lg:col-span-8 space-y-3">
            {filtered.map((client, i) => {
              const tierLabelStr = tierLabel(client.application?.tier)
              const statusBadge = getStatusBadge(client.status)
              // Only active clients are ranked, so this is absent for a
              // pending application, which is correct: there is nothing to
              // say about how somebody is training before they start.
              const rosterRow = roster.get(client.id)
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
                  className={`bg-white/[0.03] border rounded-card p-5 cursor-pointer transition-all duration-200 ${
                    isExpanded ? 'border-brand-orange/30 bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                          client.status === 'active'
                            ? 'bg-gradient-to-br from-brand-orange to-brand-orangedark'
                            : client.status === 'pending'
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                            : 'bg-white/[0.06]'
                        }`}
                      >
                        <span className={`text-xs font-display font-bold ${client.status !== 'paused' ? 'text-white' : 'text-ink-3'}`}>
                          {client.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-body font-semibold">{client.name}</p>
                          <span className={`text-badge font-display uppercase tracking-wide px-2 py-0.5 rounded ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        {/* How they are actually doing, under the name.
                            The badge beside the name is the billing state, and
                            on this screen it was the ONLY state shown — so a
                            client who had never logged a set and one on a
                            ten-week streak were both a green "Active" dot.
                            The reason is printed too: "Never trained" is a
                            label, "joined 200 days ago, never trained" is
                            something a coach can act on. */}
                        {/* Paying more than once. Above the training state
                            because it is the only thing on this row costing
                            somebody money while nobody looks. */}
                        {duplicatePay.has(client.id) && (
                          <p className="text-state-danger text-2xs font-body mt-1">
                            <span className="font-display font-bold uppercase tracking-wide">
                              Paying {duplicatePay.get(client.id)}&times;
                            </span>
                            {' · '}
                            <span className="text-ink-3">
                              {duplicatePay.get(client.id)} active subscriptions &mdash; check Stripe
                            </span>
                          </p>
                        )}
                        {rosterRow && (
                          <p className={`text-2xs font-body mt-1 ${STATUS_META[rosterRow.status].tone}`}>
                            <span className="font-display font-bold uppercase tracking-wide">
                              {STATUS_META[rosterRow.status].label}
                            </span>
                            {' · '}
                            <span className="text-ink-3">{rosterRow.reason}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-2xs font-display font-bold px-2 py-0.5 rounded ${getTierColor(tierLabelStr)}`}>
                            {tierLabelStr}
                          </span>
                          <span className="text-ink-4 text-2xs font-body">{client.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {isPendingApp ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleAccept(client)}
                            disabled={processing === client.id}
                            className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-2xs font-display font-bold uppercase tracking-wide rounded-control hover:bg-emerald-500/25 transition-colors duration-200 disabled:opacity-50"
                          >
                            {processing === client.id ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(client)}
                            disabled={processing === client.id}
                            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] text-ink-2 text-2xs font-display font-bold uppercase tracking-wide rounded-control hover:bg-white/[0.06] transition-colors duration-200 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Approved but not signed in yet: let the coach re-send the
                              set-password link (covers lost/expired invites). */}
                          {client.status === 'pending' && client.application?.status === 'accepted' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleResendInvite(client)
                              }}
                              disabled={processing === client.id}
                              title="Send them a fresh set-password link"
                              className="px-2.5 py-1.5 rounded-control bg-brand-blue/15 border border-brand-blue/25 text-brand-blue text-2xs font-display font-bold uppercase tracking-wide hover:bg-brand-blue/25 transition-colors duration-200 disabled:opacity-50"
                            >
                              {processing === client.id ? '...' : 'Resend invite'}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setProcessing(client.id)
                              setUserBeta(client.id, !client.is_beta).then(loadClients).finally(() => setProcessing(null))
                            }}
                            disabled={processing === client.id}
                            title="Beta testers get free studio access (no payment)"
                            className={`px-2.5 py-1.5 rounded-control text-2xs font-display font-bold uppercase tracking-wide transition-colors duration-200 disabled:opacity-50 ${
                              client.is_beta
                                ? 'bg-brand-orange/15 border border-brand-orange/25 text-brand-orange'
                                : 'bg-white/[0.04] border border-white/[0.08] text-ink-3 hover:text-ink-2'
                            }`}
                          >
                            Beta {client.is_beta ? 'On' : 'Off'}
                          </button>
                          <div className="hidden md:block text-right">
                            <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Last Workout</p>
                            <p className="text-ink-2 text-xs font-body mt-1">{relativeTime(client.last_workout_at)}</p>
                          </div>
                          <svg
                            className={`w-4 h-4 text-ink-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
                        <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Goals</p>
                        <p className="text-ink-2 text-sm font-body mt-1 leading-relaxed">{client.application.goals}</p>
                      </div>
                      <div>
                        <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Equipment</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {client.application.equipment.length > 0 ? (
                            client.application.equipment.map((eq) => (
                              <span key={eq} className="bg-white/[0.04] text-ink-2 text-2xs font-body px-2 py-0.5 rounded">
                                {eq}
                              </span>
                            ))
                          ) : (
                            <span className="text-ink-3 text-2xs font-body">None listed</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Availability</p>
                        <p className="text-ink-2 text-sm font-body mt-1">{client.application.availability}</p>
                      </div>
                      <div>
                        <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Billing</p>
                        <p className="text-ink-2 text-sm font-body mt-1 capitalize">{client.application.billing_cycle}</p>
                      </div>
                      {client.application.health_limitations && (
                        <div className="sm:col-span-2">
                          <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Health Limitations</p>
                          <p className="text-ink-2 text-sm font-body mt-1 leading-relaxed">{client.application.health_limitations}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Phone</p>
                        <p className="text-ink-2 text-sm font-body mt-1">{client.phone ?? 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">Applied</p>
                        <p className="text-ink-2 text-sm font-body mt-1">
                          {new Date(client.application.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {client.application.referral && (
                        <div className="sm:col-span-2">
                          <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">How they heard about us</p>
                          <p className="text-ink-2 text-sm font-body mt-1">{client.application.referral}</p>
                        </div>
                      )}

                      {/* Onboarding form answers (pre-call questionnaire) */}
                      <div className="sm:col-span-2 mt-1 pt-4 border-t border-white/[0.06]">
                        <p className="text-brand-orange text-2xs font-display font-bold uppercase tracking-wide mb-2">
                          Onboarding form
                        </p>
                        {onboardingMap.get(client.id) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                            {(Object.keys(ONBOARDING_LABELS) as Array<keyof OnboardingAnswers>)
                              .filter((k) => (onboardingMap.get(client.id)!.answers[k] ?? '').toString().trim())
                              .map((k) => (
                                <div key={k}>
                                  <p className="text-ink-4 text-2xs font-display uppercase tracking-wide">{ONBOARDING_LABELS[k]}</p>
                                  <p className="text-ink-2 text-sm font-body mt-0.5 leading-relaxed">
                                    {String(onboardingMap.get(client.id)!.answers[k])}
                                  </p>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-ink-3 text-sm font-body">Not filled out yet.</p>
                        )}
                      </div>

                      {/* Private, and first: a pinned note is the thing
                          that should be in front of the coach before they
                          read anything else about this person. The client
                          never sees these. */}
                      <div>
                        <p className="text-ink-3 text-2xs font-display font-bold uppercase tracking-[0.15em] mb-2">
                          Coach notes &middot; private
                        </p>
                        <CoachNotes userId={client.id} />
                      </div>

                      {/* What they actually did. 1,371 logged sets existed
                          and no coach screen showed one — you could see that
                          a workout happened and not what was in it. */}
                      <div>
                        <p className="text-ink-3 text-2xs font-display font-bold uppercase tracking-[0.15em] mb-2">
                          Training
                        </p>
                        <ClientTraining userId={client.id} />
                      </div>

                      <ClientPhotos userId={client.id} />

                      {/* The recommendation sits ABOVE the manual picker: the
                          common case is accepting or tweaking the match, and
                          the dropdown is the fallback for when it is wrong. */}
                      <ProgramRecommendation userId={client.id} clientName={client.name ?? undefined} />

                      <AssignProgram userId={client.id} />
                    </div>
                  )}
                </motion.div>
              )
            })}

            {filtered.length === 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-card p-8 text-center">
                <p className="text-ink-3 font-body text-sm">No {filter} clients.</p>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Tier Breakdown */}
            <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-card">
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
                    price: '$397/mo',
                  },
                  {
                    tier: 'The Blueprint',
                    count: clients.filter((c) => c.application?.tier === 'blueprint' && c.status === 'active').length,
                    color: '#64748B',
                    price: '$19.97/mo',
                  },
                ].map((t) => (
                  <div key={t.tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-control" style={{ backgroundColor: t.color }} />
                      <div>
                        <p className="text-ink-2 text-sm font-body">{t.tier}</p>
                        <p className="text-ink-4 text-xs font-body">{t.price} each</p>
                      </div>
                    </div>
                    <span className="font-display font-bold text-white text-lg">{t.count}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Pending Applications */}
            <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-card">
              <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white">New Applications</h2>
                {pendingApplications.length > 0 && (
                  <span className="text-2xs font-display font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                    {pendingApplications.length}
                  </span>
                )}
              </div>
              <div className="p-5 space-y-3">
                {pendingApplications.length === 0 ? (
                  <p className="text-ink-4 text-xs font-body text-center py-2">No pending applications</p>
                ) : (
                  pendingApplications.slice(0, 5).map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 rounded-control bg-white/[0.02]">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-body font-medium truncate">{client.name}</p>
                        <p className="text-ink-4 text-xs font-body">
                          {new Date(client.application!.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &middot; {tierLabel(client.application!.tier)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setFilter('pending')
                          setSelectedClient(client.id)
                        }}
                        className="px-3 py-1.5 bg-brand-orange text-white text-2xs font-display font-bold uppercase tracking-wide rounded-control hover:bg-brand-orangedark transition-colors duration-200"
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

      {/* Decline modal: reason drives the applicant's polite email */}
      {declineTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => processing === null && setDeclineTarget(null)}>
          <div className="w-full max-w-md bg-[#161616] border border-white/[0.10] rounded-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-extrabold text-lg text-white tracking-tight">
              Decline {declineTarget.name.split(' ')[0]}&rsquo;s application
            </h2>
            <p className="text-ink-3 text-xs font-body mt-1 mb-4">
              They&rsquo;ll get a polite email based on the reason you pick. Reply-to goes to your inbox.
            </p>
            <div className="space-y-2 mb-4">
              {DECLINE_REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setDeclineReason(r.key)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-control border transition-colors duration-150 ${
                    declineReason === r.key
                      ? 'bg-brand-orange/10 border-brand-orange/40'
                      : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16]'
                  }`}
                >
                  <span className={`block text-sm font-body font-semibold ${declineReason === r.key ? 'text-brand-orange' : 'text-ink'}`}>
                    {r.label}
                  </span>
                  <span className="block text-ink-3 text-xs font-body mt-0.5">{r.hint}</span>
                </button>
              ))}
            </div>
            <textarea
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              placeholder="Optional personal note (included in the email, in your words)"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.08] text-ink text-sm font-body placeholder:text-ink-4 focus:outline-none focus:border-brand-blue/50 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDeclineTarget(null)}
                disabled={processing !== null}
                className="px-4 py-2 rounded-control bg-white/[0.04] border border-white/[0.08] text-ink-2 text-xs font-display font-bold uppercase tracking-wide hover:bg-white/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitDecline}
                disabled={processing !== null}
                className="px-4 py-2 rounded-control bg-brand-orange text-white text-xs font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark transition-colors disabled:opacity-50"
              >
                {processing !== null ? 'Sending…' : 'Decline & send email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
