'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { getCurrentUserId } from '@/lib/current-user'
import { fadeIn } from '@/lib/animations'
import {
  ALLERGENS,
  DEFAULT_PREFERENCES,
  EATING_PATTERNS,
  fetchPreferences,
  hasUncheckableNote,
  savePreferences,
  type Allergen,
  type EatingPattern,
  type FoodPreferences,
} from '@/lib/food-preferences'
import { filterMeals, swapsFor, type Meal, type MealSlot } from '@/lib/meal-library'
import { OFF_PLAN_GUIDANCE, SITUATIONS, portionsFor } from '@/lib/portions'
import { fetchNutritionSetup } from '@/lib/nutrition'
import type { Sex } from '@/lib/nutrition-goals'

const SLOTS: Array<{ value: MealSlot; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
]

type Tab = 'meals' | 'portions' | 'situations'

export default function FoodPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<FoodPreferences>(DEFAULT_PREFERENCES)
  const [draft, setDraft] = useState<FoodPreferences>(DEFAULT_PREFERENCES)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sex, setSex] = useState<Sex>('male')
  const [tab, setTab] = useState<Tab>('meals')
  const [slot, setSlot] = useState<MealSlot>('breakfast')
  const [quickOnly, setQuickOnly] = useState(false)
  const [openSwaps, setOpenSwaps] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      if (!active) return
      setUserId(id)
      if (!id) {
        setLoading(false)
        return
      }
      try {
        const [p, setup] = await Promise.all([fetchPreferences(id), fetchNutritionSetup(id)])
        if (!active) return
        setPrefs(p)
        setDraft(p)
        if (setup.sex) setSex(setup.sex as Sex)
        // Never asked is different from "no restrictions", so open the editor
        // rather than quietly filtering on defaults and calling it personalised.
        if (!p.setAt) setEditing(true)
      } catch (e) {
        console.error('[Food] load failed', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const save = useCallback(async () => {
    if (!userId) return
    setSaving(true)
    try {
      await savePreferences(userId, draft)
      setPrefs({ ...draft, setAt: new Date().toISOString() })
      setEditing(false)
    } catch (e) {
      console.error('[Food] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [userId, draft])

  const meals = useMemo(
    () => filterMeals(prefs, { slot, maxPrep: quickOnly ? 10 : undefined }),
    [prefs, slot, quickOnly]
  )

  const toggleAllergen = (a: Allergen) =>
    setDraft((p) => ({
      ...p,
      allergens: p.allergens.includes(a) ? p.allergens.filter((x) => x !== a) : [...p.allergens, a],
    }))

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-navy/10 border-t-brand-navy/40 rounded-full animate-spin" />
      </div>
    )
  }

  const card = 'bg-white rounded-card border border-brand-navy/[0.06]'

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display font-extrabold text-2xl text-brand-navy tracking-tight">What to eat</h1>
        <p className="text-brand-slate text-sm font-body mt-1">
          Ideas that fit your targets, portions you can judge by eye, and what to do when you are out.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {(
          [
            ['meals', 'Meal ideas'],
            ['portions', 'Portions'],
            ['situations', 'Eating out'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 rounded-control text-sm font-body font-medium whitespace-nowrap transition-colors ${
              tab === value
                ? 'bg-brand-navy text-white'
                : 'bg-brand-navy/[0.05] text-brand-navy/60 hover:bg-brand-navy/[0.09]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'meals' && (
        <>
          {/* Preferences */}
          <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className={`${card} p-5 mb-4`}>
            {editing ? (
              <>
                <p className="font-display font-bold text-brand-navy text-sm">
                  {prefs.setAt ? 'Your food preferences' : 'First, what do you eat?'}
                </p>
                <p className="text-brand-slate text-xs font-body mt-0.5 mb-4 leading-relaxed">
                  This filters everything below. Nothing here is shared beyond Anthony.
                </p>

                <label className="block font-display font-semibold text-2xs uppercase tracking-[0.15em] text-brand-navy/60 mb-1.5">
                  How you eat
                </label>
                <select
                  value={draft.eatingPattern}
                  onChange={(e) => setDraft((p) => ({ ...p, eatingPattern: e.target.value as EatingPattern }))}
                  className="w-full px-3 py-2.5 mb-4 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40"
                >
                  {EATING_PATTERNS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <label className="block font-display font-semibold text-2xs uppercase tracking-[0.15em] text-brand-navy/60 mb-1.5">
                  Allergies
                </label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {ALLERGENS.map((a) => {
                    const on = draft.allergens.includes(a.value)
                    return (
                      <button
                        key={a.value}
                        onClick={() => toggleAllergen(a.value)}
                        className={`px-3 py-1.5 rounded-control text-xs font-body border transition-colors ${
                          on
                            ? 'bg-brand-orange/10 border-brand-orange/40 text-brand-orange'
                            : 'bg-brand-offwhite border-brand-navy/[0.08] text-brand-navy/60 hover:border-brand-navy/20'
                        }`}
                      >
                        {a.label}
                      </button>
                    )
                  })}
                </div>

                <label className="block font-display font-semibold text-2xs uppercase tracking-[0.15em] text-brand-navy/60 mb-1.5">
                  Anything else you cannot eat
                </label>
                <input
                  value={draft.allergenNotes}
                  onChange={(e) => setDraft((p) => ({ ...p, allergenNotes: e.target.value }))}
                  placeholder="Kiwi, sulphites"
                  className="w-full px-3 py-2.5 mb-4 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40"
                />

                <label className="block font-display font-semibold text-2xs uppercase tracking-[0.15em] text-brand-navy/60 mb-1.5">
                  Foods you would rather not eat
                </label>
                <input
                  value={draft.dislikes}
                  onChange={(e) => setDraft((p) => ({ ...p, dislikes: e.target.value }))}
                  placeholder="Tofu, cottage cheese"
                  className="w-full px-3 py-2.5 mb-4 bg-brand-offwhite border border-brand-navy/[0.08] rounded-control font-body text-sm text-brand-navy focus:outline-none focus:border-brand-blue/40"
                />

                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="px-5 py-2.5 bg-brand-navy text-white font-display font-bold text-xs uppercase tracking-[0.12em] rounded-control hover:bg-brand-navy/90 disabled:opacity-60 transition-all"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {prefs.setAt && (
                    <button
                      onClick={() => {
                        setDraft(prefs)
                        setEditing(false)
                      }}
                      className="px-5 py-2.5 bg-brand-navy/[0.06] text-brand-navy font-display font-bold text-xs uppercase tracking-[0.12em] rounded-control hover:bg-brand-navy/[0.1] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-body text-sm text-brand-navy">
                    {EATING_PATTERNS.find((p) => p.value === prefs.eatingPattern)?.label}
                    {prefs.allergens.length > 0 && (
                      <>
                        {' · no '}
                        {prefs.allergens
                          .map((a) => ALLERGENS.find((x) => x.value === a)?.label.toLowerCase())
                          .join(', ')}
                      </>
                    )}
                  </p>
                  {prefs.dislikes.trim() && (
                    <p className="text-brand-slate text-xs font-body mt-0.5">Avoiding: {prefs.dislikes}</p>
                  )}
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="shrink-0 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wide rounded bg-brand-navy/[0.08] text-brand-navy hover:bg-brand-navy/[0.12] transition-colors"
                >
                  Change
                </button>
              </div>
            )}
          </motion.div>

          {/* A free-text allergy note cannot be matched against meal tags, so
              the list below is NOT filtered on it. Saying so is the only
              honest option: silently filtering on the structured fields and
              presenting the result as safe is how someone gets hurt. */}
          {!editing && hasUncheckableNote(prefs) && (
            <div className="mb-4 p-4 rounded-card bg-brand-orange/[0.06] border border-brand-orange/20">
              <p className="font-body text-sm text-brand-navy leading-relaxed">
                You told us about <span className="font-semibold">{prefs.allergenNotes}</span>. We cannot check
                the meals below against that automatically, so please read the ingredients yourself. Anthony
                can see this note too.
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {SLOTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSlot(s.value)}
                className={`px-3.5 py-1.5 rounded-control text-xs font-body font-medium transition-colors ${
                  slot === s.value
                    ? 'bg-brand-blue text-white'
                    : 'bg-brand-navy/[0.05] text-brand-navy/60 hover:bg-brand-navy/[0.09]'
                }`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => setQuickOnly((q) => !q)}
              className={`ml-auto px-3.5 py-1.5 rounded-control text-xs font-body font-medium transition-colors ${
                quickOnly
                  ? 'bg-brand-navy text-white'
                  : 'bg-brand-navy/[0.05] text-brand-navy/60 hover:bg-brand-navy/[0.09]'
              }`}
            >
              10 min or less
            </button>
          </div>

          {/* Meals */}
          {meals.length === 0 ? (
            <div className={`${card} p-8 text-center`}>
              <p className="font-body text-sm text-brand-navy">
                Nothing in the library matches that combination yet.
              </p>
              <p className="text-brand-slate text-xs font-body mt-1.5">
                Message Anthony and he will put some options together for you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {meals.map((m) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  prefs={prefs}
                  open={openSwaps === m.id}
                  onToggle={() => setOpenSwaps(openSwaps === m.id ? null : m.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'portions' && (
        <>
          <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className={`${card} p-5 mb-4`}>
            <p className="font-display font-bold text-brand-navy text-sm">Your hand is the measuring cup</p>
            <p className="text-brand-slate text-xs font-body mt-1 mb-4 leading-relaxed">
              Your hand scales with you, travels with you, and works in a restaurant. These are approximate on
              purpose. Getting roughly right every day beats getting exactly right for a week.
            </p>
            <div className="space-y-2.5">
              {portionsFor(sex).map((p) => (
                <div
                  key={p.component}
                  className="flex items-start gap-4 p-3.5 rounded-control bg-brand-offwhite border border-brand-navy/[0.06]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-brand-navy text-sm">{p.component}</p>
                    <p className="text-brand-slate text-xs font-body mt-0.5">{p.note}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body font-semibold text-brand-navy text-sm">{p.perMeal}</p>
                    <p className="text-brand-slate text-2xs font-body">per meal</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className={`${card} p-5`}>
            <p className="font-display font-bold text-brand-navy text-sm">Building a plate</p>
            <p className="text-brand-slate text-xs font-body mt-1 mb-3 leading-relaxed">
              Protein first, then vegetables, then carbs, then fats. In that order, every time. Most people who
              struggle are not eating too much of everything, they are eating too little protein and too much of
              the last two.
            </p>
          </motion.div>
        </>
      )}

      {tab === 'situations' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {SITUATIONS.map((s, i) => (
              <motion.div
                key={s.id}
                custom={i}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className={`${card} p-5`}
              >
                <p className="font-display font-bold text-brand-navy text-sm mb-2.5">{s.title}</p>
                <ul className="space-y-1.5">
                  {s.rules.map((r) => (
                    <li key={r} className="flex gap-2 text-brand-slate text-xs font-body leading-relaxed">
                      <span className="text-brand-blue shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="p-5 rounded-card bg-brand-blue/[0.05] border border-brand-blue/20">
            <p className="font-display font-bold text-brand-navy text-sm mb-2.5">If you went off plan</p>
            <ul className="space-y-1.5">
              {OFF_PLAN_GUIDANCE.map((g) => (
                <li key={g} className="flex gap-2 text-brand-navy/70 text-xs font-body leading-relaxed">
                  <span className="text-brand-blue shrink-0">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function MealCard({
  meal,
  prefs,
  open,
  onToggle,
}: {
  meal: Meal
  prefs: FoodPreferences
  open: boolean
  onToggle: () => void
}) {
  const swaps = open ? swapsFor(meal, prefs) : []
  return (
    <div className="bg-white rounded-card border border-brand-navy/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-body font-semibold text-brand-navy text-sm leading-snug">{meal.name}</p>
        <span className="shrink-0 text-brand-slate text-2xs font-body">
          {meal.prep === 0 ? 'no prep' : `${meal.prep} min`}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2.5">
        <span className="font-display font-bold text-brand-navy text-sm">{meal.calories} cal</span>
        <span className="text-brand-blue text-xs font-body font-semibold">{meal.protein}g protein</span>
      </div>
      <button
        onClick={onToggle}
        className="mt-2.5 text-brand-slate hover:text-brand-navy text-xs font-body underline underline-offset-2 transition-colors"
      >
        {open ? 'Hide swaps' : 'Swap this'}
      </button>
      {open && (
        <div className="mt-2.5 pt-2.5 border-t border-brand-navy/[0.06] space-y-1.5">
          {swaps.length === 0 ? (
            <p className="text-brand-slate text-xs font-body">No close match in your list yet.</p>
          ) : (
            swaps.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between gap-3">
                <span className="text-brand-navy/80 text-xs font-body leading-snug">{s.name}</span>
                <span className="shrink-0 text-brand-slate text-2xs font-body">
                  {s.calories} cal · {s.protein}g
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
