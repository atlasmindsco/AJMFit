'use client'

/**
 * What the coach sees before assigning a program.
 *
 * The point of this panel is NOT that it picks the template — goal plus days
 * plus location identifies one seeded program out of 69, and that is a lookup
 * anyone could do. The point is the flags: the thirty seconds of reading a
 * client's assessment that a coach does before changing anything, done for
 * them, so the knee that will not like day one's squats is on screen next to
 * the Assign button rather than three clicks away in a form.
 *
 * Nothing here changes a program. It shows the pick, says why, says what is
 * wrong with it, and then waits. Editing happens in the builder, assigning
 * happens on the button, and both are the coach's.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { matchProgram, type Match } from '@/lib/program-match'
import { estimateMinutes } from '@/lib/builder-rules'
import { GOAL_LABELS, LOCATION_LABELS } from '@/lib/splits'
import type { OnboardingAnswers } from '@/lib/onboarding'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface Loaded {
  answers: OnboardingAnswers | null
  programId: string | null
  programName: string | null
  match: Match
}

const EXPERIENCE_WORDS: Record<string, string> = {
  new: 'New to training',
  returning: 'Coming back after a break',
  consistent: 'Training consistently',
}

export default function ProgramRecommendation({
  userId,
  clientName,
  onAssigned,
}: {
  userId: string
  clientName?: string
  onAssigned?: () => void
}) {
  const [data, setData] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [assigned, setAssigned] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: form } = await db
        .from('onboarding_forms')
        .select('answers')
        .eq('user_id', userId)
        .maybeSingle()
      const answers: OnboardingAnswers = form?.answers ?? {}

      // First pass with no exercises: enough to resolve which template.
      const first = matchProgram({ answers })
      let programId: string | null = null
      let programName: string | null = null
      let exerciseNames: string[] = []
      let minutesPerDay = 0

      if (first.ready) {
        const { data: prog } = await db
          .from('programs')
          .select('id, name')
          .eq('source', 'blueprint')
          .eq('goal', first.goal)
          .eq('split_key', first.splitKey)
          .eq('location', first.location)
          .maybeSingle()
        if (prog) {
          programId = prog.id
          programName = prog.name
          const { data: days } = await db.from('program_days').select('id').eq('program_id', prog.id)
          const dayIds = (days ?? []).map((d: { id: string }) => d.id)
          if (dayIds.length) {
            const { data: exs } = await db
              .from('program_exercises')
              .select('exercise_name, program_day_id, sets, reps, rest_seconds')
              .in('program_day_id', dayIds)
            type ExRow = {
              exercise_name: string
              program_day_id: string
              sets: number | null
              reps: string | null
              rest_seconds: number | null
            }
            const rows = (exs ?? []) as ExRow[]
            exerciseNames = rows.map((e) => e.exercise_name)
            // The real estimator, averaged over the days. This used to hand
            // the matcher an exercise COUNT and let it guess nine minutes
            // apiece, which understated every day with a run in it — a
            // 45-minute long run counted as nine minutes.
            minutesPerDay = Math.round(
              dayIds
                .map((id: string) =>
                  estimateMinutes(
                    rows
                      .filter((e) => e.program_day_id === id)
                      .map((e) => ({
                        sets: e.sets ?? 3,
                        restSeconds: e.rest_seconds ?? 60,
                        reps: e.reps,
                      }))
                  )
                )
                .reduce((total: number, m: number) => total + m, 0) / dayIds.length
            )
          }
        }
      }

      // Second pass, now that the flags have exercises to scan.
      const match = matchProgram({ answers, exerciseNames, minutesPerDay })
      setData({ answers, programId, programName, match })
    } catch (e) {
      console.error('[ProgramRecommendation] load failed', e)
      setError('Could not work out a recommendation.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const assign = async () => {
    if (!data?.programId || assigning) return
    setAssigning(true)
    setError('')
    try {
      const res = await fetch('/api/admin/assign-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          programId: data.programId,
          note: `Assigned from assessment: ${data.match.because.join(' · ')}`,
        }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Assign failed')
      setAssigned(true)
      onAssigned?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign that program.')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-card bg-surface-raised border border-white/[0.10] p-6">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null
  const { answers, match } = data

  // No assessment yet. Say so plainly rather than recommending from nothing —
  // a confident guess built on no answers is worse than an empty panel.
  if (!match.ready) {
    return (
      <div className="rounded-card bg-surface-raised border border-white/[0.10] p-6">
        <h3 className="font-display font-bold text-white text-heading uppercase tracking-wide">Recommended program</h3>
        <p className="text-ink-3 text-body font-body mt-2 leading-relaxed">
          {Object.keys(answers ?? {}).length === 0
            ? `${clientName ?? 'This client'} has not filled in the assessment yet, so there is nothing to match on.`
            : 'The assessment is missing goal, days or location, so no template matches cleanly.'}{' '}
          You can still assign one by hand below.
        </p>
      </div>
    )
  }

  const warns = match.flags.filter((f) => f.level === 'warn')
  const checks = match.flags.filter((f) => f.level === 'check')

  return (
    <div className="rounded-card bg-surface-raised border border-white/[0.10] overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.08]">
        <h3 className="font-display font-bold text-white text-heading uppercase tracking-wide">Recommended program</h3>
        <p className="font-display font-extrabold text-white text-lg mt-1.5 leading-tight">
          {data.programName ?? match.splitLabel}
        </p>
        <p className="text-ink-3 text-label font-body mt-1">
          {match.goal ? GOAL_LABELS[match.goal] : ''} · {match.days} days ·{' '}
          {match.location ? LOCATION_LABELS[match.location].toLowerCase() : ''}
        </p>
      </div>

      <div className="px-6 py-5 border-b border-white/[0.08]">
        <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-[0.14em] mb-2.5">
          Recommended because
        </p>
        <ul className="space-y-1.5">
          {match.because.map((b) => (
            <li key={b} className="text-ink-2 text-body font-body flex gap-2">
              <span className="text-ink-4">·</span>
              {b}
            </li>
          ))}
        </ul>
        {answers?.experience && (
          <p className="text-ink-4 text-caption font-body mt-3">{EXPERIENCE_WORDS[answers.experience] ?? ''}</p>
        )}
      </div>

      {/* Flags, loudest first. An empty state here is worth saying out loud:
          "nothing to flag" is information, and silence looks like a bug. */}
      <div className="px-6 py-5 border-b border-white/[0.08]">
        <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-[0.14em] mb-2.5">
          Before you assign
        </p>
        {match.flags.length === 0 ? (
          <p className="text-ink-3 text-body font-body">
            Nothing to flag. No injuries mentioned, equipment matches, sessions fit the time they gave.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {[...warns, ...checks].map((f) => (
              <li
                key={f.title}
                className={`rounded-control border px-3.5 py-2.5 ${
                  f.level === 'warn'
                    ? 'bg-state-warning/[0.08] border-state-warning/30'
                    : 'bg-white/[0.03] border-white/[0.10]'
                }`}
              >
                <p
                  className={`font-display font-bold text-label uppercase tracking-wide ${
                    f.level === 'warn' ? 'text-state-warning' : 'text-ink-2'
                  }`}
                >
                  {f.title}
                </p>
                <p className="text-ink-2 text-body font-body mt-1 leading-relaxed">{f.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {answers?.injuries?.trim() && (
        <div className="px-6 py-5 border-b border-white/[0.08]">
          <p className="text-ink-3 text-caption font-display font-bold uppercase tracking-[0.14em] mb-2">
            What they wrote
          </p>
          <p className="text-ink-2 text-body font-body leading-relaxed">{answers.injuries}</p>
          {answers.anythingElse?.trim() && (
            <p className="text-ink-2 text-body font-body leading-relaxed mt-2">{answers.anythingElse}</p>
          )}
        </div>
      )}

      <div className="px-6 py-5">
        {error && <p className="text-state-danger text-label font-body mb-3">{error}</p>}
        {assigned ? (
          <p className="text-state-success text-body font-body">
            Assigned. {clientName ?? 'They'} can start training now.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void assign()}
              disabled={assigning || !data.programId}
              className="px-5 py-2.5 rounded-control bg-brand-orange text-white text-label font-display font-bold uppercase tracking-wide hover:bg-brand-orangedark disabled:opacity-40 transition-colors"
            >
              {assigning ? 'Assigning…' : 'Assign this program'}
            </button>
            <Link
              href="/luffy/programs"
              className="text-ink-2 hover:text-white text-label font-display font-bold uppercase tracking-wide transition-colors"
            >
              Edit it first
            </Link>
            {warns.length > 0 && (
              <span className="text-state-warning text-caption font-body">
                {warns.length} thing{warns.length === 1 ? '' : 's'} worth changing first
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
