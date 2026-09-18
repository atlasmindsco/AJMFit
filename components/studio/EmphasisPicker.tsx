'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const EMPHASIS_OPTIONS = [
  { key: 'none', label: 'No Emphasis', desc: 'Balanced development across all muscle groups' },
  { key: 'legs', label: 'Legs', desc: 'Extra volume and frequency for quads, hamstrings, calves' },
  { key: 'glutes', label: 'Glutes', desc: 'Prioritize glute activation and growth' },
  { key: 'chest', label: 'Chest', desc: 'Emphasize chest exercises and volume' },
  { key: 'back', label: 'Back', desc: 'Focus on lats, upper back, thickness' },
  { key: 'shoulders', label: 'Shoulders', desc: 'Build broader, rounder shoulders' },
  { key: 'arms', label: 'Arms', desc: 'Maximize bicep and tricep development' },
  { key: 'upper_body', label: 'Upper Body', desc: 'Prioritize chest, back, shoulders, arms' },
  { key: 'lower_body', label: 'Lower Body', desc: 'Prioritize legs and glutes' },
] as const

export default function EmphasisPicker({
  onDone,
  onSkip,
}: {
  onDone?: (emphasis: string) => void
  onSkip?: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const emphasis = selected || 'none'
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/studio/blueprint/set-emphasis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emphasis }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save preference')
      }

      onDone?.(emphasis)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Any body parts to emphasize?
        </h1>
        <p className="text-white/40 text-sm font-body mt-2 max-w-lg mx-auto">
          Optional: focus extra volume on a muscle group, or keep it balanced.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
      >
        {EMPHASIS_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSelected(opt.key)}
            className={`text-left px-5 py-4 rounded-xl border transition-all duration-200 active:scale-[0.99] ${
              selected === opt.key
                ? 'bg-[#1A7BFF]/[0.12] border-[#1A7BFF]/50'
                : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
            }`}
          >
            <span
              className={`font-display font-bold text-base block ${
                selected === opt.key ? 'text-white' : 'text-white/80'
              }`}
            >
              {opt.label}
            </span>
            <span className="text-white/40 text-xs font-body mt-1 block">{opt.desc}</span>
          </button>
        ))}
      </motion.div>

      {error && <p className="text-red-400 text-sm font-body mb-4">{error}</p>}

      <div className="flex gap-3">
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={submitting}
            className="flex-1 py-4 bg-white/[0.06] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-4 bg-[#1A7BFF] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-xl hover:bg-[#0F5FE0] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : selected ? 'Continue' : 'No emphasis'}
        </button>
      </div>
    </div>
  )
}
