/**
 * A face on the profile, instead of two letters cut from a name.
 *
 * Private bucket, signed URLs, and the same {users.id}/... keying as progress
 * photos — one storage rule to understand rather than two. A permanent public
 * URL to a paying client's face is not worth creating by default when the
 * signed path already exists and costs nothing.
 *
 * The rules about what counts as a usable photo live in lib/avatar-rules.ts,
 * where a verifier can reach them. This file is the plumbing.
 */
import { supabase } from '@/lib/supabase'
import { AVATAR_BUCKET, avatarPathFor, reject } from '@/lib/avatar-rules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export { AVATAR_BUCKET, ALLOWED_TYPES, MAX_BYTES, reject } from '@/lib/avatar-rules'

/** Uploads and returns the stored path. Throws with a message worth showing. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const bad = reject(file)
  if (bad) throw new Error(bad.reason)

  const path = avatarPathFor(userId, file.type)
  if (!path) throw new Error('That needs to be a JPG, PNG or WEBP.')

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  return path
}

/**
 * Short-lived read URL. Null when there is no photo or the sign fails.
 *
 * An hour, matching progress photos: long enough that the nav is not
 * re-signing on every render, short enough that a URL copied out of devtools
 * stops working the same day.
 */
export async function signedAvatarUrl(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, seconds)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function fetchAvatarPath(userId: string): Promise<string | null> {
  const { data } = await db.from('users').select('avatar_path').eq('id', userId).maybeSingle()
  return (data as { avatar_path?: string | null } | null)?.avatar_path ?? null
}

/**
 * Point the client's row at a photo, or at nothing.
 *
 * The ROW COUNT is checked, not just the error. PostgREST reports an
 * RLS-filtered update as a success with zero rows, so a write that touched
 * nobody looks exactly like one that worked — which is how a photo appears to
 * save and is gone on the next load.
 */
export async function saveAvatarPath(userId: string, path: string | null): Promise<void> {
  const { data, error } = await db
    .from('users')
    .update({ avatar_path: path })
    .eq('id', userId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Could not save that photo. Try again.')
}

/**
 * Take the photo off the profile and out of storage.
 *
 * The row is cleared FIRST. If the storage delete then fails the client still
 * has no avatar, which is what they asked for. The other order can leave the
 * row pointing at a file that no longer exists, and a broken image is worse
 * than no image.
 */
export async function removeAvatar(userId: string, path: string | null): Promise<void> {
  await saveAvatarPath(userId, null)
  if (!path) return
  try {
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
  } catch {
    // The profile is already clear. A leftover object is tidying, not a
    // failure worth showing someone who asked to remove their photo.
  }
}
