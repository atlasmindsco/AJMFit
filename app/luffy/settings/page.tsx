'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { fadeInAdmin as fadeIn } from '@/lib/animations'

type Tab = 'profile' | 'business' | 'notifications' | 'billing'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'business', label: 'Business' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'billing', label: 'Billing' },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display font-extrabold text-3xl uppercase tracking-tight text-white"
        >
          Settings
        </motion.h1>
      </div>

      {/* Tabs */}
      <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-[#F76B16] text-white'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Coach Profile</h2>
            <div className="flex items-center gap-5 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1A7BFF] to-[#1B2D50] flex items-center justify-center">
                <span className="text-white text-xl font-display font-bold">AJ</span>
              </div>
              <div>
                <p className="text-white font-body font-semibold">Anthony M.</p>
                <p className="text-white/30 text-sm font-body">Head Coach &middot; AJM Fit</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Full Name</label>
                <input
                  type="text"
                  defaultValue="Anthony M."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30"
                />
              </div>
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Email</label>
                <input
                  type="email"
                  defaultValue="anthony@ajmfit.com"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30"
                />
              </div>
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Phone</label>
                <input
                  type="tel"
                  defaultValue="(555) 123-4567"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30"
                />
              </div>
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Timezone</label>
                <select className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30">
                  <option>Eastern Time (ET)</option>
                  <option>Central Time (CT)</option>
                  <option>Mountain Time (MT)</option>
                  <option>Pacific Time (PT)</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Bio</label>
              <textarea
                rows={3}
                defaultValue="Certified personal trainer specializing in body transformation, strength training, and nutrition coaching."
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30 resize-none"
              />
            </div>
            <div className="mt-6 flex justify-end">
              <button className="px-6 py-2.5 bg-[#F76B16] text-white text-xs font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200">
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Business Tab */}
      {activeTab === 'business' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Business Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Business Name</label>
                <input type="text" defaultValue="AJM Fit" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30" />
              </div>
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Website</label>
                <input type="url" defaultValue="https://ajmfit.com" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30" />
              </div>
              <div>
                <label className="text-white/25 text-[10px] font-display uppercase tracking-wide block mb-2">Instagram</label>
                <input type="text" defaultValue="@ajmfit" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body focus:outline-none focus:border-[#F76B16]/30" />
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Pricing Tiers</h2>
            <div className="space-y-3">
              {[
                { name: 'The Blueprint', price: '$19.97/mo', features: 'Self-guided — full app access' },
                { name: 'The Accelerator', price: '$397/mo', features: 'Custom program + weekly check-ins' },
                { name: 'The Full Experience', price: '$697/mo', features: 'Everything + 2x live training/week' },
              ].map((tier) => (
                <div key={tier.name} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div>
                    <p className="text-white font-body font-semibold text-sm">{tier.name}</p>
                    <p className="text-white/25 text-xs font-body">{tier.features}</p>
                  </div>
                  <span className="text-[#F76B16] font-display font-bold text-lg">{tier.price}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              { label: 'New client applications', description: 'Get notified when someone applies', enabled: true },
              { label: 'Client messages', description: 'Push notifications for new messages', enabled: true },
              { label: 'Form video uploads', description: 'When clients upload form check videos', enabled: true },
              { label: 'Missed check-ins', description: 'Alert when a client misses a scheduled check-in', enabled: true },
              { label: 'Low compliance alerts', description: 'Clients below 70% weekly compliance', enabled: false },
              { label: 'Weekly summary email', description: 'Receive a weekly business summary every Sunday', enabled: true },
              { label: 'Payment notifications', description: 'Successful and failed payment alerts', enabled: true },
            ].map((notif) => (
              <div key={notif.label} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <p className="text-white font-body font-semibold text-sm">{notif.label}</p>
                  <p className="text-white/25 text-xs font-body">{notif.description}</p>
                </div>
                <div className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${
                  notif.enabled ? 'bg-[#F76B16]' : 'bg-white/[0.08]'
                }`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                    notif.enabled ? 'left-[22px]' : 'left-0.5'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Revenue Overview</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="font-display font-extrabold text-2xl text-[#F76B16]">$5,364</p>
                <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mt-1">This Month</p>
              </div>
              <div className="text-center">
                <p className="font-display font-extrabold text-2xl text-white">$4,790</p>
                <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mt-1">Last Month</p>
              </div>
              <div className="text-center">
                <p className="font-display font-extrabold text-2xl text-emerald-400">+12%</p>
                <p className="text-white/25 text-[10px] font-display uppercase tracking-wide mt-1">Growth</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-white mb-6">Recent Payments</h2>
            <div className="space-y-2">
              {[
                { client: 'Marcus Johnson', amount: '$997', date: 'Mar 15', status: 'paid' },
                { client: 'Sarah Kim', amount: '$497', date: 'Mar 14', status: 'paid' },
                { client: 'Jasmine Torres', amount: '$997', date: 'Mar 12', status: 'paid' },
                { client: 'Tanya Bell', amount: '$497', date: 'Mar 10', status: 'paid' },
                { client: 'David Reeves', amount: '$197', date: 'Mar 8', status: 'paid' },
                { client: 'Chris Okafor', amount: '$997', date: 'Mar 5', status: 'failed' },
              ].map((payment) => (
                <div key={`${payment.client}-${payment.date}`} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${payment.status === 'paid' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-white text-sm font-body font-medium">{payment.client}</p>
                      <p className="text-white/25 text-xs font-body">{payment.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-display font-bold text-sm">{payment.amount}</p>
                    <p className={`text-[10px] font-display uppercase ${
                      payment.status === 'paid' ? 'text-emerald-400' : 'text-red-400'
                    }`}>{payment.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
