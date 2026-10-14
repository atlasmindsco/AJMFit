/**
 * AJM Recommends: the products Anthony points clients at, and the rules about
 * how they may be described.
 *
 * The constants below are not decoration. A coach recommending products he
 * earns from, to people paying him for impartial advice, is a conflict of
 * interest — disclosure is the thing that makes it legitimate rather than
 * something a client feels misled by later. So the wording is first person
 * ("I earn a commission"), it appears everywhere a product does, and it is a
 * constant rather than something each screen writes for itself.
 */

import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Recommendation {
  id: string
  name: string
  category: string
  image_url: string | null
  why_recommended: string | null
  what_it_is: string | null
  who_it_suits: string | null
  how_used: string | null
  worth_knowing: string | null
  external_url: string
  merchant: string
  sort_order: number
  is_active: boolean
  is_featured: boolean
  disclosure_note: string | null
}

/**
 * Said in the first person, because Anthony is the one recommending.
 *
 * "Affiliate relationships may exist" is the phrasing of someone hoping not to
 * be read. This is short enough to actually read and plain enough to be
 * understood on a first pass.
 */
export const DISCLOSURE_SHORT = 'I earn a commission on purchases made through these links.'

export const DISCLOSURE_FULL =
  'These are products I use and rate. None of them are required — your program and your nutrition targets work exactly the same without them. I earn a commission on purchases made through these links.'

/**
 * Shown wherever a product is described in any detail.
 *
 * Supplements are regulated and this app is used by people on medication and
 * by people who are pregnant. The line is deliberately about talking to a
 * doctor rather than about what any product does.
 */
export const SAFETY_NOTE =
  'Supplements are optional. If you are pregnant, taking medication, or managing a health condition, talk to your doctor before starting anything new.'

/**
 * The categories offered, in display order.
 *
 * Only ones with products appear — six headings over eight products makes a
 * catalogue look thin, three makes it look chosen. Free text in the database,
 * so adding one is a row rather than a migration.
 */
export const CATEGORIES = [
  'Protein',
  'Vitamins & wellness',
  'Hydration',
  'Performance',
  'Recovery',
  'Convenience',
] as const

/** Published products, in the order Anthony set. */
export async function fetchRecommendations(): Promise<Recommendation[]> {
  const { data } = await db
    .from('product_recommendations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  return (data ?? []) as Recommendation[]
}

/** Everything, published or not. Trainer only — RLS enforces it. */
export async function fetchAllRecommendations(): Promise<Recommendation[]> {
  const { data } = await db
    .from('product_recommendations')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  return (data ?? []) as Recommendation[]
}

export async function saveRecommendation(
  input: Partial<Recommendation> & { name: string; category: string; external_url: string }
): Promise<void> {
  const row = { ...input, updated_at: new Date().toISOString() }
  const { error } = input.id
    ? await db.from('product_recommendations').update(row).eq('id', input.id)
    : await db.from('product_recommendations').insert(row)
  if (error) throw error
}

export async function deleteRecommendation(id: string): Promise<void> {
  const { error } = await db.from('product_recommendations').delete().eq('id', id)
  if (error) throw error
}

/**
 * Record that a product was opened.
 *
 * No user id, by design — see the migration. Failure is swallowed: a client
 * tapping through to a store must never be held up, or shown an error, because
 * a counter did not write.
 */
export async function recordClick(productId: string): Promise<void> {
  try {
    await db.from('product_clicks').insert({ product_id: productId })
  } catch {
    /* counting is not worth interrupting anyone for */
  }
}

/** Click counts per product, for the admin screen. Trainer only. */
export async function fetchClickCounts(): Promise<Map<string, number>> {
  const { data } = await db.from('product_clicks').select('product_id')
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ product_id: string }>) {
    counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)
  }
  return counts
}

/** Products grouped into the categories that actually have something in them. */
export function byCategory(items: Recommendation[]): Array<{ category: string; items: Recommendation[] }> {
  const groups = new Map<string, Recommendation[]>()
  for (const item of items) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  // Known categories first, in their declared order, then anything bespoke.
  // forEach rather than spreading the key iterator: this project targets ES5
  // and spreading a Map iterator needs downlevelIteration.
  const known: string[] = CATEGORIES.filter((c) => groups.has(c))
  const extra: string[] = []
  groups.forEach((_, key) => {
    if (!CATEGORIES.includes(key as (typeof CATEGORIES)[number])) extra.push(key)
  })
  extra.sort()
  return known.concat(extra).map((category) => ({ category, items: groups.get(category)! }))
}

/** Does this product have enough written about it to be worth a detail sheet? */
export function hasDetail(item: Recommendation): boolean {
  return Boolean(item.what_it_is || item.who_it_suits || item.how_used || item.worth_knowing)
}
