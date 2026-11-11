'use client'

/**
 * Drop every meal photo in at once.
 *
 * The per-meal buttons below this are fine for replacing one picture, but
 * forty-four of them is forty-four clicks, each preceded by finding the right
 * file in a picker. That is the job that was being done by sending images to
 * Claude one batch at a time, which works but needs someone in the loop.
 *
 * So: drop the whole folder. Files whose name is a meal id (b4.jpg) are
 * matched outright. Files with a generator's own name
 * (Gemini_Generated_Image_a7f3.png) are assigned, in the order they were
 * dropped, to the meals still missing a photo — because that is the order
 * they were almost certainly generated in, working down the prompt file.
 *
 * Nothing uploads until the matches are confirmed. Every row can be
 * reassigned, which is the whole safety story: a wrong guess costs one
 * dropdown, not a wrong picture sitting on a meal nobody notices.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { MEALS, type MealSlot } from '@/lib/meal-library'
import { uploadMealImage } from '@/lib/meal-images'

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 3 * 1024 * 1024

interface Row {
  file: File
  preview: string
  mealId: string | null
  /** How the meal was chosen, so the UI can be honest about a guess. */
  how: 'filename' | 'order' | 'manual' | 'none'
  status: 'ready' | 'uploading' | 'done' | 'failed'
  message?: string
}

/** Meals in the order they appear in the library, grouped by slot. */
function orderedMeals() {
  const out: typeof MEALS = []
  for (const slot of SLOT_ORDER) {
    for (const m of MEALS) if (m.slot === slot) out.push(m)
  }
  return out
}

export default function BulkMealUpload({
  haveIds,
  onUploaded,
}: {
  /** Meal ids that already have a photo. */
  haveIds: string[]
  onUploaded: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const picker = useRef<HTMLInputElement | null>(null)

  const ordered = useMemo(() => orderedMeals(), [])

  const accept = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const byId: Record<string, true> = {}
      MEALS.forEach((m) => { byId[m.id] = true })

      // Meals with no picture yet, in library order: the queue an unnamed
      // file falls into.
      const missing = ordered
        .filter((m) => haveIds.indexOf(m.id) === -1)
        .map((m) => m.id)

      const claimed: Record<string, true> = {}
      const next: Row[] = []

      const list: File[] = []
      for (let i = 0; i < files.length; i++) list.push(files[i])

      // Two passes, so a file that names its meal always wins the slot over
      // a file that is only guessing at it.
      const named: Array<{ file: File; mealId: string }> = []
      const unnamed: File[] = []
      for (const file of list) {
        const dot = file.name.lastIndexOf('.')
        const stem = (dot > 0 ? file.name.slice(0, dot) : file.name).toLowerCase().trim()
        if (byId[stem]) {
          named.push({ file, mealId: stem })
          claimed[stem] = true
        } else {
          unnamed.push(file)
        }
      }

      for (const n of named) {
        next.push({ file: n.file, preview: URL.createObjectURL(n.file), mealId: n.mealId, how: 'filename', status: 'ready' })
      }

      let cursor = 0
      for (const file of unnamed) {
        while (cursor < missing.length && claimed[missing[cursor]]) cursor++
        const mealId = cursor < missing.length ? missing[cursor] : null
        if (mealId) { claimed[mealId] = true; cursor++ }
        next.push({ file, preview: URL.createObjectURL(file), mealId, how: mealId ? 'order' : 'none', status: 'ready' })
      }

      setRows((prev) => prev.concat(next))
    },
    [haveIds, ordered]
  )

  const reassign = (index: number, mealId: string) =>
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, mealId: mealId || null, how: mealId ? 'manual' : 'none', message: undefined } : r))
    )

  const remove = (index: number) =>
    setRows((prev) => {
      const r = prev[index]
      if (r) URL.revokeObjectURL(r.preview)
      return prev.filter((_, i) => i !== index)
    })

  const uploadAll = async () => {
    if (running) return
    setRunning(true)
    // Sequential on purpose: a browser firing forty parallel uploads at
    // Storage is how you get half of them refused and no idea which half.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.mealId || row.status === 'done') continue
      if (row.file.size > MAX_BYTES) {
        setRows((p) => p.map((r, j) => (j === i ? { ...r, status: 'failed', message: `${Math.round(row.file.size / 1024)} KB is over the 3 MB limit` } : r)))
        continue
      }
      setRows((p) => p.map((r, j) => (j === i ? { ...r, status: 'uploading' } : r)))
      try {
        await uploadMealImage(row.mealId, row.file)
        setRows((p) => p.map((r, j) => (j === i ? { ...r, status: 'done' } : r)))
      } catch (e) {
        setRows((p) => p.map((r, j) => (j === i ? { ...r, status: 'failed', message: e instanceof Error ? e.message : 'Upload failed' } : r)))
      }
    }
    setRunning(false)
    onUploaded()
  }

  const clearDone = () => {
    setRows((prev) => {
      prev.forEach((r) => { if (r.status === 'done') URL.revokeObjectURL(r.preview) })
      return prev.filter((r) => r.status !== 'done')
    })
  }

  const pending = rows.filter((r) => r.mealId && r.status !== 'done').length
  const doneCount = rows.filter((r) => r.status === 'done').length
  const guesses = rows.filter((r) => r.how === 'order' && r.status !== 'done').length

  return (
    <section className="mb-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files) }}
        onClick={() => picker.current?.click()}
        className={`cursor-pointer rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 ${
          dragging ? 'border-brand-blue/60 bg-brand-blue/[0.07]' : 'border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05]'
        }`}
      >
        <p className="font-display font-bold text-white text-base">
          Drop all your meal photos here
        </p>
        <p className="text-ink-3 text-xs font-body mt-1.5 max-w-md mx-auto leading-relaxed">
          As many at once as you like. Name a file after its meal
          (<span className="font-mono text-ink-2">b4.jpg</span>) and it goes straight there;
          anything else is matched in order to the meals still missing a picture, and you
          confirm before anything uploads.
        </p>
        <input
          ref={picker}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { accept(e.target.files); e.target.value = '' }}
        />
      </div>

      {rows.length > 0 && (
        <div className="mt-4 rounded-card bg-surface-raised border border-white/[0.10] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.08]">
            <p className="text-ink-2 text-xs font-body">
              {pending} to upload
              {doneCount > 0 && <span className="text-state-success"> · {doneCount} done</span>}
              {guesses > 0 && <span className="text-state-warning"> · {guesses} matched by order, check them</span>}
            </p>
            <div className="flex items-center gap-3">
              {doneCount > 0 && !running && (
                <button onClick={clearDone} className="text-ink-3 hover:text-white text-2xs font-body transition-colors">
                  Clear finished
                </button>
              )}
              <button
                onClick={() => void uploadAll()}
                disabled={running || pending === 0}
                className="px-4 py-2 rounded-control bg-brand-orange text-white text-2xs font-display font-bold uppercase tracking-wide disabled:opacity-40 hover:bg-brand-orangedark transition-colors"
              >
                {running ? 'Uploading…' : `Upload ${pending}`}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-white/[0.06] max-h-[420px] overflow-y-auto">
            {rows.map((row, i) => (
              <li key={`${row.file.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-12 h-12 shrink-0 rounded-control overflow-hidden bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.preview} alt="" className="w-full h-full object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-ink-2 text-2xs font-mono truncate">{row.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={row.mealId ?? ''}
                      onChange={(e) => reassign(i, e.target.value)}
                      disabled={running || row.status === 'done'}
                      className="bg-[#222] border border-white/[0.12] rounded-control text-white text-2xs font-body px-2 py-1 max-w-[260px] disabled:opacity-50"
                    >
                      <option value="">— not assigned —</option>
                      {ordered.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} · {m.name}
                        </option>
                      ))}
                    </select>
                    {row.how === 'order' && row.status === 'ready' && (
                      <span className="text-state-warning text-2xs font-body">guessed</span>
                    )}
                    {row.how === 'filename' && row.status === 'ready' && (
                      <span className="text-ink-4 text-2xs font-body">from filename</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {row.status === 'uploading' && <span className="text-brand-blue text-2xs font-body">uploading…</span>}
                  {row.status === 'done' && <span className="text-state-success text-2xs font-body">done</span>}
                  {row.status === 'failed' && <span className="text-state-danger text-2xs font-body">{row.message ?? 'failed'}</span>}
                  {row.status === 'ready' && !running && (
                    <button onClick={() => remove(i)} className="text-ink-4 hover:text-state-danger text-2xs font-body transition-colors">
                      remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
