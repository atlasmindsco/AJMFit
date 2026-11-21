/**
 * Every client, ranked by who needs the coach first.
 *
 * `lib/client-status.ts` decides what one client's state IS. This decides
 * what the whole list looks like, and exists because two screens were
 * answering that question differently.
 *
 * `/luffy` ranked its top ten by real state. `/luffy/clients` — the screen a
 * coach opens to ask "how is everyone doing" — filtered on `active /
 * pending / paused`, which is the STRIPE subscription status. It says who is
 * paying and nothing about who is training, so a client who has never logged
 * a set rendered identically to one on a ten-week streak: both green, both
 * marked Active.
 *
 * Measured the day this was written: 15 active clients, 7 of whom had never
 * logged a single set and 4 more who had not trained in 41 to 95 days. On
 * the client list all fifteen looked the same.
 *
 * Both screens call this now, so they cannot drift apart again.
 */
import { clientStatus, STATUS_ORDER, type ClientStatus } from '@/lib/client-status'
import { blockProgress } from '@/lib/blocks'
import { TIER_EXPERIENCE } from '@/lib/tiers'
import type { Tier } from '@/lib/stripe/catalog'
import type { ClientRow } from '@/lib/admin'
import type { CheckIn } from '@/lib/check-ins'

/** A block as fetchActiveBlocks returns it. */
export interface RosterBlock {
  assigned_at: string
  /** blockProgress takes undefined for "no length set", not null. */
  block_weeks: number | undefined
}

export interface RosterInput {
  clients: ClientRow[]
  checkIns: CheckIn[]
  /**
   * Lifts going backwards, keyed by user id, exactly as fetchStalledLifts
   * returns them. Objects rather than names: client-status reads the verdict
   * to tell "slipping" from "stuck", which are different conversations.
   */
  stalls: Map<string, Array<{ exerciseName: string; verdict: string }>>
  painSwaps: Array<{ user_id: string; original_exercise_name: string; created_at: string }>
  blocks: Map<string, RosterBlock>
  /** Who has EVER been given a program, so somebody between blocks is not
   *  accused of never starting. */
  everAssigned: Set<string>
}

export interface RosterRow {
  client: ClientRow
  status: ClientStatus
  reason: string
}

/**
 * Rank the active clients.
 *
 * Only `status === 'active'`: a cancelled or pending client is not somebody
 * the coach has failed, and mixing them in makes the list longer without
 * making it more useful.
 */
export function rankRoster(input: RosterInput): RosterRow[] {
  return input.clients
    .filter((c) => c.status === 'active')
    .map((client) => {
      const tier = client.application?.tier
      const { status, reason } = clientStatus({
        coached: tier === 'accelerator' || tier === 'full-experience',
        lastWorkoutAt: client.last_workout_at,
        checkIns: input.checkIns.filter((ci) => ci.user_id === client.id),
        signedUpAt: client.created_at,
        stalledLifts: input.stalls.get(client.id) ?? [],
        // Hold the coach to what the tier actually sold.
        responseHours: tier ? TIER_EXPERIENCE[tier as Tier].responseHours : null,
        // Explicit boolean: undefined would mean "do not judge".
        hasProgram: input.everAssigned.has(client.id),
        painSwaps: input.painSwaps
          .filter((p) => p.user_id === client.id)
          .map((p) => ({ exerciseName: p.original_exercise_name, at: p.created_at })),
        blockEndsInDays: (() => {
          const b = input.blocks.get(client.id)
          return b ? blockProgress(b.assigned_at, b.block_weeks).daysLeft : null
        })(),
      })
      return { client, status, reason }
    })
    .sort((a, b) => {
      const by = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      // Worst first; alphabetical inside a band so the order is stable
      // between loads rather than following whatever the query returned.
      return by !== 0 ? by : a.client.name.localeCompare(b.client.name)
    })
}

/** How many clients sit in each state, for the filter row. */
export function rosterCounts(rows: RosterRow[]): Record<ClientStatus, number> {
  const out = {} as Record<ClientStatus, number>
  for (const s of STATUS_ORDER) out[s] = 0
  for (const r of rows) out[r.status] += 1
  return out
}

/**
 * The states worth a filter button, in order, skipping the empty ones.
 *
 * A filter for a state nobody is in is a button that returns an empty screen,
 * and on a roster of fifteen that is most of them most of the time.
 */
export function rosterFilters(rows: RosterRow[]): ClientStatus[] {
  const counts = rosterCounts(rows)
  return STATUS_ORDER.filter((s) => counts[s] > 0)
}
