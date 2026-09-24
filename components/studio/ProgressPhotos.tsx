'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  uploadProgressPhoto,
  signedPhotoUrl,
  saveBodyMetric,
  type BodyMetric,
  type PhotoPose,
} from '@/lib/body-metrics'
import { localDate } from '@/lib/dates'

const POSES: Array<{ key: PhotoPose; label: string; column: keyof BodyMetric }> = [
  { key: 'front', label: 'Front', column: 'photo_front_url' },
  { key: 'side', label: 'Side', column: 'photo_side_url' },
  { key: 'back', label: 'Back', column: 'photo_back_url' },
]

/**
 * Optional progress photos for the most recent entry.
 *
 * Optional throughout, and never a blocking step. A mandatory photo upload is
 * where onboarding stops dead for a lot of people, and the camera is the most
 * personal thing this app asks for.
 *
 * The bucket is private and photos are shown through short-lived signed URLs,
 * so no permanent public link to someone's body exists.
 */
export default function ProgressPhotos({
  userId,
  latest,
  onSaved,
}: {
  userId: string
  latest: BodyMetric | null
  onSaved: () => void
}) {
  const [urls, setUrls] = useState<Partial<Record<PhotoPose, string>>>({})
  const [busy, setBusy] = useState<PhotoPose | null>(null)
  const [error, setError] = useState('')
  const inputs = useRef<Partial<Record<PhotoPose, HTMLInputElement | null>>>({})

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!latest) {
        setUrls({})
        return
      }
      const next: Partial<Record<PhotoPose, string>> = {}
      for (const p of POSES) {
        const path = latest[p.column] as string | null
        const url = await signedPhotoUrl(path)
        if (url) next[p.key] = url
      }
      if (active) setUrls(next)
    })()
    return () => {
      active = false
    }
  }, [latest])

  const pick = async (pose: PhotoPose, file: File | undefined) => {
    if (!file) return
    setBusy(pose)
    setError('')
    try {
      const recordedOn = latest?.recorded_on ?? localDate()
      const path = await uploadProgressPhoto(userId, recordedOn, pose, file)
      const column = POSES.find((p) => p.key === pose)!.column
      await saveBodyMetric(userId, { recorded_on: recordedOn, [column]: path })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-4">
      <p className="font-display font-bold text-white text-sm">Progress photos</p>
      <p className="text-white/40 text-xs font-body mt-0.5 mb-3.5 leading-relaxed">
        Optional, and only Anthony can see them. Same spot, same light, once a month is plenty — photos show
        changes the scale misses entirely.
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {POSES.map((p) => (
          <div key={p.key}>
            <button
              onClick={() => inputs.current[p.key]?.click()}
              disabled={busy !== null}
              className="w-full aspect-[3/4] rounded-control border border-dashed border-white/[0.14] bg-white/[0.02] hover:bg-white/[0.05] transition-colors duration-200 overflow-hidden relative flex items-center justify-center disabled:opacity-50"
            >
              {urls[p.key] ? (
                <Image
                  src={urls[p.key]!}
                  alt={`${p.label} progress photo`}
                  fill
                  sizes="(max-width: 640px) 33vw, 180px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-white/25 text-xs font-body">
                  {busy === p.key ? 'Uploading…' : '+ Add'}
                </span>
              )}
            </button>
            <p className="text-white/35 text-[10px] font-display font-bold uppercase tracking-wide text-center mt-1.5">
              {p.label}
            </p>
            <input
              ref={(el) => {
                inputs.current[p.key] = el
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pick(p.key, e.target.files?.[0])}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-state-danger text-xs font-body mt-2">{error}</p>}
    </div>
  )
}
