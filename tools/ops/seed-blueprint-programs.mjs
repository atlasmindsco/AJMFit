/**
 * SEED BLUEPRINT PROGRAMS — load the pre-made Blueprint program library into the
 * DB so Blueprint (self-guided, no-coaching) clients can self-pick a program by
 * Goal + Days/week + Location.
 *
 * Source of truth: program-library/blueprint-library.json (authored + reviewed).
 * Generates 3 goals × 5 splits × 2 locations = 30 programs. Goal sets the
 * sets/reps/rest (by exercise role); location swaps gym ↔ dumbbell exercise.
 *
 * Requires migration 0010 (adds programs.goal/location/split_key/recommended).
 *
 *   node tools/ops/seed-blueprint-programs.mjs            # DRY RUN — prints the plan
 *   node tools/ops/seed-blueprint-programs.mjs --confirm  # wipe & reseed blueprint templates
 *
 * Idempotent: --confirm deletes existing source='blueprint' programs first, then
 * reinserts. (A reseed drops any current blueprint self-assignments via cascade —
 * fine pre-launch; revisit once clients are actively on these.)
 */
import { readFileSync } from 'node:fs'
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const lib = JSON.parse(
  readFileSync(new URL('../../program-library/blueprint-library.json', import.meta.url), 'utf8')
)
const { goals, splits } = lib
const LOCATIONS = [
  { key: 'gym', label: 'Gym', pick: (ex) => ex.gym },
  { key: 'home', label: 'Home', pick: (ex) => ex.home },
]

// ---- build the full plan in memory (so dry-run shows exactly what will write) ----
const plan = []
for (const [goalKey, goal] of Object.entries(goals)) {
  for (const [splitKey, split] of Object.entries(splits)) {
    for (const loc of LOCATIONS) {
      const days = split.days.map((d, di) => {
        const notes = [
          d.note || '',
          d.activeRest ? '' : (goal.dayNote || ''), // lean-out finisher, not on rest days
        ].filter(Boolean).join(' ')
        return {
          day_index: di + 1,
          name: d.name,
          focus: d.focus || null,
          notes: notes || null,
          exercises: d.exercises.map((ex, xi) => {
            const scheme = goal.byRole[ex.role] || {}
            return {
              order_index: xi + 1,
              exercise_name: loc.pick(ex),
              sets: scheme.sets ?? null,
              reps: scheme.reps ?? null,
              rest_seconds: scheme.rest_seconds ?? null,
              tempo: null,
              superset_group: null,
              notes: null,
            }
          }),
        }
      })
      plan.push({
        program: {
          name: `Blueprint · ${goal.label} · ${split.label} · ${loc.label}`,
          description: `${goal.description} ${split.note}`.trim(),
          level: 'All Levels',
          days_per_week: split.days_per_week,
          split: split.label,
          source: 'blueprint',
          goal: goalKey,
          location: loc.key,
          split_key: splitKey,
          recommended: !!split.recommended,
        },
        days,
      })
    }
  }
}

const totalDays = plan.reduce((n, p) => n + p.days.length, 0)
const totalEx = plan.reduce((n, p) => n + p.days.reduce((m, d) => m + d.exercises.length, 0), 0)

console.log(`\nBlueprint program library → ${plan.length} programs, ${totalDays} days, ${totalEx} exercises.`)
console.log(`Goals: ${Object.keys(goals).length} · Splits: ${Object.keys(splits).length} · Locations: 2\n`)
for (const [splitKey, split] of Object.entries(splits)) {
  console.log(`  ${split.recommended ? '✅' : '  '} ${split.label}  (${split.days_per_week}d) — 6 programs (3 goals × gym/home)`)
}

requireConfirm(args, `Replace all source='blueprint' programs with ${plan.length} freshly-seeded templates`)

// ---- wipe existing blueprint templates (cascade clears their days/exercises) ----
const { error: delErr } = await sb.from('programs').delete().eq('source', 'blueprint')
if (delErr) fail(`Could not clear existing blueprint programs: ${delErr.message}`)

// ---- insert ----
let nP = 0, nD = 0, nE = 0
for (const item of plan) {
  const { data: prog, error: pErr } = await sb.from('programs').insert(item.program).select('id').single()
  if (pErr) {
    fail(`Insert failed for "${item.program.name}": ${pErr.message}` +
      (/column .* does not exist/i.test(pErr.message) ? '\n  → Did you apply migration 0010 first?' : ''))
  }
  nP++

  const dayRows = item.days.map((d) => ({
    program_id: prog.id, day_index: d.day_index, name: d.name, focus: d.focus, notes: d.notes,
  }))
  const { data: insertedDays, error: dErr } = await sb.from('program_days').insert(dayRows).select('id, day_index')
  if (dErr) fail(`Days failed for "${item.program.name}": ${dErr.message}`)
  nD += insertedDays.length

  const idByIndex = new Map(insertedDays.map((r) => [r.day_index, r.id]))
  const exRows = []
  for (const d of item.days) {
    const dayId = idByIndex.get(d.day_index)
    for (const ex of d.exercises) exRows.push({ program_day_id: dayId, ...ex })
  }
  if (exRows.length) {
    const { error: eErr } = await sb.from('program_exercises').insert(exRows)
    if (eErr) fail(`Exercises failed for "${item.program.name}": ${eErr.message}`)
    nE += exRows.length
  }
}

await logAction({
  action: 'seed-blueprint-programs',
  target: 'blueprint',
  summary: `Seeded ${nP} Blueprint program templates (${nD} days, ${nE} exercises)`,
  detail: { programs: nP, days: nD, exercises: nE },
})

console.log(`\n✅ Seeded ${nP} programs, ${nD} days, ${nE} exercises. Blueprint clients can now be shown the picker.`)
process.exit(0)
