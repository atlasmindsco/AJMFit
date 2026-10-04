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

      {/* Three switches and a time.
          Not per-event toggles: nobody wants to decide about "missed workout,
          day 4" separately from "day 7", and a twelve-row screen is one people
          skip in favour of silencing the whole app at the operating system.

          There is deliberately no switch for coach messages. If you are paying
          for coaching, a message from your coach is not a notification, it is
          the product. */}
      {userId && <NotificationPrefs userId={userId} />}
    </div>
  )
}

interface Prefs {
  training: boolean
  check_ins: boolean
  progress: boolean
  send_hour: number
}

const DEFAULTS: Prefs = { training: true, check_ins: true, progress: true, send_hour: 18 }

const HOUR_LABEL = (h: number) => {
  const suffix = h < 12 ? 'am' : 'pm'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve}:00 ${suffix}`
}

function NotificationPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any
        const { data } = await db
          .from('notification_prefs')
          .select('training, check_ins, progress, send_hour')
          .eq('user_id', userId)
          .maybeSingle()
        if (!active) return
        // No row means every default, which is all on at 6pm.
        if (data) setPrefs(data as Prefs)
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [userId])

  const write = async (next: Prefs) => {
    setPrefs(next)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      await db.from('notification_prefs').upsert(
        { user_id: userId, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('[Settings] notification prefs save failed', e)
    }
  }

  const rows: Array<{ key: keyof Omit<Prefs, 'send_hour'>; label: string; hint: string }> = [
    { key: 'training', label: 'Training', hint: 'A nudge if you go quiet for a few days.' },
    { key: 'check_ins', label: 'Check-ins', hint: 'A reminder when your weekly check-in is due.' },
    { key: 'progress', label: 'Progress', hint: 'Personal records and finished programs.' },
  ]

  if (!ready) return null

  return (
    <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mt-4">
      <p className="font-display font-bold text-white text-sm">Notifications</p>
      <p className="text-white/40 text-xs font-body mt-0.5 mb-4 leading-relaxed">
        Messages from Coach Anthony always come through &mdash; that&rsquo;s what you&rsquo;re here for.
      </p>

      <div className="space-y-1">
        {rows.map((row) => (
          <label key={row.key} className="flex items-start gap-3 py-2.5 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={prefs[row.key]}
              aria-label={row.label}
              onClick={() => write({ ...prefs, [row.key]: !prefs[row.key] })}
              className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors duration-200 mt-0.5 ${
                prefs[row.key] ? 'bg-brand-blue' : 'bg-white/15'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  prefs[row.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="min-w-0">
              <span className="block text-white text-sm font-body">{row.label}</span>
              <span className="block text-white/35 text-xs font-body mt-0.5">{row.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {/* The control that most decides whether any of the above is welcome.
          A reminder at 6am to someone who trains at 7pm is worse than none. */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <label className="block">
          <span className="block text-white text-sm font-body">Send reminders around</span>
          <select
            value={prefs.send_hour}
            onChange={(e) => write({ ...prefs, send_hour: Number(e.target.value) })}
            className="mt-2 w-full px-3 py-3 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-base font-body focus:outline-none focus:border-brand-blue/50"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {HOUR_LABEL(h)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-white/35 text-xs font-body mt-2">
          Your time.{saved && <span className="text-state-success"> Saved.</span>}
        </p>
      </div>
    </div>
  )
}
