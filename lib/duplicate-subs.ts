/**
 * People paying for AJM Fit more than once.
 *
 * Found on 21 November 2026, four months after it started: Ruth Fleurime had
 * three active subscriptions across two accounts, and Luis had two. Nothing in
 * the product was capable of noticing — not a screen, not the digest, not a
 * check anywhere.
 *
 * HOW IT HAPPENS. /api/stripe/checkout-blueprint is a plain GET link that
 * creates a GUEST checkout session: no Stripe customer passed, no signed-in
 * user, and no check for an existing subscription. Click it twice and you get
 * two Stripe customers and two live subscriptions. Ruth checked out three
 * times across four days — 25 July, then twice on the 28th — which is what
 * somebody does when they are not sure the first payment worked. Blueprint
 * signup is "pay, then wait for an email to set a password", so a slow or
 * spam-filed invite makes paying again the obvious move.
 *
 * THIS MODULE ONLY DETECTS. It cancels nothing and refunds nothing: which of
 * a client's subscriptions should end, and whether they are owed money, is a
 * decision about somebody's money and belongs to the coach every single time.
 *
 * COMPED CLIENTS ARE SAFE. A 100% promo code produces a real subscription at
 * zero, indistinguishable here from a paying one. They hold exactly one, so
 * they never appear below — and the guard this feeds protects them most of
 * all, because a second checkout might not re-apply their code.
 */

/** Statuses where Stripe may be taking money, or about to. */
export const BILLABLE = ['active', 'trialing', 'past_due', 'unpaid']

export interface SubLike {
  user_id: string
  status: string | null
  stripe_subscription_id: string | null
}

export interface UserLike {
  id: string
  name: string | null
  email: string | null
}

export interface Duplicate {
  /** Every account involved. More than one means they signed up twice. */
  userIds: string[]
  name: string
  emails: string[]
  /** Distinct Stripe subscriptions that could be charging. */
  subscriptionIds: string[]
  /**
   * `same_account` is certain: one person, one login, two subscriptions.
   * `same_name` is a strong guess across two accounts and wants a human to
   * confirm before anything is cancelled.
   */
  confidence: 'same_account' | 'same_name'
}

/** Lower-cased, collapsed whitespace. Not an identity, just a grouping key. */
function nameKey(name: string | null): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function billable(s: SubLike): boolean {
  return BILLABLE.indexOf(String(s.status ?? '')) !== -1 && Boolean(s.stripe_subscription_id)
}

/**
 * Who is paying more than once.
 *
 * Two passes, because the two failure shapes are different. One account with
 * two subscriptions is arithmetic. Two accounts belonging to the same person
 * is a judgement — Ruth's addresses are `rumafle07@` and `rfleurm07@`, which
 * no email normalisation would ever join, so the only signal is the name she
 * typed into Stripe both times.
 */
export function findDuplicates(users: UserLike[], subs: SubLike[]): Duplicate[] {
  const byId = new Map(users.map((u) => [u.id, u]))
  const live = subs.filter(billable)

  const perUser = new Map<string, SubLike[]>()
  for (const s of live) {
    if (!perUser.has(s.user_id)) perUser.set(s.user_id, [])
    perUser.get(s.user_id)!.push(s)
  }

  const out: Duplicate[] = []
  const claimed = new Set<string>()

  // 1. One account, more than one live subscription. Not a guess.
  for (const [userId, rows] of Array.from(perUser)) {
    const ids = Array.from(new Set(rows.map((r) => r.stripe_subscription_id as string)))
    if (ids.length < 2) continue
    const u = byId.get(userId)
    claimed.add(userId)
    out.push({
      userIds: [userId],
      name: u?.name || u?.email || userId,
      emails: u?.email ? [u.email] : [],
      subscriptionIds: ids,
      confidence: 'same_account',
    })
  }

  // 2. Two accounts, same name, each paying. Flagged, never acted on.
  const perName = new Map<string, string[]>()
  for (const userId of Array.from(perUser.keys())) {
    const key = nameKey(byId.get(userId)?.name ?? null)
    if (!key) continue
    if (!perName.has(key)) perName.set(key, [])
    perName.get(key)!.push(userId)
  }
  for (const userIds of Array.from(perName.values())) {
    if (userIds.length < 2) continue
    // Already reported as a single-account duplicate? Widen that row rather
    // than reporting the same person twice.
    const existing = out.find((d) => d.userIds.some((id) => userIds.indexOf(id) !== -1))
    const ids = Array.from(
      new Set(userIds.flatMap((id) => (perUser.get(id) ?? []).map((r) => r.stripe_subscription_id as string)))
    )
    if (existing) {
      existing.userIds = Array.from(new Set([...existing.userIds, ...userIds]))
      existing.emails = Array.from(
        new Set(existing.userIds.map((id) => byId.get(id)?.email).filter(Boolean) as string[])
      )
      existing.subscriptionIds = ids
      continue
    }
    userIds.forEach((id) => claimed.add(id))
    const first = byId.get(userIds[0])
    out.push({
      userIds,
      name: first?.name || first?.email || userIds[0],
      emails: userIds.map((id) => byId.get(id)?.email).filter(Boolean) as string[],
      subscriptionIds: ids,
      confidence: 'same_name',
    })
  }

  // Worst first: most subscriptions, then by name so the order is stable.
  return out.sort(
    (a, b) => b.subscriptionIds.length - a.subscriptionIds.length || a.name.localeCompare(b.name)
  )
}

/** One line for the digest, or null when there is nothing to say. */
export function duplicateHeadline(dupes: Duplicate[]): string | null {
  if (dupes.length === 0) return null
  const extra = dupes.reduce((total, d) => total + d.subscriptionIds.length - 1, 0)
  return `${dupes.length} ${dupes.length === 1 ? 'client is' : 'clients are'} paying more than once (${extra} extra ${extra === 1 ? 'subscription' : 'subscriptions'})`
}
