'use client'

/**
 * Adding pictures to the 44 meals.
 *
 * The meal library is a code file, so without this every photograph would be
 * a deploy. The filename is the meal id, so dropping a file in is the whole
 * operation — no table to keep in step and nothing to name correctly, because
 * this page names it.
 *
 * Grouped by slot and showing every meal whether it has a picture or not, so
 * the gaps are the point of the screen: forty-four of these is a long job and
 * the thing Anthony needs is to see at a glance which ones are left.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MEALS, type MealSlot } from '@/lib/meal-library'
import { fetchMealImages, uploadMealImage, removeMealImage } from '@/lib/meal-images'

const SLOTS: Array<{ key: MealSlot; label: string }> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
]

export default function MealImagesAdmin() {
  const [images, setImages] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setImages(await fetchMealImages())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onPick = async (mealId: string, file: File | undefined) => {
    if (!file) return
    setBusy(mealId)
    setError('')
    try {
      await uploadMealImage(mealId, file)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  const done = MEALS.filter((m) => images.has(m.id)).length

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Meal photos</h1>
        <p className="text-white/45 text-sm font-body mt-1">
          Drop a picture on any meal. It appears on the Meal ideas tab straight away — no deploy.
        </p>
        <p className="text-white/35 text-xs font-body mt-2 tabular-nums">
          {loading ? 'Loading…' : `${done} of ${MEALS.length} have a photo`}
        </p>
      </header>

      {/* The whole reason to generate these rather than use stock: forty-four
          photographs from forty-four photographers look like a collage. One
          prompt, reused, looks like a product. */}
      <div className="mb-5 p-4 rounded-card bg-surface-raised border border-white/[0.10]">
        <p className="font-display font-bold text-white text-xs uppercase tracking-wide mb-2">
          Keep them consistent
        </p>
        <p className="text-white/50 text-xs font-body leading-relaxed">
          Use the same prompt shape for all forty-four, changing only the food. Something like:
          <span className="block mt-2 p-2.5 rounded-control bg-white/[0.04] text-white/70 font-mono text-2xs leading-relaxed">
            overhead photo of [the meal], on a plain matte dark surface, soft even
            daylight, no hands, no cutlery, no text, square crop
          </span>
          <span className="block mt-2">
            Square, and about 800&times;800 is plenty — these render around 300px wide. Anything over 3 MB is refused.
          </span>
        </p>
      </div>

      {error && (
        <p className="mb-4 px-3.5 py-2.5 rounded-control bg-state-danger/10 border border-state-danger/25 text-state-danger text-xs font-body">
          {error}
        </p>
      )}

      {SLOTS.map((slot) => {
        const meals = MEALS.filter((m) => m.slot === slot.key)
        const slotDone = meals.filter((m) => images.has(m.id)).length
        return (
          <section key={slot.key} className="mb-6">
            <h2 className="font-display font-bold text-white/40 text-2xs uppercase tracking-[0.15em] mb-2.5">
              {slot.label} <span className="text-white/25">· {slotDone} of {meals.length}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {meals.map((meal) => {
                const url = images.get(meal.id)
                return (
                  <div
                    key={meal.id}
                    className={`flex items-center gap-3 p-2.5 rounded-card border transition-colors ${
                      url ? 'bg-surface-raised border-white/[0.10]' : 'bg-white/[0.02] border-dashed border-white/[0.12]'
                    }`}
                  >
                    <div className="w-14 h-14 shrink-0 rounded-control overflow-hidden bg-white/[0.04] flex items-center justify-center">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white/20 text-2xs font-body">none</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-body leading-snug truncate">{meal.name}</p>
                      <p className="text-white/25 text-2xs font-mono mt-0.5">{meal.id}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          onClick={() => inputs.current[meal.id]?.click()}
                          disabled={busy === meal.id}
                          className="text-brand-blue hover:text-white text-2xs font-display font-bold uppercase tracking-wide disabled:opacity-40 transition-colors"
                        >
                          {busy === meal.id ? 'Uploading…' : url ? 'Replace' : 'Add photo'}
                        </button>
                        {url && (
                          <button
                            onClick={async () => {
                              setBusy(meal.id)
                              try { await removeMealImage(meal.id); await load() } finally { setBusy(null) }
                            }}
                            className="text-white/25 hover:text-state-danger text-2xs font-body transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      ref={(el) => { inputs.current[meal.id] = el }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => { void onPick(meal.id, e.target.files?.[0]); e.target.value = '' }}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
