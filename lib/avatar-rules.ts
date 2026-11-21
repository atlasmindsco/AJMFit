/**
 * What counts as a usable profile photo, and where it gets stored.
 *
 * Separate from lib/avatar.ts, which does the uploading, because that file
 * loads the Supabase client at import time and a module that does cannot be
 * run by a verifier outside a browser. These are the rules worth pinning, so
 * they live where they can be checked. (Learned the hard way an hour ago,
 * doing exactly this wrong in lib/progress-lines.ts.)
 */

export const AVATAR_BUCKET = 'profile-photos'

/**
 * What a phone camera produces and a browser can actually draw.
 *
 * HEIC is deliberately absent. An iPhone photo picked straight from the
 * library arrives as HEIC, Chrome and Firefox cannot render it, and the
 * client would upload successfully and then stare at a broken image. iOS
 * converts to JPEG when the file input accepts only these types — so the
 * narrower list is what makes it work, not what restricts it.
 */
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** 8 MB. A modern phone photo is 2-5 MB; past this it is a mistake. */
export const MAX_BYTES = 8 * 1024 * 1024

/** The extension to store a file under, from its MIME type. */
export function extensionFor(type: string): string | null {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return null
}

/**
 * Where this client's avatar lives.
 *
 * The user id is the FIRST path segment because that is exactly what the
 * storage policies check — a client can only ever write inside their own
 * folder. Always the same filename for a given type, so uploading again
 * replaces rather than accumulates.
 */
export function avatarPathFor(userId: string, type: string): string | null {
  const ext = extensionFor(type)
  if (!ext) return null
  const id = String(userId ?? '').trim()
  // A path that does not start with their own id would be rejected by the
  // policy anyway, but building one at all is the kind of mistake worth
  // refusing here rather than discovering as a storage error.
  if (!id || id.indexOf('/') !== -1 || id.indexOf('..') !== -1) return null
  return `${id}/avatar.${ext}`
}

export interface Rejection {
  reason: string
}

/** Why this file cannot be used, in words a client reads, or null if it can. */
export function reject(file: { type: string; size: number } | null | undefined): Rejection | null {
  if (!file) return { reason: 'No file chosen.' }
  if (ALLOWED_TYPES.indexOf(file.type) === -1) {
    return { reason: 'That needs to be a JPG, PNG or WEBP.' }
  }
  if (!(file.size > 0)) return { reason: 'That file is empty.' }
  if (file.size > MAX_BYTES) {
    return { reason: `That photo is ${Math.round(file.size / 1024 / 1024)} MB. Keep it under 8.` }
  }
  return null
}
