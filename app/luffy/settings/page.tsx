'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import { createClient } from '@/lib/supabase/client'
import { fetchCoachSettings, saveCoachSettings, DEFAULT_COACH_SETTINGS, type CoachSettings } from '@/lib/coach'

type Tab = 'profile' | 'business' | 'notifications' | 'billing'

const inputCls =
  'w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/80 font-body focus:outline-none focus:border-[#F76B16]/30'
const labelCls = 'text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2'

const TIERS = [
  { name: 'The Blueprint', price: '$19.97/mo', features: 'Self-guided — full app access' },
  { name: 'The Accelerator', price: '$397/mo', features: 'Custom program + weekly check-ins' },
  { name: 'The Full Experience', price: '$697/mo', features: 'Everything + 2x live training/week' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [authId, setAuthId] = useState<string | null>(null)
  const [s, setS] = useState<CoachSettings>(DEFAULT_COACH_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [revenue, setRevenue] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setAuthId(data.user.id)
      const existing = await fetchCoachSettings(data.user.id)
      if (existing) setS({ ...DEFAULT_COACH_SETTINGS, ...existing })
      setLoading(false)
    })
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then((d) => d && setRevenue(d.revenueMtdCents))
  }, [])

  const set = <K extends keyof CoachSettings>(k: K, v: CoachSettings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  const save = async () => {
    if (!authId) return
    setSaving(true)
    try {
      await saveCoachSettings(authId, s)
      setSaved(true)
    } catch (e) {
      console.error('[settings] save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'business', label: 'Business' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'billing', label: 'Billing' },
  ]

  const SaveBar = (
    <div className="mt-6 flex items-center justify-end gap-3">
      {saved && <span className="text-emerald-400 text-xs font-body">Saved ✓</span>}
      <button onClick={save} disabled={saving || loading} className="px-6 py-2.5 bg-[#F76B16] text-white text-xs font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )

  const toggle = (label: string, description: string, key: keyof CoachSettings) => (
    <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div>
        <p className="text-white font-body font-semibold text-sm">{label}</p>
        <p className="text-white/25 text-xs font-body">{description}</p>
      </div>
      <button onClick={() => set(key, !s[key] as never)} className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${s[key] ? 'bg-[#F76B16]' : 'bg-white/[0.08]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${s[key] ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display font-extrabold text-3xl uppercase tracking-tight text-white">
          Settings
        </motion.h1>
      </div>

      <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1.5">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${activeTab === tab.key ? 'bg-[#F76B16] text-white' : 'text-white/30 hover:text-white/60'}`}>
            {tab.label}
          </button>
        ))}
      </motion.div>

      {activeTab === 'profile' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Coach Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Full Name</label><input className={inputCls} value={s.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
            <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={s.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label className={labelCls}>Phone</label><input type="tel" className={inputCls} value={s.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><label className={labelCls}>Timezone</label>
              <select className={inputCls} value={s.timezone} onChange={(e) => set('timezone', e.target.value)}>
                <option>Eastern Time (ET)</option><option>Central Time (CT)</option><option>Mountain Time (MT)</option><option>Pacific Time (PT)</option>
              </select>
            </div>
          </div>
          <div className="mt-4"><label className={labelCls}>Bio</label><textarea rows={3} className={inputCls + ' resize-none'} value={s.bio} onChange={(e) => set('bio', e.target.value)} /></div>
          {SaveBar}
        </motion.div>
      )}

      {activeTab === 'business' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Business Settings</h2>
            <div className="space-y-4">
              <div><label className={labelCls}>Business Name</label><input className={inputCls} value={s.business_name} onChange={(e) => set('business_name', e.target.value)} /></div>
              <div><label className={labelCls}>Website</label><input type="url" className={inputCls} value={s.website} onChange={(e) => set('website', e.target.value)} /></div>
              <div><label className={labelCls}>Instagram</label><input className={inputCls} value={s.instagram} onChange={(e) => set('instagram', e.target.value)} /></div>
            </div>
            {SaveBar}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Pricing Tiers</h2>
            <div className="space-y-3">
              {TIERS.map((tier) => (
                <div key={tier.name} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div><p className="text-white font-body font-semibold text-sm">{tier.name}</p><p className="text-white/25 text-xs font-body">{tier.features}</p></div>
                  <span className="text-[#F76B16] font-display font-bold text-lg">{tier.price}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Notification Preferences</h2>
          <div className="space-y-4">
            {toggle('New client applications', 'When someone applies for coaching', 'notify_new_application')}
            {toggle('Client messages', 'When a client sends you a message', 'notify_new_message')}
            {toggle('Payment notifications', 'Successful and failed payment alerts', 'notify_payment')}
          </div>
          {SaveBar}
        </motion.div>
      )}

      {activeTab === 'billing' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Revenue</h2>
            <div className="flex items-baseline gap-3">
              <p className="font-display font-extrabold text-3xl text-[#F76B16]">
                {revenue === null ? '—' : `$${(revenue / 100).toLocaleString()}`}
              </p>
              <span className="text-white/30 text-xs font-display uppercase tracking-wide">this month</span>
            </div>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="inline-block mt-5 px-5 py-2.5 bg-white/[0.06] text-white/80 text-xs font-display font-bold uppercase tracking-wide rounded-lg hover:bg-white/[0.1] transition-colors duration-200">
              Manage payments in Stripe →
            </a>
          </div>
        </motion.div>
      )}
    </div>
  )
}
