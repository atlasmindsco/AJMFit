'use client'

/**
 * Your face on your profile.
 *
 * Shown BIG — 128px on the settings screen. A profile photo you have to lean
 * in to recognise is not worth the upload, and the version of this that ships
 * as a 32px circle in a corner is one nobody bothers with twice.
 *
 * The photo lives in a private bucket and is read through a short-lived
 * signed URL, the same way progress photos work. Nothing about a paying
 * client's face needs a permanent public address.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  uploadAvatar,
  signedAvatarUrl,
  fetchAvatarPath,
  saveAvatarPath,
  removeAvatar,
  ALLOWED_TYPES,
  reject,
} from '@/lib/avatar'

export default function ProfilePhoto({
  userId,
  initials,
}: {
  userId: string | null
  /** Shown until there is a photo, and whenever one fails to load. */
  initials: string
}) {
  const [path, setPath] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const show = useCallback(async (p: string | null) => {
    setPath(p)
    setUrl(await signedAvatarUrl(p))
  }, [])

  useEffect(() => {
    let active = true
    if (!userId) return
    fetchAvatarPath(userId)
      .then((p) => {
        if (active) void show(p)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [userId, show])

  const pick = async (file: File | undefined) => {
    setError(null)
    if (!userId || !file) return
    // Checked here as well as inside uploadAvatar so the message arrives
    // before a 20 MB file starts climbing someone's mobile connection.
    const bad = reject(file)
    if (bad) {
      setError(bad.reason)
      return
    }
    setBusy(true)
    try {
      const stored = await uploadAvatar(userId, file)
      await saveAvatarPath(userId, stored)
      await show(stored)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not upload. Try again.')
    } finally {
      setBusy(false)
      // So choosing the same file twice in a row still fires onChange.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clear = async () => {
    if (!userId) return
    setError(null)
    setBusy(true)
    try {
      await removeAvatar(userId, path)
      await show(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
      <p className="font-display font-bold text-white text-sm">Profile photo</p>
      <p className="text-ink-3 text-xs font-body mt-0.5 mb-4 leading-relaxed">
        Optional. Anthony sees it beside your name; nobody else does.
      </p>

      <div className="flex items-center gap-5">
        {/* 128px. Big enough to actually recognise the person in it. */}
        <div className="w-32 h-32 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-brand-orange to-brand-orangedark flex items-center justify-center">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Your profile photo"
              className="w-full h-full object-cover"
              // A signed URL that has expired, or an object that was removed
              // behind our back, falls back to the initials rather than to a
              // broken-image icon.
              onError={() => setUrl(null)}
            />
          ) : (
            <span className="text-white text-3xl font-display font-bold">{initials || '·'}</span>
          )}
        </div>

        <div className="min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || !userId}
            className="px-4 py-3 rounded-control bg-white/[0.06] border border-white/[0.10] text-white text-xs font-display font-bold uppercase tracking-wide hover:bg-white/[0.10] disabled:opacity-40 transition-colors duration-200"
          >
            {busy ? 'Working…' : path ? 'Change photo' : 'Add a photo'}
          </button>
          {path && !busy && (
            <button
              onClick={() => void clear()}
              className="block mt-2 text-ink-3 hover:text-white text-xs font-body underline underline-offset-2 transition-colors duration-200"
            >
              Remove
            </button>
          )}
          <p className="text-ink-4 text-2xs font-body mt-2.5 leading-relaxed">
            JPG, PNG or WEBP, up to 8 MB.
          </p>
        </div>
      </div>

      {error && <p className="text-state-warning text-xs font-body mt-3">{error}</p>}
    </div>
  )
}
