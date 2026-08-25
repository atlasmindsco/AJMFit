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

function scaled(hit: FoodHit, serving: FoodServing, qty: number) {
  if (hit.per100) {
    const factor = (serving.grams * qty) / 100
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
  const [servingIdx, setServingIdx] = useState(0)
  const [qtyText, setQtyText] = useState('1')
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
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
  const serving = selected?.servings[servingIdx] ?? null
  const preview = selected && serving ? scaled(selected, serving, qty) : null

  const pick = (hit: FoodHit) => {
    setSelected(hit)
    setServingIdx(0)
    setQtyText('1')
  }

  const stepQty = (delta: number) => {
    const next = Math.max(Math.round((qty + delta) * 4) / 4, 0.25)
    setQtyText(String(next))
  }

  const handleAdd = async () => {
    if (!selected || !serving || !preview || qty <= 0 || saving) return
    setSaving(true)
    try {
      const servingLabel = qty === 1 ? serving.label : `${qty} × ${serving.label}`
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
      <div className="absolute inset-0 bg-[#1B2D50]/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full h-full sm:h-[85vh] sm:max-w-md bg-white sm:rounded-2xl shadow-2xl shadow-[#1B2D50]/20 flex flex-col overflow-hidden"
        role="dialog"
        aria-label={`Add food to ${meal.name}`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[#1B2D50]/[0.06] shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => (selected ? setSelected(null) : onClose())}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1B2D50] hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A7BFF] active:scale-95 transition-colors duration-150"
              aria-label={selected ? 'Back to results' : 'Close'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <p className="font-display font-bold text-sm text-[#1B2D50]">{selected ? 'Serving size' : 'Add food'}</p>
              <p className="text-[#64748B] text-xs font-body">to {meal.name}</p>
            </div>
          </div>

          {!selected && (
            <div className="relative">
              <svg className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search foods, e.g. chicken noodle soup"
                className="w-full pl-9 pr-9 py-2.5 bg-[#FAFBFD] border border-[#1B2D50]/[0.08] rounded-lg text-sm font-body text-[#1B2D50] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1A7BFF] focus:ring-2 focus:ring-[#1A7BFF]/20"
                aria-label="Search foods"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#1B2D50]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A7BFF] transition-colors duration-150"
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
              className="mx-4 mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 shrink-0"
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
          {selected && serving ? (
            <div className="p-4 space-y-5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display font-bold text-lg text-[#1B2D50] leading-tight">{selected.name}</h2>
                  {selected.verified && <VerifiedShield />}
                </div>
                {selected.brand && <p className="text-[#64748B] text-sm font-body mt-0.5">{selected.brand}</p>}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-[#64748B] text-xs font-display font-bold uppercase tracking-wide">Serving size</span>
                  <select
                    value={servingIdx}
                    onChange={(e) => setServingIdx(Number(e.target.value))}
                    className="mt-1.5 w-full px-3 py-2.5 bg-[#FAFBFD] border border-[#1B2D50]/[0.08] rounded-lg text-sm font-body text-[#1B2D50] focus:outline-none focus:border-[#1A7BFF] focus:ring-2 focus:ring-[#1A7BFF]/20"
                  >
                    {selected.servings.map((s, i) => (
                      <option key={i} value={i}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="text-[#64748B] text-xs font-display font-bold uppercase tracking-wide">Number of servings</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      onClick={() => stepQty(-0.5)}
                      className="w-10 h-10 rounded-lg border border-[#1B2D50]/10 text-[#1B2D50] font-display font-bold hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A7BFF] active:scale-95 transition-colors duration-150"
                      aria-label="Decrease servings"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.25"
                      step="0.25"
                      value={qtyText}
                      onChange={(e) => setQtyText(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-[#FAFBFD] border border-[#1B2D50]/[0.08] rounded-lg text-sm font-body text-[#1B2D50] text-center focus:outline-none focus:border-[#1A7BFF] focus:ring-2 focus:ring-[#1A7BFF]/20"
                      aria-label="Number of servings"
                    />
                    <button
                      onClick={() => stepQty(0.5)}
                      className="w-10 h-10 rounded-lg border border-[#1B2D50]/10 text-[#1B2D50] font-display font-bold hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A7BFF] active:scale-95 transition-colors duration-150"
                      aria-label="Increase servings"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {preview && (
                <div className="bg-[#FAFBFD] rounded-xl border border-[#1B2D50]/[0.06] p-4">
                  <div className="flex items-baseline justify-center gap-1.5 mb-4">
                    <span className="font-display font-bold text-3xl text-[#1B2D50]">{preview.calories}</span>
                    <span className="text-[#64748B] text-sm font-body">kcal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-display font-bold text-base text-[#1A7BFF]">{preview.protein}g</p>
                      <p className="text-[#64748B] text-[11px] font-body uppercase tracking-wide">Protein</p>
                    </div>
                    <div>
                      <p className="font-display font-bold text-base text-[#F76B16]">{preview.carbs}g</p>
                      <p className="text-[#64748B] text-[11px] font-body uppercase tracking-wide">Carbs</p>
                    </div>
                    <div>
                      <p className="font-display font-bold text-base text-[#64748B]">{preview.fats}g</p>
                      <p className="text-[#64748B] text-[11px] font-body uppercase tracking-wide">Fats</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={saving || qty <= 0}
                className="w-full py-3 bg-[#1A7BFF] text-white font-display font-bold text-sm uppercase tracking-wide rounded-lg hover:bg-[#0F5FE0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A7BFF] active:scale-[0.99] disabled:opacity-50 transition-colors duration-200"
              >
                {saving ? 'Adding…' : `Add to ${meal.name}`}
              </button>
            </div>
          ) : (
            <div className="p-4">
              {showRecentsHeading && (
                <p className="text-[#64748B] text-xs font-display font-bold uppercase tracking-wide mb-2">Recent</p>
              )}
              {error && <p className="text-red-500 text-xs font-body mb-3">{error}</p>}
              {searching && (
                <div className="flex items-center gap-2 py-3 text-[#64748B] text-xs font-body">
                  <span className="w-3.5 h-3.5 border-2 border-[#1A7BFF]/30 border-t-[#1A7BFF] rounded-full animate-spin" />
                  Searching…
                </div>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
                <p className="text-[#64748B] text-xs font-body py-3">
                  No matches. Try fewer words (brand + food works best), or use Photo, Barcode, or Manual entry instead.
                </p>
              )}
              <ul className="divide-y divide-[#1B2D50]/[0.05]">
                {listShown.map((hit) => (
                  <li key={hit.id}>
                    <button
                      onClick={() => pick(hit)}
                      className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A7BFF] rounded-md px-2 -mx-2 transition-colors duration-150"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-body font-semibold text-sm text-[#1B2D50] truncate">{hit.name}</p>
                          {hit.verified && <VerifiedShield />}
                        </div>
                        <p className="text-[#64748B] text-xs font-body truncate">
                          {hit.per100
                            ? `${Math.round((hit.per100.calories * hit.servings[0].grams) / 100)} cal, ${hit.servings[0].label}`
                            : `${hit.fixed?.calories ?? 0} cal, ${hit.servings[0].label}`}
                          {hit.brand ? `, ${hit.brand}` : ''}
                        </p>
                      </div>
                      <span className="w-8 h-8 rounded-full bg-[#1A7BFF]/[0.08] text-[#1A7BFF] flex items-center justify-center shrink-0" aria-hidden="true">
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
