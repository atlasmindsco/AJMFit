'use client'

/**
 * Pick the unit from a list you can actually read.
 *
 * A native `<select>` works, but on a phone it hands the choice to the
 * operating system's picker — a scrolling wheel of truncated labels that shows
 * two or three options at a time, with no room to say what each one weighs.
 * The whole point of the serving work was that a client should be able to see
 * that a tablespoon of this jelly is 20 grams before choosing it.
 *
 * So: a sheet from the bottom, one row per option, each row carrying its gram
 * weight and what it works out to in calories. Everything is on screen at once
 * and the thumb reaches all of it.
 */
import { motion } from 'framer-motion'

export interface UnitOption {
  /** Stable key for React and for the caller to identify the choice. */
  key: string
  /** The unit as the client reads it: "tablespoons", "grams (g)". */
  label: string
  /** "20 g each", or null when the weight is not known. */
  detail: string | null
  /** What one of this unit is worth, e.g. "50 cal". Optional. */
  calories: string | null
}

export default function UnitPickerSheet({
  title,
  options,
  selectedKey,
  onPick,
  onClose,
}: {
  title: string
  options: UnitOption[]
  selectedKey: string
  onPick: (key: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-brand-navy/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative w-full sm:max-w-sm max-h-[70vh] flex flex-col bg-white border-t sm:border border-brand-navy/[0.08] rounded-t-card sm:rounded-card shadow-2xl shadow-brand-navy/20"
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-navy/[0.06] shrink-0">
          <p className="font-display font-bold text-brand-navy">{title}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-brand-slate hover:bg-[#FAFBFD] active:scale-95 transition-all duration-150"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto py-1">
          {options.map((o) => {
            const on = o.key === selectedKey
            return (
              <button
                key={o.key}
                onClick={() => onPick(o.key)}
                // 56px tall: a thumb target that survives a sweaty hand.
                className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors duration-150 ${
                  on ? 'bg-brand-blue/[0.06]' : 'hover:bg-[#FAFBFD]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`font-body text-base ${on ? 'text-brand-blue font-semibold' : 'text-brand-navy'}`}>
                    {o.label}
                  </p>
                  {(o.detail || o.calories) && (
                    <p className="text-brand-slate text-xs font-body mt-0.5">
                      {[o.detail, o.calories].filter(Boolean).join('  ·  ')}
                    </p>
                  )}
                </div>
                {on && (
                  <div className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
