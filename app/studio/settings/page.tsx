'use client'

import { useEffect, useState } from 'react'
import { getCurrentUserId } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'
import { localDate } from '@/lib/dates'

/**
 * Common zones, plus whatever the device reports if it is not already listed.
 * A full IANA list is several hundred entries and would bury the answer almost
 * everyone needs.
 */
const COMMON_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'Europe/London',
]

const zoneLabel = (tz: string) => {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
  try {
    const abbr = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value
    return abbr ? `${city} (${abbr})` : city
  } catch {
    return city
  }
}

const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

export default function StudioSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const device = deviceZone()

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!active) return
      setUserId(id)
      if (!id) {
        setLoading(false)
        return
      }
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data } = await db.from('users').select('timezone').eq('id', id).maybeSingle()
      if (!active) return
      setTimezone((data?.timezone as string) || device)
      setLoading(false)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (tz: string) => {
    setTimezone(tz)
    if (!userId) return
    setSaving(true)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      await db.from('users').update({ timezone: tz }).eq('id', userId)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('[Settings] save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const zones = COMMON_ZONES.includes(device) ? COMMON_ZONES : [device, ...COMMON_ZONES]

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Settings</h1>
      </header>

      <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5">
        <p className="font-display font-bold text-white text-sm">Time zone</p>
        <p className="text-white/40 text-xs font-body mt-0.5 mb-3.5 leading-relaxed">
          Decides when your day rolls over. Your food and workouts reset at midnight here, not anywhere else.
        </p>

        <select
          value={timezone}
          onChange={(e) => save(e.target.value)}
          disabled={saving}
          className="w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body focus:outline-none focus:border-brand-blue/50 disabled:opacity-50"
        >
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {zoneLabel(tz)}
              {tz === device ? ' — your device' : ''}
            </option>
          ))}
        </select>

        <p className="text-white/35 text-xs font-body mt-3">
          Today is{' '}
          <span className="text-white/70">
            {new Date(localDate() + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          .{saved && <span className="text-state-success"> Saved.</span>}
        </p>
      </div>
    </div>
  )
}
