'use client'

/**
 * AJM Recommends — a coach's shortlist, living as a tab inside nutrition.
 *
 * Deliberately not a nav destination. Supplements sitting beside Train would
 * say they are a quarter of the product, and the navigation could not take a
 * fifth slot anyway. Here, it is found by someone already thinking about food.
 *
 * Three rules this screen is built around:
 *
 *   The honesty line is the FIRST thing, not a footnote. A client who reads
 *   "I earn a commission" before seeing a single product trusts everything
 *   after it; one who finds it at the bottom wonders what else was buried.
 *
 *   No prices, no offers, no badges, no hero. The moment this screen carries
 *   a promotion it is a shop, and the brief was explicitly that it must not
 *   become one.
 *
 *   The button names the destination. "Shop now" hides where you are going.
 *   "View on Amway" means nobody is surprised by what loads, and surprise is
 *   what costs trust.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  fetchRecommendations,
  recordClick,
  byCategory,
  hasDetail,
  DISCLOSURE_FULL,
  DISCLOSURE_SHORT,
  SAFETY_NOTE,
  type Recommendation,
} from '@/lib/recommendations'

export default function Recommends({ initialCategory }: { initialCategory?: string | null }) {
  const [items, setItems] = useState<Recommendation[] | null>(null)
  const [open, setOpen] = useState<Recommendation | null>(null)

  useEffect(() => {
    fetchRecommendations()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const groups = byCategory(items ?? [])
  const shown = initialCategory ? groups.filter((g) => g.category === initialCategory) : groups

  const openProduct = (item: Recommendation) => {
    void recordClick(item.id)
    window.open(item.external_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      {/* Before any product. This is the point of the screen as much as the
          products are. */}
      <p className="text-brand-slate text-sm font-body leading-relaxed mb-5 p-4 rounded-card bg-brand-navy/[0.03] border border-brand-navy/[0.08]">
        {DISCLOSURE_FULL}
      </p>

      {items === null && (
        <p className="text-brand-slate text-sm font-body py-10 text-center">Loading&hellip;</p>
      )}

      {items !== null && shown.length === 0 && (
        <div className="py-10 text-center">
          <p className="font-display font-bold text-brand-navy text-sm">Nothing here yet</p>
          <p className="text-brand-slate text-xs font-body mt-1">
            Anthony adds things here when he finds something worth the money.
          </p>
        </div>
      )}

      {shown.map((group) => (
        <section key={group.category} className="mb-7">
          <h2 className="font-display font-bold text-brand-navy text-xs uppercase tracking-[0.12em] mb-3">
            {group.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-card border border-brand-navy/[0.06] p-4 flex flex-col"
              >
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-28 object-contain rounded-control bg-brand-navy/[0.02] mb-3"
                  />
                )}
                <p className="font-display font-bold text-brand-navy text-sm leading-snug">{item.name}</p>
                {item.why_recommended && (
                  <p className="text-brand-slate text-xs font-body mt-1.5 leading-relaxed flex-1">
                    {item.why_recommended}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  {hasDetail(item) && (
                    <button
                      onClick={() => setOpen(item)}
                      className="px-3 py-2.5 rounded-control bg-brand-navy/[0.06] text-brand-navy text-2xs font-display font-bold uppercase tracking-wide hover:bg-brand-navy/[0.1] transition-colors"
                    >
                      Details
                    </button>
                  )}
                  <button
                    onClick={() => openProduct(item)}
                    className="flex-1 px-3 py-2.5 rounded-control bg-brand-navy text-white text-2xs font-display font-bold uppercase tracking-wide hover:bg-brand-navy/90 active:scale-[0.98] transition-all"
                  >
                    View on {item.merchant} &nearr;
                  </button>
                </div>
                <p className="text-brand-slate/70 text-2xs font-body mt-2">
                  {item.disclosure_note || DISCLOSURE_SHORT}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      ))}

      {open && <DetailSheet item={open} onClose={() => setOpen(null)} onOpen={() => openProduct(open)} />}
    </div>
  )
}

/**
 * The detail sheet: four headings, and a line about talking to a doctor.
 *
 * The line this holds: the app may say what a product IS and the situation it
 * suits. It must not say what it does to a body. "Supports recovery" sounds
 * harmless and is a structure-function claim with rules attached; "this is
 * what I use after training" is an experience and carries none of them. The
 * headings are shaped to make the first easy to write and the second awkward.
 */
function DetailSheet({
  item,
  onClose,
  onOpen,
}: {
  item: Recommendation
  onClose: () => void
  onOpen: () => void
}) {
  const sections: Array<[string, string | null]> = [
    ['What it is', item.what_it_is],
    ['Who it may suit', item.who_it_suits],
    ['How it is commonly used', item.how_used],
    ['Worth knowing', item.worth_knowing],
  ]
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-brand-navy/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-t-card sm:rounded-card p-5"
        role="dialog"
        aria-label={item.name}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="font-display font-extrabold text-lg text-brand-navy tracking-tight">{item.name}</p>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full bg-brand-navy/[0.06] text-brand-slate hover:text-brand-navy transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <p className="text-brand-slate text-2xs font-body uppercase tracking-wide">{item.category}</p>

        {sections.map(([heading, body]) =>
          body ? (
            <div key={heading} className="mt-4">
              <p className="font-display font-bold text-brand-navy text-2xs uppercase tracking-[0.12em]">
                {heading}
              </p>
              <p className="text-brand-slate text-sm font-body mt-1 leading-relaxed">{body}</p>
            </div>
          ) : null
        )}

        <p className="mt-5 p-3 rounded-control bg-brand-navy/[0.03] text-brand-slate text-xs font-body leading-relaxed">
          {SAFETY_NOTE}
        </p>

        <p className="text-brand-slate/70 text-2xs font-body mt-3">
          {item.disclosure_note || DISCLOSURE_SHORT}
        </p>

        <button
          onClick={onOpen}
          className="w-full mt-3 py-3.5 rounded-control bg-brand-navy text-white text-sm font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-navy/90 active:scale-[0.98] transition-all"
        >
          View on {item.merchant} &nearr;
        </button>
      </motion.div>
    </div>
  )
}
