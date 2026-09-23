'use client'

import Link from 'next/link'
import { TIER_EXPERIENCE } from '@/lib/tiers'
import type { Tier } from '@/lib/stripe/catalog'

/**
 * What this client's plan actually commits to.
 *
 * Nothing in the app told a client what they were paying for, and nothing
 * distinguished Accelerator from Full Experience anywhere — the only real
 * difference lived in a Calendly quota. Stating the response window and the
 * cadence out loud is what makes the difference legible, and it holds the
 * coach to it as much as it reassures the client.
 */
export default function PlanPanel({
  tier,
  checkInDone,
}: {
  tier: Tier
  checkInDone: boolean
}) {
  const t = TIER_EXPERIENCE[tier]

  return (
    <div className="bg-surface-raised rounded-card border border-white/[0.10] p-5 mb-6">
      <p className="text-white/70 text-sm font-body leading-relaxed">{t.headline}</p>

      <ul className="mt-3 space-y-1.5">
        {t.includes.map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="mt-[7px] w-1 h-1 rounded-full bg-brand-orange shrink-0" />
            <span className="text-white/50 text-xs font-body leading-relaxed">{line}</span>
          </li>
        ))}
      </ul>

      {t.weeklyCheckIn && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-white">
              {checkInDone ? 'Check-in sent this week' : 'Your weekly check-in'}
            </p>
            <p className="text-white/40 text-xs font-body mt-0.5">
              {checkInDone
                ? t.responseHours
                  ? `Anthony replies within ${t.responseHours} hours.`
                  : 'Anthony will reply shortly.'
                : 'Six questions, about a minute.'}
            </p>
          </div>
          {!checkInDone && (
            <Link
              href="/studio/check-in"
              className="shrink-0 px-4 py-2.5 rounded-control bg-brand-orange text-white text-xs font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-orangedark active:scale-[0.98] transition-all duration-200"
            >
              Start
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
