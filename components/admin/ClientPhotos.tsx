'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { fetchBodyMetrics, signedPhotoUrl, weightTrend, type BodyMetric } from '@/lib/body-metrics'

interface Shot {
  date: string
  urls: string[]
}

/**
 * The client's weight trend and most recent progress photos, for the coach.
 *
 * Photos the coach cannot see would be pointless, and weight was previously
 * invisible to them entirely — it lived on a single overwritten column with no
 * history. Signed URLs are generated per view; the bucket stays private.
 */
export default function ClientPhotos({ userId }: { userId: string }) {
  const [rows, setRows] = useState<BodyMetric[]>([])
  const [shots, setShots] = useState<Shot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await fetchBodyMetrics(userId, 40)
        if (!active) return
        setRows(data)

        // Oldest and newest entries that carry photos — the pair worth seeing.
        const withPhotos = data.filter(
          (m) => m.photo_front_url || m.photo_side_url || m.photo_back_url
        )
        const picks = withPhotos.length > 1 ? [withPhotos[withPhotos.length - 1], withPhotos[0]] : withPhotos
        const out: Shot[] = []
        for (const m of picks) {
          const urls: string[] = []
          for (const p of [m.photo_front_url, m.photo_side_url, m.photo_back_url]) {
            const u = await signedPhotoUrl(p)
            if (u) urls.push(u)
          }
          if (urls.length) out.push({ date: m.recorded_on, urls })
        }
        if (active) setShots(out)
      } catch (e) {
        console.error('[ClientPhotos] load failed', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [userId])

  if (loading) return null

  const trend = weightTrend(rows)
  if (trend.latest == null && shots.length === 0) {
    return (
      <div className="sm:col-span-2 mt-1 pt-4 border-t border-white/[0.06]">
        <p className="text-brand-orange text-[10px] font-display font-bold uppercase tracking-wide mb-2">
          Progress
        </p>
        <p className="text-white/35 text-sm font-body">No weigh-ins or photos yet.</p>
      </div>
    )
  }

  return (
    <div className="sm:col-span-2 mt-1 pt-4 border-t border-white/[0.06]">
      <p className="text-brand-orange text-[10px] font-display font-bold uppercase tracking-wide mb-2">
        Progress
      </p>

      {trend.latest != null && (
        <div className="flex items-end gap-6 mb-4">
          <div>
            <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">Current</p>
            <p className="font-display font-extrabold text-2xl text-white tabular-nums">
              {trend.latest}
              <span className="text-white/30 text-xs font-body ml-1">lbs</span>
            </p>
          </div>
          {trend.change28dLb != null && (
            <div>
              <p className="text-white/25 text-[10px] font-display uppercase tracking-wide">28 days</p>
              <p
                className={`font-display font-extrabold text-2xl tabular-nums ${
                  trend.change28dLb === 0 ? 'text-white/50' : 'text-brand-orange'
                }`}
              >
                {trend.change28dLb > 0 ? '+' : ''}
                {trend.change28dLb}
              </p>
            </div>
          )}
        </div>
      )}

      {shots.length > 0 && (
        <div className="space-y-3">
          {shots.map((s, i) => (
            <div key={s.date}>
              <p className="text-white/30 text-[10px] font-display font-bold uppercase tracking-wide mb-1.5">
                {shots.length > 1 && i === 0 ? 'First' : shots.length > 1 ? 'Latest' : 'Photos'} ·{' '}
                {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <div className="flex gap-2">
                {s.urls.map((u) => (
                  <div key={u} className="relative w-20 aspect-[3/4] rounded-control overflow-hidden bg-white/[0.04]">
                    <Image src={u} alt="Progress photo" fill sizes="80px" className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
