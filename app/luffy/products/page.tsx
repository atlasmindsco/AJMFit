'use client'

/**
 * Managing what AJM Recommends shows.
 *
 * The brief was that Anthony should never need a developer to change a link,
 * so everything a product has is editable here: the copy, the category, the
 * image, the URL, the order, and whether it is visible at all.
 *
 * New products start hidden. Drafting a recommendation should not put a
 * half-written one in front of a client, and the alternative — writing it
 * live and hoping nobody loads the page — is how a typo reaches someone.
 *
 * Images are a pasted URL rather than an upload. The only storage bucket in
 * this project is private and signed-URL based for progress photos; adding a
 * public bucket, an upload widget and a read policy is real work to solve what
 * pasting the product image address already solves.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  fetchAllRecommendations,
  saveRecommendation,
  deleteRecommendation,
  fetchClickCounts,
  CATEGORIES,
  DISCLOSURE_SHORT,
  type Recommendation,
} from '@/lib/recommendations'

type Draft = Partial<Recommendation> & { name: string; category: string; external_url: string }

const EMPTY: Draft = {
  name: '',
  category: 'Protein',
  external_url: '',
  merchant: 'Amway',
  image_url: '',
  why_recommended: '',
  what_it_is: '',
  who_it_suits: '',
  how_used: '',
  worth_knowing: '',
  sort_order: 0,
  is_active: false,
  is_featured: false,
}

export default function ProductsAdmin() {
  const [items, setItems] = useState<Recommendation[]>([])
  const [clicks, setClicks] = useState<Map<string, number>>(new Map())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, counts] = await Promise.all([fetchAllRecommendations(), fetchClickCounts().catch(() => new Map())])
      setItems(rows)
      setClicks(counts)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim() || !draft.external_url.trim()) {
      setError('A product needs a name and a link.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveRecommendation({ ...draft, name: draft.name.trim(), external_url: draft.external_url.trim() })
      setDraft(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (item: Recommendation, field: 'is_active' | 'is_featured') => {
    await saveRecommendation({ ...item, [field]: !item[field] })
    await load()
  }

  const move = async (item: Recommendation, delta: number) => {
    await saveRecommendation({ ...item, sort_order: (item.sort_order ?? 0) + delta })
    await load()
  }

  const field = 'w-full px-3 py-2.5 rounded-control bg-white/[0.04] border border-white/[0.08] text-white text-sm font-body placeholder:text-white/25 focus:outline-none focus:border-brand-blue/50'
  const label = 'block text-white/40 text-2xs font-display font-bold uppercase tracking-wide mb-1.5'

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">AJM Recommends</h1>
        <p className="text-white/45 text-sm font-body mt-1">
          What clients see under Nutrition. Hidden products are invisible to them.
        </p>
        <p className="text-white/30 text-xs font-body mt-2">
          Every product shows &ldquo;{DISCLOSURE_SHORT}&rdquo; under its button.
        </p>
      </header>

      {!draft && (
        <button
          onClick={() => setDraft({ ...EMPTY, sort_order: items.length })}
          className="w-full mb-4 py-3.5 rounded-card bg-brand-blue text-white text-sm font-display font-bold uppercase tracking-wide hover:bg-brand-bluedark active:scale-[0.99] transition-all"
        >
          + Add a product
        </button>
      )}

      {draft && (
        <div className="mb-5 p-4 rounded-card bg-surface-raised border border-white/[0.12] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="p-name">Name</label>
              <input id="p-name" className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nutrilite Protein Powder" />
            </div>
            <div>
              <label className={label} htmlFor="p-cat">Category</label>
              <select id="p-cat" className={field} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="p-url">Link (where the button goes)</label>
            <input id="p-url" className={field} value={draft.external_url} onChange={(e) => setDraft({ ...draft, external_url: e.target.value })} placeholder="https://www.amway.com/myshop/..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="p-merchant">Store name (shown on the button)</label>
              <input id="p-merchant" className={field} value={draft.merchant ?? ''} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} placeholder="Amway" />
            </div>
            <div>
              <label className={label} htmlFor="p-img">Image URL</label>
              <input id="p-img" className={field} value={draft.image_url ?? ''} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="p-why">Why you recommend it — this is the card</label>
            <textarea id="p-why" rows={2} className={field} value={draft.why_recommended ?? ''} onChange={(e) => setDraft({ ...draft, why_recommended: e.target.value })} placeholder="What I reach for when hitting 150g from food alone is the thing in the way." />
          </div>

          {/* The four detail headings. Shaped to make "what it is" easy to
              write and "what it does to you" awkward — see Recommends.tsx. */}
          {([
            ['what_it_is', 'What it is'],
            ['who_it_suits', 'Who it may suit'],
            ['how_used', 'How it is commonly used'],
            ['worth_knowing', 'Worth knowing'],
          ] as Array<[keyof Draft, string]>).map(([key, heading]) => (
            <div key={String(key)}>
              <label className={label} htmlFor={`p-${String(key)}`}>{heading} <span className="text-white/20">(optional)</span></label>
              <textarea
                id={`p-${String(key)}`}
                rows={2}
                className={field}
                value={(draft[key] as string) ?? ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </div>
          ))}

          <p className="text-white/30 text-xs font-body leading-relaxed">
            Describe what it is and who it suits. Avoid saying what it does to the body — &ldquo;supports
            recovery&rdquo; is a health claim with rules attached, &ldquo;this is what I use after
            training&rdquo; is not.
          </p>

          {error && <p className="text-state-danger text-xs font-body">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setDraft(null); setError('') }} className="px-5 py-3 rounded-control bg-white/[0.06] text-white/70 text-xs font-display font-bold uppercase tracking-wide hover:bg-white/[0.1] transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-control bg-brand-blue text-white text-xs font-display font-bold uppercase tracking-wide hover:bg-brand-bluedark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-white/30 text-sm font-body py-8 text-center">Loading…</p>}

      {!loading && items.length === 0 && !draft && (
        <p className="text-white/30 text-sm font-body py-10 text-center">
          No products yet. Clients see an empty section until you add one.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="rounded-card bg-surface-raised border border-white/[0.10] px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-white text-sm font-display font-bold truncate">{item.name}</span>
                  {!item.is_active && (
                    <span className="shrink-0 text-2xs font-display font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50">Hidden</span>
                  )}
                  {item.is_featured && (
                    <span className="shrink-0 text-2xs font-display font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-orange/20 text-brand-orange">Featured</span>
                  )}
                </span>
                <span className="block text-white/35 text-xs font-body mt-0.5">
                  {item.category} · {item.merchant}
                  {clicks.get(item.id) ? ` · opened ${clicks.get(item.id)} times` : ''}
                </span>
              </span>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => void move(item, -1)} disabled={i === 0} className="w-7 h-6 rounded bg-white/[0.05] text-white/50 text-xs disabled:opacity-20 transition-opacity" aria-label="Move up">&uarr;</button>
                <button onClick={() => void move(item, 1)} disabled={i === items.length - 1} className="w-7 h-6 rounded bg-white/[0.05] text-white/50 text-xs disabled:opacity-20 transition-opacity" aria-label="Move down">&darr;</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2.5">
              <button onClick={() => setDraft(item)} className="text-white/45 hover:text-white text-2xs font-body transition-colors">Edit</button>
              <button onClick={() => void toggle(item, 'is_active')} className="text-white/45 hover:text-white text-2xs font-body transition-colors">
                {item.is_active ? 'Hide from clients' : 'Show to clients'}
              </button>
              <button onClick={() => void toggle(item, 'is_featured')} className="text-white/45 hover:text-white text-2xs font-body transition-colors">
                {item.is_featured ? 'Unfeature' : 'Feature'}
              </button>
              <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="text-white/45 hover:text-white text-2xs font-body transition-colors">Test link ↗</a>
              <button
                onClick={async () => { await deleteRecommendation(item.id); await load() }}
                className="text-white/25 hover:text-state-danger text-2xs font-body transition-colors ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
