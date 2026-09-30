'use client'

/**
 * Search-first food logging: type a food, pick a real product from the USDA
 * database, choose a serving size, and the macros scale automatically before
 * logging into the chosen meal. Recently logged foods surface for one-tap
 * re-logging when the search box is empty.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { addFoodLog, fetchRecentFoods, type FoodLogRow, type MealRow, type RecentFood } from '@/lib/nutrition'
import { servingChoices, formatServing, type ServingChoice } from '@/lib/servings'

interface FoodServing {
  label: string
  grams: number
}

interface FoodHit {
  id: number | string
  name: string
  brand: string | null
  verified: boolean
  /** Per-100g macros. Null for recents, whose macros are fixed per serving. */
  per100: { calories: number; protein: number; carbs: number; fats: number } | null
  /** Fixed per-serving macros (recents only). */
  fixed?: { calories: number; protein: number; carbs: number; fats: number }
  servings: FoodServing[]
}

interface Props {
  meal: MealRow
  userId: string
  onClose: () => void
  onAdded: (log: FoodLogRow) => void
}

function scaled(hit: FoodHit, gramsPerUnit: number, qty: number) {
  if (hit.per100) {
    const factor = (gramsPerUnit * qty) / 100
    return {
      calories: Math.round(hit.per100.calories * factor),
      protein: Math.round(hit.per100.protein * factor * 10) / 10,
      carbs: Math.round(hit.per100.carbs * factor * 10) / 10,
      fats: Math.round(hit.per100.fats * factor * 10) / 10,
    }
  }
  const f = hit.fixed ?? { calories: 0, protein: 0, carbs: 0, fats: 0 }
  return {
    calories: Math.round(f.calories * qty),
    protein: Math.round(f.protein * qty * 10) / 10,
    carbs: Math.round(f.carbs * qty * 10) / 10,
    fats: Math.round(f.fats * qty * 10) / 10,
  }
}

function recentToHit(r: RecentFood, i: number): FoodHit {
  return {
    id: `recent-${i}`,
    name: r.food_name,
    brand: null,
    verified: false,
    per100: null,
    fixed: { calories: r.calories, protein: r.protein, carbs: r.carbs, fats: r.fats },
    servings: [{ label: r.serving_size || '1 serving', grams: 0 }],
  }
}

const VerifiedShield = () => (
  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-label="Verified nutrition data">
    <path
      fillRule="evenodd"
      d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
      clipRule="evenodd"
    />
  </svg>
)

export default function FoodSearchSheet({ meal, userId, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodHit[]>([])
  const [recents, setRecents] = useState<FoodHit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FoodHit | null>(null)
  const [unitIdx, setUnitIdx] = useState(0)
  const [qtyText, setQtyText] = useState('1')
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Focus the search box on a desktop, never on a touch screen.
    //
    // Autofocusing everywhere threw up the on-screen keyboard the instant the
    // sheet opened, which covered the list of foods the client already eats --
    // so the fastest way to log a staple was hidden behind the slowest one.
    // A phone user now sees their usual foods first and taps the box only if
    // they actually want to search for something new.
    const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (!touch) inputRef.current?.focus()

    fetchRecentFoods(userId)
      .then((r) => setRecents(r.map(recentToHit)))
      .catch(() => setRecents([]))
  }, [userId])

  useEffect(() => {
    const q = query.trim()
    abortRef.current?.abort()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      setError(null)
      return
    }
    setSearching(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/food-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Search failed')
        const json = await res.json()
        setResults(json.results ?? [])
        setSearching(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('Could not reach the food database. Check your connection and try again.')
        setSearching(false)
      }
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (selected ? setSelected(null) : onClose())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, onClose])

  const qty = Math.max(parseFloat(qtyText) || 0, 0)

  // A searched food scales off per-100g macros, so it can be measured in any
  // unit whose gram weight we know. A recent food carries fixed macros for the
  // serving it was logged at, so the only honest unit is that same serving.
  const choices: ServingChoice[] = selected
    ? selected.per100
      ? servingChoices(selected.servings[0])
      : [
          {
            unit: 'serving',
            label: selected.servings[0]?.label || '1 serving',
            gramsPerUnit: 0,
            quick: [0.5, 1, 2],
            allowsFraction: true,
          },
        ]
    : []
  const choice = choices[unitIdx] ?? choices[0] ?? null
  const preview = selected && choice ? scaled(selected, choice.gramsPerUnit, qty) : null

  const pick = (hit: FoodHit) => {
    setSelected(hit)
    setUnitIdx(0)
    // Start on the amount that matches the unit: one tablespoon, one serving —
    // but 100 g rather than 1 g, since nobody weighs out a single gram.
    const first = hit.per100 ? servingChoices(hit.servings[0])[0] : null
    setQtyText(first && first.unit === 'g' ? '100' : '1')
  }

  const stepQty = (delta: number) => {
    // Grams step in tens; everything else in quarters.
    const grams = choice?.unit === 'g'
    const step = grams ? delta * 10 : delta
    const next = grams
      ? Math.max(Math.round(qty + step), 1)
      : Math.max(Math.round((qty + step) * 4) / 4, 0.25)
    setQtyText(String(next))
  }

  const pickUnit = (idx: number) => {
    const next = choices[idx]
    if (!next || !choice) return
    // Carry the amount across so switching units re-expresses the same food
    // rather than silently changing how much of it you logged.
    if (next.gramsPerUnit > 0 && choice.gramsPerUnit > 0) {
      const grams = qty * choice.gramsPerUnit
      const converted = grams / next.gramsPerUnit
      setQtyText(String(next.unit === 'g' ? Math.round(converted) : Math.round(converted * 4) / 4))
    }
    setUnitIdx(idx)
  }

  const handleAdd = async () => {
    if (!selected || !choice || !preview || qty <= 0 || saving) return
    setSaving(true)
    try {
      // "20 g", "1 tbsp", "2 oz" — the thing the client actually chose.
      // A recent food has no gram weight to scale, so it keeps its own label.
      const servingLabel =
        choice.gramsPerUnit > 0
          ? formatServing(qty, choice.unit)
          : qty === 1
            ? choice.label
            : `${qty} × ${choice.label}`
      const log = await addFoodLog({
        userId,
        mealId: meal.id,
        foodName: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
        calories: preview.calories,
        protein: preview.protein,
        carbs: preview.carbs,
        fats: preview.fats,
        servingSize: servingLabel,
      })
      onAdded(log)
      setJustAdded(selected.name)
      setSelected(null)
      setQuery('')
      inputRef.current?.focus()
      setTimeout(() => setJustAdded(null), 2500)
    } catch {
      setError('Could not save that food. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const listShown = query.trim().length >= 2 ? results : recents
  const showRecentsHeading = query.trim().length < 2 && recents.length > 0

  return (
    <div className="fixed inset-0 z-[70] flex sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-brand-navy/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full h-full sm:h-[85vh] sm:max-w-md bg-white sm:rounded-card shadow-2xl shadow-brand-navy/20 flex flex-col overflow-hidden"
        role="dialog"
        aria-label={`Add food to ${meal.name}`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-brand-navy/[0.06] shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => (selected ? setSelected(null) : onClose())}
              className="w-9 h-9 rounded-full flex items-center justify-center text-brand-navy hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue active:scale-95 transition-colors duration-150"
              aria-label={selected ? 'Back to results' : 'Close'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <p className="font-display font-bold text-sm text-brand-navy">{selected ? 'Serving size' : 'Add food'}</p>
              <p className="text-brand-slate text-xs font-body">to {meal.name}</p>
            </div>
          </div>

          {!selected && (
            <div className="relative">
              <svg className="w-4 h-4 text-brand-slate absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search foods, e.g. chicken noodle soup"
                className="w-full pl-9 pr-9 py-2.5 bg-[#FAFBFD] border border-brand-navy/[0.08] rounded-control text-sm font-body text-brand-navy placeholder:text-[#94A3B8] focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                aria-label="Search foods"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-brand-slate hover:bg-brand-navy/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue transition-colors duration-150"
                  aria-label="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Added toast */}
        <AnimatePresence>
          {justAdded && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-control flex items-center gap-2 shrink-0"
            >
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <p className="text-emerald-700 text-xs font-body">
                <span className="font-semibold">{justAdded}</span> added to {meal.name}. Search to add more.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {selected && choice ? (
            <div className="p-4 space-y-5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display font-bold text-lg text-brand-navy leading-tight">{selected.name}</h2>
                  {selected.verified && <VerifiedShield />}
                </div>
                {selected.brand && <p className="text-brand-slate text-sm font-body mt-0.5">{selected.brand}</p>}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-brand-slate text-xs font-display font-bold uppercase tracking-wide">Measure in</span>
                  <select
                    value={unitIdx}
                    onChange={(e) => pickUnit(Number(e.target.value))}
                    disabled={choices.length < 2}
                    className="mt-1.5 w-full px-3 py-2.5 bg-[#FAFBFD] border border-brand-navy/[0.08] rounded-control text-sm font-body text-brand-navy focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
                  >
                    {choices.map((c, i) => (
                      <option key={c.unit} value={i}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="text-brand-slate text-xs font-display font-bold uppercase tracking-wide">
                    How {choice?.unit === 'g' || choice?.unit === 'oz' ? 'much' : 'many'}
                  </span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      onClick={() => stepQty(-0.5)}
                      className="w-10 h-10 rounded-control border border-brand-navy/10 text-brand-navy font-display font-bold hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue active:scale-95 transition-colors duration-150"
                      aria-label="Decrease amount"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={choice?.unit === 'g' ? 1 : 0.25}
                      step={choice?.unit === 'g' ? 1 : 0.25}
                      value={qtyText}
                      onChange={(e) => setQtyText(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-[#FAFBFD] border border-brand-navy/[0.08] rounded-control text-sm font-body text-brand-navy text-center focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      aria-label={`Amount in ${choice?.unit ?? 'servings'}`}
                    />
                    <button
                      onClick={() => stepQty(0.5)}
                      className="w-10 h-10 rounded-control border border-brand-navy/10 text-brand-navy font-display font-bold hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue active:scale-95 transition-colors duration-150"
                      aria-label="Increase amount"
                    >
                      +
                    </button>
                  </div>

                  {/* One tap for the amounts people actually use. */}
                  {choice && choice.quick.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {choice.quick.map((n) => (
                        <button
                          key={n}
                          onClick={() => setQtyText(String(n))}
                          className={`px-2.5 py-1 rounded-full text-xs font-body border transition-colors duration-150 ${
                            qty === n
                              ? 'bg-brand-blue text-white border-brand-blue'
                              : 'bg-white text-brand-slate border-brand-navy/10 hover:bg-[#FAFBFD]'
                          }`}
                        >
                          {formatServing(n, choice.unit)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* What that works out to on a scale. */}
                  {choice && choice.gramsPerUnit > 0 && choice.unit !== 'g' && qty > 0 && (
                    <p className="mt-2 text-brand-slate text-xs font-body">
                      ≈ {Math.round(qty * choice.gramsPerUnit)} g
                    </p>
                  )}
                </div>
              </div>

              {preview && (
                <div className="bg-[#FAFBFD] rounded-card border border-brand-navy/[0.06] p-4">
                  <div className="flex items-baseline justify-center gap-1.5 mb-4">
                    <span className="font-display font-bold text-3xl text-brand-navy">{preview.calories}</span>
                    <span className="text-brand-slate text-sm font-body">kcal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-display font-bold text-base text-brand-blue">{preview.protein}g</p>
                      <p className="text-brand-slate text-2xs font-body uppercase tracking-wide">Protein</p>
                    </div>
                    <div>
                      <p className="font-display font-bold text-base text-brand-orange">{preview.carbs}g</p>
                      <p className="text-brand-slate text-2xs font-body uppercase tracking-wide">Carbs</p>
                    </div>
                    <div>
                      <p className="font-display font-bold text-base text-brand-slate">{preview.fats}g</p>
                      <p className="text-brand-slate text-2xs font-body uppercase tracking-wide">Fats</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={saving || qty <= 0}
                className="w-full py-3 bg-brand-blue text-white font-display font-bold text-sm uppercase tracking-wide rounded-control hover:bg-brand-bluedark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue active:scale-[0.99] disabled:opacity-50 transition-colors duration-200"
              >
                {saving ? 'Adding…' : `Add to ${meal.name}`}
              </button>
            </div>
          ) : (
            <div className="p-4">
              {showRecentsHeading && (
                <p className="text-brand-slate text-xs font-display font-bold uppercase tracking-wide mb-2">
                  Your usual
                </p>
              )}
              {error && <p className="text-red-500 text-xs font-body mb-3">{error}</p>}
              {searching && (
                <div className="flex items-center gap-2 py-3 text-brand-slate text-xs font-body">
                  <span className="w-3.5 h-3.5 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                  Searching…
                </div>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
                <p className="text-brand-slate text-xs font-body py-3">
                  No matches. Try fewer words (brand + food works best), or use Photo, Barcode, or Manual entry instead.
                </p>
              )}
              <ul className="divide-y divide-brand-navy/[0.05]">
                {listShown.map((hit) => (
                  <li key={hit.id}>
                    <button
                      onClick={() => pick(hit)}
                      className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue rounded-control px-2 -mx-2 transition-colors duration-150"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-body font-semibold text-sm text-brand-navy truncate">{hit.name}</p>
                          {hit.verified && <VerifiedShield />}
                        </div>
                        <p className="text-brand-slate text-xs font-body truncate">
                          {hit.per100
                            ? `${Math.round((hit.per100.calories * hit.servings[0].grams) / 100)} cal, ${hit.servings[0].label}`
                            : `${hit.fixed?.calories ?? 0} cal, ${hit.servings[0].label}`}
                          {hit.brand ? `, ${hit.brand}` : ''}
                        </p>
                      </div>
                      <span className="w-8 h-8 rounded-full bg-brand-blue/[0.08] text-brand-blue flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
