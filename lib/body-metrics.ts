import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Bodyweight, measurements and progress photos over time.
 *
 * Weight used to live on users.current_weight, a single column that was
 * overwritten on every update — so no trend existed for either the client or
 * the coach to look at. These rows are the history.
 */
export interface BodyMetric {
  id: string
  user_id: string
  recorded_on: string
  weight_lb: number | null
  waist_in: number | null
  hips_in: number | null
  chest_in: number | null
  arm_in: number | null
  thigh_in: number | null
  photo_front_url: string | null
  photo_side_url: string | null
  photo_back_url: string | null
  notes: string | null
  created_at: string
}

export type BodyMetricInput = Partial<
  Pick<
    BodyMetric,
    | 'weight_lb'
    | 'waist_in'
    | 'hips_in'
    | 'chest_in'
    | 'arm_in'
    | 'thigh_in'
    | 'photo_front_url'
    | 'photo_side_url'
    | 'photo_back_url'
    | 'notes'
  >
> & { recorded_on?: string }

/** Newest first. */
export async function fetchBodyMetrics(userId: string, limit = 60): Promise<BodyMetric[]> {
  const { data, error } = await db
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_on', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as BodyMetric[]
}

/**
 * One row per client per day, so logging twice in a day corrects the entry
 * rather than creating a second conflicting one.
 */
export async function saveBodyMetric(userId: string, input: BodyMetricInput): Promise<BodyMetric> {
  const recorded_on = input.recorded_on ?? new Date().toISOString().slice(0, 10)
  const { data, error } = await db
    .from('body_metrics')
    .upsert({ ...input, user_id: userId, recorded_on }, { onConflict: 'user_id,recorded_on' })
    .select('*')
    .single()
  if (error) throw error
  return data as BodyMetric
}

export interface WeightTrend {
  latest: number | null
  previous: number | null
  /** Positive means heavier than the comparison point. */
  changeLb: number | null
  /** Change over the last 28 days, the window a coach actually acts on. */
  change28dLb: number | null
  points: Array<{ date: string; weight: number }>
}

/**
 * Weight movement for the client's own view and the coach's review screen.
 * A single weigh-in is noisy, so the 28-day figure is what decisions should
 * hang on, not the week-to-week difference.
 */
export function weightTrend(rows: BodyMetric[]): WeightTrend {
  const weighed = rows
    .filter((r) => r.weight_lb != null)
    .map((r) => ({ date: r.recorded_on, weight: Number(r.weight_lb) }))
  if (weighed.length === 0) {
    return { latest: null, previous: null, changeLb: null, change28dLb: null, points: [] }
  }
  // fetch returns newest first
  const latest = weighed[0]
  const previous = weighed[1] ?? null

  const cutoff = new Date(latest.date)
  cutoff.setDate(cutoff.getDate() - 28)
  const older = weighed.find((w) => new Date(w.date) <= cutoff) ?? weighed[weighed.length - 1]

  return {
    latest: latest.weight,
    previous: previous ? previous.weight : null,
    changeLb: previous ? Math.round((latest.weight - previous.weight) * 10) / 10 : null,
    change28dLb:
      older && older.date !== latest.date
        ? Math.round((latest.weight - older.weight) * 10) / 10
        : null,
    points: [...weighed].reverse(),
  }
}

export type PhotoPose = 'front' | 'side' | 'back'

const BUCKET = 'progress-photos'

/**
 * Uploads a progress photo and returns its storage path.
 *
 * The bucket is private and keyed by {users.id}/..., which is what the storage
 * policies check — a client can only ever write into their own folder. The
 * path, not a URL, is what gets stored on the row: a public URL to a photo of
 * someone's body should not exist, so display goes through a short-lived
 * signed URL instead.
 */
export async function uploadProgressPhoto(
  userId: string,
  recordedOn: string,
  pose: PhotoPose,
  file: File
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${recordedOn}-${pose}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

/** Short-lived read URL. Null when there is no photo or the sign fails. */
export async function signedPhotoUrl(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function deleteProgressPhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
