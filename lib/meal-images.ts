/**
 * Photographs for the meal library.
 *
 * The filename is the meal id, so there is no table and nothing to keep in
 * step: meal `b1` is `b1.jpg` in the `meal-images` bucket. Listing the bucket
 * answers the only question the app has — which meals have a picture — and
 * adding one is dropping a file in, not a deploy.
 *
 * Public URLs rather than signed ones. Progress photos are private and signed
 * because they are pictures of a client's body; a photograph of chicken and
 * rice is not, and signing 44 of them would mean 44 round trips to render a
 * list that is supposed to feel instant.
 */

import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export const MEAL_IMAGE_BUCKET = 'meal-images'

/** Accepted extensions, in the order a lookup prefers them. */
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/** The public URL for a stored object. */
export function mealImageUrl(path: string): string {
  const { data } = db.storage.from(MEAL_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl as string
}

/**
 * Which meals have a picture, as meal id → public URL.
 *
 * One listing rather than a probe per meal. A meal with no file simply does
 * not appear, and the card falls back to the layout it has today — which is
 * why a half-finished set of images degrades into "some cards have photos"
 * rather than into broken image icons.
 */
export async function fetchMealImages(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const { data, error } = await db.storage.from(MEAL_IMAGE_BUCKET).list('', { limit: 200 })
    if (error || !data) return out
    for (const file of data as Array<{ name: string }>) {
      const dot = file.name.lastIndexOf('.')
      if (dot <= 0) continue
      const id = file.name.slice(0, dot).toLowerCase()
      const ext = file.name.slice(dot + 1).toLowerCase()
      if (!EXTENSIONS.includes(ext as (typeof EXTENSIONS)[number])) continue
      // First one wins, so a stray b1.png next to b1.jpg cannot flicker
      // between loads depending on listing order.
      if (!out.has(id)) out.set(id, mealImageUrl(file.name))
    }
  } catch {
    // A missing bucket or a network failure means no pictures, not no meals.
  }
  return out
}

/** Upload or replace the picture for one meal. Trainer only — RLS enforces it. */
export async function uploadMealImage(mealId: string, file: File): Promise<string> {
  const dot = file.name.lastIndexOf('.')
  const ext = (dot > 0 ? file.name.slice(dot + 1) : 'jpg').toLowerCase()
  if (!EXTENSIONS.includes(ext as (typeof EXTENSIONS)[number])) {
    throw new Error(`${ext} is not an image this accepts — use jpg, png or webp.`)
  }
  const path = `${mealId.toLowerCase()}.${ext}`
  const { error } = await db.storage
    .from(MEAL_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw error
  return mealImageUrl(path)
}

/** Remove every stored picture for a meal, whatever extension it used. */
export async function removeMealImage(mealId: string): Promise<void> {
  const paths = EXTENSIONS.map((ext) => `${mealId.toLowerCase()}.${ext}`)
  const { error } = await db.storage.from(MEAL_IMAGE_BUCKET).remove(paths)
  // Removing a path that does not exist is not a failure worth surfacing.
  if (error && !/not found/i.test(error.message ?? '')) throw error
}
