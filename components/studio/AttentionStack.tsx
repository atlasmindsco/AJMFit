'use client'

/**
 * The few things worth knowing before you start training.
 *
 * Sits between the greeting and Today's Training, and renders NOTHING when
 * there is nothing to say — which for six of twelve active clients is the
 * honest answer. An empty state reading "nothing needs your attention" is
 * itself noise, and this block must never push the start button down the page
 * to tell someone there is no news.
 *
 * A plain list of links rather than a carousel. No swipe to discover, no
 * pagination semantics to get wrong, nothing hidden behind a gesture — the
 * second most urgent item is the one a carousel would hide, and it is exactly
 * the one that should be visible.
 *
 * Tone is carried by a word as well as the accent stripe, because a colour
 * alone is not a signal to everybody.
 */
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { AttentionCard } from '@/lib/attention'

const STRIPE: Record<AttentionCard['tone'], string> = {
  act: 'bg-brand-orange',
  good: 'bg-state-success',
  offer: 'bg-white/25',
}

export default function AttentionStack({ cards }: { cards: AttentionCard[] }) {
  // Dismissals last for the session only. Something that still needs doing
  // tomorrow should be asked again tomorrow, and a permanent dismissal of a
  // check-in would quietly cancel the thing the tier is sold on.
  const [hidden, setHidden] = useState<string[]>([])
  const shown = cards.filter((c) => !hidden.includes(c.kind))
  if (shown.length === 0) return null

  return (
    <div className="mb-6 space-y-2">
      {shown.map((card, i) => (
        <motion.div
          key={card.kind}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-stretch gap-3 rounded-card bg-surface-raised border border-white/[0.10] overflow-hidden"
        >
          <span className={`w-1 shrink-0 ${STRIPE[card.tone]}`} aria-hidden="true" />
          <Link href={card.href} className="flex items-center gap-3 flex-1 min-w-0 py-3.5 pr-2">
            <span className="min-w-0 flex-1">
              <span className="block font-display font-bold text-white text-sm leading-snug">{card.title}</span>
              {card.detail && (
                <span className="block text-white/45 text-xs font-body mt-0.5 leading-relaxed">{card.detail}</span>
              )}
            </span>
            <span className="shrink-0 text-white/25 text-sm" aria-hidden="true">&rsaquo;</span>
          </Link>
          {card.dismissible && (
            <button
              onClick={() => setHidden((prev) => [...prev, card.kind])}
              className="shrink-0 px-3 text-white/20 hover:text-white/60 transition-colors"
              aria-label={`Dismiss: ${card.title}`}
            >
              &times;
            </button>
          )}
        </motion.div>
      ))}
    </div>
  )
}
