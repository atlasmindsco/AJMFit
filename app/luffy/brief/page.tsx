'use client'

import { useState } from 'react'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const competitors = [
  { name: 'Trainwell (CoPilot)', price: 99, model: '1:1 dedicated coach', features: 'Custom workouts, unlimited messaging, video calls, nutrition guidance' },
  { name: 'Future', price: 199, model: '1:1 dedicated coach', features: 'Custom programming, daily accountability texts, video feedback' },
  { name: 'Caliber Premium', price: 200, model: '1:1 certified coach', features: 'Science-based programming, nutrition coaching, weekly lessons' },
  { name: 'Caliber Plus', price: 266, model: '1:1 + monthly Zoom', features: 'Everything in Premium + monthly live strategy calls' },
  { name: 'Tailored Coaching (Basic)', price: 347, model: '1:1 nutrition-only', features: 'Custom macros, weekly video check-ins, form feedback' },
  { name: 'Tailored Coaching (All-In)', price: 497, model: '1:1 full coaching', features: 'Custom training + nutrition, weekly calls, form checks' },
  { name: 'WarriorBabe (Standard)', price: 400, model: '1:1 specialized', features: 'Dedicated coach, custom programming, weekly check-ins' },
  { name: 'WarriorBabe (Premium)', price: 700, model: '1:1 high-touch', features: 'Daily check-ins, real-time adjustments, specialized expertise' },
]

const ajmTiers = [
  { name: 'The Blueprint', price: 297, weekly: 74, color: '#1A7BFF', features: ['Custom 3-4 day/week program', 'New plan every 30 days (3 phases)', 'Scaled to your equipment', 'M-F messaging access', 'Supplement recommendations'] },
  { name: 'The Accelerator', price: 497, weekly: 124, color: '#F76B16', popular: true, features: ['Everything in The Blueprint', 'Weekly 30-45 min video check-in', 'Form feedback via video review', 'Progress tracking & adjustments', 'Priority response M-F'] },
  { name: 'The Full Experience', price: 697, weekly: 174, color: '#1B2D50', features: ['Everything in The Accelerator', '2x live 45-min virtual sessions/week', 'Real-time coaching & intensity', 'Live form correction every session'] },
]

const platformFeatures = [
  { feature: 'Custom workout programs', ajm: true, future: true, caliber: true, trainwell: true },
  { feature: 'Weight & reps logging', ajm: true, future: true, caliber: true, trainwell: true },
  { feature: 'PR tracking with history', ajm: true, future: false, caliber: true, trainwell: false },
  { feature: 'Exercise swap/alternatives', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Muscle map visualization', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Macro & calorie tracking', ajm: true, future: false, caliber: true, trainwell: false },
  { feature: 'Full meal plan with macros', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Hydration tracking', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Supplement checklist', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Weekly calorie trends', ajm: true, future: false, caliber: true, trainwell: false },
  { feature: 'Daily habit checklist', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Community forum', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Leaderboard & points', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Community events & Q&As', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'AI assistant (Chea)', ajm: true, future: false, caliber: false, trainwell: false },
  { feature: 'Coach admin dashboard', ajm: true, future: true, caliber: true, trainwell: true },
]

const commitmentDiscounts = [
  { period: 'Month-to-month', blueprint: 297, accelerator: 497, full: 697, discount: '' },
  { period: '3-month (save 10%)', blueprint: 267, accelerator: 447, full: 627, discount: '10%' },
  { period: '6-month (save 15%)', blueprint: 252, accelerator: 422, full: 592, discount: '15%' },
]

const marketTiers = [
  { model: 'DIY / App-Only', range: '$30 – $100', avg: 65, color: '#94A3B8' },
  { model: 'Group / Hybrid', range: '$100 – $300', avg: 200, color: '#1A7BFF' },
  { model: 'Standard 1:1', range: '$200 – $500', avg: 350, color: '#F76B16' },
  { model: 'Premium 1:1', range: '$350 – $800+', avg: 575, color: '#1B2D50' },
]

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function Check() {
  return (
    <svg className="w-5 h-5 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function X() {
  return (
    <svg className="w-5 h-5 text-red-400/60 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SectionHeader({ label, title, subtitle }: { label: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-10">
      <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-brand-orange mb-3">{label}</span>
      <h2 className="font-display text-3xl sm:text-4xl font-bold text-brand-navy tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-brand-slate text-lg max-w-2xl leading-relaxed">{subtitle}</p>}
    </div>
  )
}

function StatCard({ value, label, sublabel }: { value: string; label: string; sublabel?: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] border border-brand-offwhite">
      <div className="text-3xl sm:text-4xl font-display font-bold text-brand-navy tracking-tight">{value}</div>
      <div className="text-sm font-semibold text-brand-slate mt-1 uppercase tracking-wide">{label}</div>
      {sublabel && <div className="text-xs text-brand-slate/70 mt-1">{sublabel}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BriefPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'competitors' | 'features' | 'recommendations'>('overview')

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'competitors' as const, label: 'Competitors' },
    { id: 'features' as const, label: 'Feature Matrix' },
    { id: 'recommendations' as const, label: 'Recommendations' },
  ]

  return (
    <div className="min-h-screen bg-brand-offwhite">
      {/* Header */}
      <header className="bg-brand-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-brand-orange flex items-center justify-center">
              <span className="font-display font-bold text-sm tracking-tight">AJM</span>
            </div>
            <span className="text-sm font-semibold tracking-[0.15em] uppercase text-white/50">Pricing Brief</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            Online Fitness Coaching<br />
            <span className="text-brand-orange">Pricing Benchmark Report</span>
          </h1>
          <p className="mt-5 text-white/60 text-lg max-w-xl leading-relaxed">
            Competitive analysis, platform value premium, and pricing recommendations for AJM FIT — 2025-2026.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/40">
            <span className="bg-white/10 rounded-full px-4 py-1.5">Prepared April 2026</span>
            <span className="bg-white/10 rounded-full px-4 py-1.5">13 Sources Cited</span>
            <span className="bg-white/10 rounded-full px-4 py-1.5">Confidential</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="sticky top-0 z-30 bg-white border-b border-brand-offwhite shadow-[0_2px_8px_rgba(27,45,80,0.04)]">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-5 text-sm font-semibold tracking-wide whitespace-nowrap border-b-2 transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'border-brand-orange text-brand-navy'
                  : 'border-transparent text-brand-slate hover:text-brand-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">

        {/* ============ OVERVIEW ============ */}
        {activeTab === 'overview' && (
          <div className="space-y-16">
            {/* Executive Summary */}
            <section>
              <SectionHeader label="Executive Summary" title="Your pricing is correct." subtitle="The primary opportunity isn't a price change — it's adding a self-guided entry tier and commitment discounts." />
              <div className="bg-white rounded-2xl p-8 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-brand-navy font-semibold text-lg leading-snug">All three tiers ($297 / $497 / $697) are market-aligned and correctly priced.</p>
                    <p className="text-brand-slate mt-2 leading-relaxed">
                      AJM FIT competes in the Standard-to-Premium 1:1 coaching segment. The platform&apos;s feature depth — AI assistant, community, macro tracking, exercise swaps — exceeds every direct competitor. The $200 gap between tiers is well-structured, with each jump adding clear, tangible service upgrades.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Stats Grid */}
            <section>
              <SectionHeader label="At a Glance" title="Key numbers from the research" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard value="$350" label="Market Average" sublabel="Standard 1:1 coaching/mo" />
                <StatCard value="12-15" label="Unique Features" sublabel="Not offered by competitors" />
                <StatCard value="50-100%" label="Platform Premium" sublabel="Over PDF/WhatsApp delivery" />
                <StatCard value="$79" label="Suggested New Tier" sublabel="Self-guided platform access" />
              </div>
            </section>

            {/* Current Tiers */}
            <section>
              <SectionHeader label="Current Pricing" title="AJM FIT coaching tiers" subtitle="Where each tier lands relative to the market." />
              <div className="grid sm:grid-cols-3 gap-5">
                {ajmTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`relative bg-white rounded-2xl p-7 border shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] ${
                      tier.popular ? 'border-brand-orange ring-2 ring-brand-orange/20' : 'border-brand-offwhite'
                    }`}
                  >
                    {tier.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-orange text-white text-xs font-bold tracking-wider uppercase px-4 py-1 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <div className="text-xs font-semibold tracking-[0.15em] uppercase mb-2" style={{ color: tier.color }}>{tier.name}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-display font-bold text-brand-navy">${tier.price}</span>
                      <span className="text-brand-slate text-sm">/mo</span>
                    </div>
                    <div className="text-sm text-brand-slate mt-1">${tier.weekly}/week</div>
                    <div className="mt-5 space-y-2.5">
                      {tier.features.map((f) => (
                        <div key={f} className="flex items-start gap-2.5 text-sm text-brand-navy">
                          <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-5 border-t border-brand-offwhite">
                      <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1.5 inline-block">
                        Market-aligned — no change needed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Market Tiers */}
            <section>
              <SectionHeader label="Market Context" title="Where AJM FIT sits in the industry" />
              <div className="space-y-4">
                {marketTiers.map((tier) => (
                  <div key={tier.model} className="bg-white rounded-xl p-5 border border-brand-offwhite flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="sm:w-48 flex-shrink-0">
                      <div className="font-semibold text-brand-navy">{tier.model}</div>
                      <div className="text-sm text-brand-slate">{tier.range}/mo</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 bg-brand-offwhite rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(tier.avg / 800) * 100}%`, backgroundColor: tier.color }}
                        />
                      </div>
                    </div>
                    <div className="sm:w-24 text-right">
                      <span className="font-display font-bold text-brand-navy text-lg">${tier.avg}</span>
                      <span className="text-xs text-brand-slate block">avg</span>
                    </div>
                  </div>
                ))}
                <div className="bg-brand-navy/5 rounded-xl p-5 border border-brand-navy/10 mt-2">
                  <p className="text-sm text-brand-navy">
                    <strong>Blueprint ($297)</strong> sits in the Standard 1:1 range. <strong>Accelerator ($497)</strong> at the top of Standard 1:1. <strong>Full Experience ($697)</strong> lands in Premium 1:1 territory — all defensible given AJM FIT&apos;s platform depth.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============ COMPETITORS ============ */}
        {activeTab === 'competitors' && (
          <div className="space-y-16">
            <section>
              <SectionHeader
                label="Competitive Landscape"
                title="Direct competitor pricing"
                subtitle="Solo online coaches and coach-led platforms that bundle app/portal access with coaching."
              />

              {/* Competitor Bar Chart */}
              <div className="bg-white rounded-2xl p-8 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] mb-8">
                <div className="space-y-4">
                  {[...competitors, ...ajmTiers.map(t => ({ name: `AJM FIT — ${t.name}`, price: t.price, model: '', features: '' }))].sort((a, b) => a.price - b.price).map((c) => {
                    const isAjm = c.name.startsWith('AJM')
                    return (
                      <div key={c.name} className="flex items-center gap-4">
                        <div className="w-48 sm:w-56 flex-shrink-0 text-right">
                          <span className={`text-sm font-medium ${isAjm ? 'text-brand-orange font-bold' : 'text-brand-navy'}`}>{c.name}</span>
                        </div>
                        <div className="flex-1 h-8 bg-brand-offwhite rounded-lg overflow-hidden relative">
                          <div
                            className={`h-full rounded-lg transition-all duration-500 ${isAjm ? 'bg-brand-orange' : 'bg-brand-navy/20'}`}
                            style={{ width: `${(c.price / 700) * 100}%` }}
                          />
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isAjm ? 'text-brand-orange' : 'text-brand-navy/60'}`}>
                            ${c.price}/mo
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Competitor Table */}
              <div className="bg-white rounded-2xl border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-offwhite">
                      <th className="text-left p-4 font-semibold text-brand-navy">Competitor</th>
                      <th className="text-left p-4 font-semibold text-brand-navy">Price/mo</th>
                      <th className="text-left p-4 font-semibold text-brand-navy">Coaching Model</th>
                      <th className="text-left p-4 font-semibold text-brand-navy hidden lg:table-cell">Key Features</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map((c) => (
                      <tr key={c.name} className="border-b border-brand-offwhite/50 hover:bg-brand-offwhite/30 transition-colors">
                        <td className="p-4 font-medium text-brand-navy">{c.name}</td>
                        <td className="p-4 font-display font-bold text-brand-navy">${c.price}</td>
                        <td className="p-4 text-brand-slate">{c.model}</td>
                        <td className="p-4 text-brand-slate hidden lg:table-cell">{c.features}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Platform Premium */}
            <section>
              <SectionHeader
                label="Platform Value"
                title="The tech-enabled coaching premium"
                subtitle="Coaches using a dedicated app/portal command significantly higher rates than those delivering via PDFs or WhatsApp."
              />
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <div className="text-xs font-semibold tracking-[0.15em] uppercase text-red-400 mb-3">Without Platform</div>
                  <div className="text-3xl font-display font-bold text-brand-navy">$100 – $200<span className="text-lg font-normal text-brand-slate">/mo</span></div>
                  <p className="text-sm text-brand-slate mt-3 leading-relaxed">PDF programs, WhatsApp check-ins, spreadsheet tracking. Fragmented experience, low accountability infrastructure.</p>
                </div>
                <div className="bg-white rounded-2xl p-7 border border-emerald-200 shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] ring-2 ring-emerald-100">
                  <div className="text-xs font-semibold tracking-[0.15em] uppercase text-emerald-600 mb-3">With Platform (AJM FIT)</div>
                  <div className="text-3xl font-display font-bold text-brand-navy">$200 – $600+<span className="text-lg font-normal text-brand-slate">/mo</span></div>
                  <p className="text-sm text-brand-slate mt-3 leading-relaxed">Branded portal, full tracking, AI assistant, community, accountability systems. 50-100% price premium justified by platform.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============ FEATURE MATRIX ============ */}
        {activeTab === 'features' && (
          <div className="space-y-16">
            <section>
              <SectionHeader
                label="Feature Comparison"
                title="AJM FIT vs. leading competitors"
                subtitle="AJM FIT includes 12-15 features that no direct competitor offers. The platform itself is a major differentiator."
              />
              <div className="bg-white rounded-2xl border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-brand-offwhite">
                      <th className="text-left p-4 font-semibold text-brand-navy">Feature</th>
                      <th className="p-4 font-semibold text-brand-orange text-center">AJM FIT</th>
                      <th className="p-4 font-semibold text-brand-slate text-center">Future<br /><span className="font-normal text-xs">$199/mo</span></th>
                      <th className="p-4 font-semibold text-brand-slate text-center">Caliber<br /><span className="font-normal text-xs">$200/mo</span></th>
                      <th className="p-4 font-semibold text-brand-slate text-center">Trainwell<br /><span className="font-normal text-xs">$99/mo</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformFeatures.map((f, i) => (
                      <tr key={f.feature} className={`border-b border-brand-offwhite/50 ${i % 2 === 0 ? 'bg-brand-offwhite/20' : ''}`}>
                        <td className="p-4 font-medium text-brand-navy">{f.feature}</td>
                        <td className="p-4 text-center">{f.ajm ? <Check /> : <X />}</td>
                        <td className="p-4 text-center">{f.future ? <Check /> : <X />}</td>
                        <td className="p-4 text-center">{f.caliber ? <Check /> : <X />}</td>
                        <td className="p-4 text-center">{f.trainwell ? <Check /> : <X />}</td>
                      </tr>
                    ))}
                    <tr className="bg-brand-navy/5">
                      <td className="p-4 font-bold text-brand-navy">Total Features</td>
                      <td className="p-4 text-center font-display font-bold text-brand-orange text-lg">16/16</td>
                      <td className="p-4 text-center font-display font-bold text-brand-slate text-lg">5/16</td>
                      <td className="p-4 text-center font-display font-bold text-brand-slate text-lg">6/16</td>
                      <td className="p-4 text-center font-display font-bold text-brand-slate text-lg">4/16</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-8 bg-brand-orange/5 rounded-xl p-6 border border-brand-orange/15">
                <p className="text-sm text-brand-navy leading-relaxed">
                  <strong>Key insight:</strong> Competitors charge $99-$266/mo for coaching with 4-6 platform features.
                  AJM FIT delivers 16 features including an AI assistant, community ecosystem, and comprehensive nutrition tracking — at a comparable effective cost per feature.
                  The platform alone would cost clients $30-$50/mo if purchased as standalone apps.
                </p>
              </div>
            </section>

            {/* AI & Community Premium */}
            <section>
              <SectionHeader label="Differentiators" title="Features no competitor offers" />
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <div className="text-2xl mb-3">AI</div>
                  <h3 className="font-display font-bold text-xl text-brand-navy">Chea AI Assistant</h3>
                  <p className="text-sm text-brand-slate mt-2 leading-relaxed">
                    Context-aware AI chat powered by GPT-4o-mini. Answers training and nutrition questions instantly. Standalone AI fitness apps charge $10-$30/mo — AJM FIT includes it in every tier.
                  </p>
                  <div className="mt-4 text-xs font-semibold text-brand-blue">AI fitness market: $16.9B (2025) projected $35B+ by 2030</div>
                </div>
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <div className="text-2xl mb-3">Community</div>
                  <h3 className="font-display font-bold text-xl text-brand-navy">Forum, Leaderboard & Events</h3>
                  <p className="text-sm text-brand-slate mt-2 leading-relaxed">
                    Community features drive 60-80% adherence rates vs. 10-25% for budget apps. Forums, points/leaderboards, live Q&As, and monthly challenges create accountability that no competitor offers.
                  </p>
                  <div className="mt-4 text-xs font-semibold text-brand-blue">Justifies $20-$50/mo in additional perceived value</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============ RECOMMENDATIONS ============ */}
        {activeTab === 'recommendations' && (
          <div className="space-y-16">
            {/* Pricing Recommendation */}
            <section>
              <SectionHeader
                label="Recommendation #1"
                title="Keep current pricing. Add a self-guided tier."
                subtitle="The primary strategic gap is the absence of a lower-entry tier — not a mispricing of existing tiers."
              />
              <div className="bg-white rounded-2xl border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-brand-offwhite">
                      <th className="text-left p-4 font-semibold text-brand-navy">Tier</th>
                      <th className="p-4 font-semibold text-brand-navy text-center">Current</th>
                      <th className="p-4 font-semibold text-brand-navy text-center">Suggested</th>
                      <th className="p-4 font-semibold text-brand-navy text-center">Change</th>
                      <th className="text-left p-4 font-semibold text-brand-navy hidden lg:table-cell">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-brand-offwhite/50 bg-emerald-50/30">
                      <td className="p-4 font-bold text-brand-navy">Platform Access <span className="text-xs text-emerald-600 font-semibold ml-1">NEW</span></td>
                      <td className="p-4 text-center text-brand-slate">—</td>
                      <td className="p-4 text-center font-display font-bold text-emerald-600 text-lg">$79/mo</td>
                      <td className="p-4 text-center"><span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">New tier</span></td>
                      <td className="p-4 text-brand-slate hidden lg:table-cell">Full app access, AI assistant, community, pre-built programs. No coaching.</td>
                    </tr>
                    <tr className="border-b border-brand-offwhite/50">
                      <td className="p-4 font-bold text-brand-navy">The Blueprint</td>
                      <td className="p-4 text-center font-display font-bold text-brand-navy">$297</td>
                      <td className="p-4 text-center font-display font-bold text-brand-navy">$297</td>
                      <td className="p-4 text-center"><span className="text-xs font-semibold bg-brand-offwhite text-brand-slate px-3 py-1 rounded-full">No change</span></td>
                      <td className="p-4 text-brand-slate hidden lg:table-cell">Well-positioned vs. Tailored CM ($347) and above Future ($199).</td>
                    </tr>
                    <tr className="border-b border-brand-offwhite/50">
                      <td className="p-4 font-bold text-brand-navy">The Accelerator</td>
                      <td className="p-4 text-center font-display font-bold text-brand-navy">$497</td>
                      <td className="p-4 text-center font-display font-bold text-brand-navy">$497</td>
                      <td className="p-4 text-center"><span className="text-xs font-semibold bg-brand-offwhite text-brand-slate px-3 py-1 rounded-full">No change</span></td>
                      <td className="p-4 text-brand-slate hidden lg:table-cell">Matches Tailored CM all-inclusive. Video check-ins justify price.</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-brand-navy">The Full Experience</td>
                      <td className="p-4 text-center font-display font-bold text-brand-navy">$697</td>
                      <td className="p-4 text-center font-display font-bold text-brand-navy">$697</td>
                      <td className="p-4 text-center"><span className="text-xs font-semibold bg-brand-offwhite text-brand-slate px-3 py-1 rounded-full">No change</span></td>
                      <td className="p-4 text-brand-slate hidden lg:table-cell">2x live sessions/week worth $288-$704/mo alone at market rates.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 bg-brand-navy rounded-2xl p-7 text-white">
                <h3 className="font-display font-bold text-lg mb-3">Why a $79 self-guided tier?</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm text-white/80">
                  <div className="flex items-start gap-3">
                    <span className="text-brand-orange font-bold text-lg leading-none mt-0.5">1</span>
                    <p><strong className="text-white">Captures a new market.</strong> Price-sensitive prospects excluded by the $297 floor.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-brand-orange font-bold text-lg leading-none mt-0.5">2</span>
                    <p><strong className="text-white">Creates a funnel.</strong> Self-guided users experience the platform, then upgrade to coached tiers.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-brand-orange font-bold text-lg leading-none mt-0.5">3</span>
                    <p><strong className="text-white">Passive revenue.</strong> Minimal coach time required — the platform does the work.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-brand-orange font-bold text-lg leading-none mt-0.5">4</span>
                    <p><strong className="text-white">Grows social proof.</strong> Larger user base = more testimonials, community activity, leaderboard engagement.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Commitment Discounts */}
            <section>
              <SectionHeader
                label="Recommendation #2"
                title="Introduce commitment discounts"
                subtitle="Fitness results take 3-6 months. Aligning commitment periods with outcomes improves conversion and upfront cash flow."
              />
              <div className="bg-white rounded-2xl border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-brand-offwhite">
                      <th className="text-left p-4 font-semibold text-brand-navy">Commitment</th>
                      <th className="p-4 font-semibold text-brand-navy text-center">Blueprint</th>
                      <th className="p-4 font-semibold text-brand-navy text-center">Accelerator</th>
                      <th className="p-4 font-semibold text-brand-navy text-center">Full Experience</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commitmentDiscounts.map((row, i) => (
                      <tr key={row.period} className={`border-b border-brand-offwhite/50 ${i === 0 ? '' : 'bg-emerald-50/20'}`}>
                        <td className="p-4 font-medium text-brand-navy">
                          {row.period}
                          {row.discount && <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{row.discount} off</span>}
                        </td>
                        <td className="p-4 text-center font-display font-bold text-brand-navy">${row.blueprint}/mo</td>
                        <td className="p-4 text-center font-display font-bold text-brand-navy">${row.accelerator}/mo</td>
                        <td className="p-4 text-center font-display font-bold text-brand-navy">${row.full}/mo</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Other Recommendations */}
            <section>
              <SectionHeader label="Additional Recommendations" title="Other strategic moves to consider" />
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <h3 className="font-display font-bold text-lg text-brand-navy mb-2">Onboarding Fee</h3>
                  <p className="text-sm text-brand-slate leading-relaxed">Consider a one-time $97-$147 setup fee for coached tiers. Covers the welcome call, assessment, and custom program design. Signals that your time has value from day one.</p>
                </div>
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <h3 className="font-display font-bold text-lg text-brand-navy mb-2">Keep Weekly Price Display</h3>
                  <p className="text-sm text-brand-slate leading-relaxed">Displaying &quot;$74/week&quot; alongside &quot;$297/month&quot; is an effective psychological anchor. Reduces perceived cost by framing it in smaller, more digestible units. Keep this.</p>
                </div>
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <h3 className="font-display font-bold text-lg text-brand-navy mb-2">Reframe the Value Prop</h3>
                  <p className="text-sm text-brand-slate leading-relaxed">Shift marketing from &quot;coaching + app&quot; to <strong>&quot;a complete fitness operating system, powered by a certified coach.&quot;</strong> Competitors charge $199-$266 for coaching alone — AJM FIT delivers more at a comparable cost per feature.</p>
                </div>
                <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                  <h3 className="font-display font-bold text-lg text-brand-navy mb-2">No Higher Tier (Yet)</h3>
                  <p className="text-sm text-brand-slate leading-relaxed">$697 is well-positioned at the ceiling. Only worth going to $800-$1,000+ if you add specialized offerings like competition prep, post-rehab, or executive wellness down the road.</p>
                </div>
              </div>
            </section>

            {/* Sources */}
            <section>
              <SectionHeader label="Sources" title="Data sources cited in this research" />
              <div className="bg-white rounded-2xl p-7 border border-brand-offwhite shadow-[0_1px_3px_rgba(27,45,80,0.06),0_8px_24px_rgba(27,45,80,0.04)]">
                <ol className="text-sm text-brand-slate space-y-2 list-decimal list-inside">
                  <li>TrueCoach — How Much Should I Charge for Personal Training? (2025)</li>
                  <li>WarriorBabe — Online Fitness Coaching Prices 2026 Data</li>
                  <li>PT Distinction — How to Price Your Coaching Services (2025)</li>
                  <li>ISSA — The Human Advantage: AI in Personal Training (2025)</li>
                  <li>Rayfit — Top AI Personal Trainer Apps 2026</li>
                  <li>The Health Rocks — Premium Online Coaching vs. Cheap Apps (2025)</li>
                  <li>ISSA — How Much Should I Charge for Online Personal Training? (2024)</li>
                  <li>PTDC / Jonathan Goodman — How to Get Started as an Online Personal Trainer (2025)</li>
                  <li>Tailored Coaching Method — Online Fitness Coaching Cost in 2025</li>
                  <li>Garage Gym Reviews — Best Online Personal Trainers (2026)</li>
                  <li>Reddit r/personaltraining — Online coaching pricing thread (2025)</li>
                  <li>Zenoti — From Free Trials to Full Membership (2025)</li>
                  <li>Garage Gym Reviews — FlexIt session pricing data (2026)</li>
                </ol>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-brand-navy text-white/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span>Prepared for AJM FIT by Atlas Minds Co.</span>
          <span>Confidential — not for distribution</span>
        </div>
      </footer>
    </div>
  )
}
