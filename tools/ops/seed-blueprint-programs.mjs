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
 *   node tools/ops/seed-blueprint-programs.mjs --confirm  # upsert the templates
 *
 * Idempotent: --confirm upserts on (goal, split_key, location), so programs.id
 * is stable and live client assignments survive. It no longer deletes and
 * reinserts, which used to cascade through program_assignments and strip every
 * client's program.
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
    // A split may restrict which goals it makes sense under. The hybrid tracks
    // use this: a lean-out scheme with its conditioning finisher bolted onto a
    // program that already runs three times a week is just more fatigue, and a
    // hypertrophy rep scheme applied to a sprint drill defeats the drill.
    if (Array.isArray(split.goals) && !split.goals.includes(goalKey)) continue
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
  const gs = Array.isArray(split.goals) ? split.goals : Object.keys(goals)
  console.log(
    `  ${split.recommended ? '✅' : '  '} ${split.label}  (${split.days_per_week}d) — ` +
      `${gs.length * 2} programs (${gs.join('/')} × gym/home)`
  )
}

requireConfirm(
  args,
  `Upsert ${plan.length} Blueprint templates in place (existing client assignments preserved)`
)

// ---- upsert in place ----
//
// This used to delete every source='blueprint' program and reinsert. That
// cascaded through program_assignments and silently dropped every client's
// assigned program — there are live clients on these templates now, so a
// reseed would have wiped their programs.
//
// Programs are matched on the (goal, split_key, location) unique index and
// updated in place, so programs.id is stable and assignments survive. Only the
// day/exercise content underneath is replaced.
let nP = 0, nD = 0, nE = 0, nNew = 0
for (const item of plan) {
  const { goal, split_key, location } = item.program

  const { data: existing, error: findErr } = await sb
    .from('programs')
    .select('id')
    .eq('source', 'blueprint')
    .eq('goal', goal)
    .eq('split_key', split_key)
    .eq('location', location)
    .maybeSingle()
  if (findErr) fail(`Lookup failed for "${item.program.name}": ${findErr.message}`)

  let programId
  if (existing) {
    const { error: uErr } = await sb.from('programs').update(item.program).eq('id', existing.id)
    if (uErr) fail(`Update failed for "${item.program.name}": ${uErr.message}`)
    programId = existing.id
    // Replacing the days cascades to their exercises.
    const { error: dDelErr } = await sb.from('program_days').delete().eq('program_id', programId)
    if (dDelErr) fail(`Could not clear days for "${item.program.name}": ${dDelErr.message}`)
  } else {
    const { data: prog, error: pErr } = await sb.from('programs').insert(item.program).select('id').single()
    if (pErr) {
      fail(`Insert failed for "${item.program.name}": ${pErr.message}` +
        (/column .* does not exist/i.test(pErr.message) ? '\n  → Did you apply migration 0010 first?' : ''))
    }
    programId = prog.id
    nNew++
  }
  nP++

  const dayRows = item.days.map((d) => ({
    program_id: programId, day_index: d.day_index, name: d.name, focus: d.focus, notes: d.notes,
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

// Templates that no longer exist in the library are left alone when a client is
// still assigned to one. Orphaning a live client is worse than a stale row.
const planKeys = new Set(plan.map((p) => `${p.program.goal}|${p.program.split_key}|${p.program.location}`))
const { data: allBp } = await sb.from('programs').select('id, name, goal, split_key, location').eq('source', 'blueprint')
const stale = (allBp ?? []).filter((p) => !planKeys.has(`${p.goal}|${p.split_key}|${p.location}`))
let nRetired = 0
for (const s of stale) {
  const { data: open } = await sb
    .from('program_assignments')
    .select('id')
    .eq('program_id', s.id)
    .is('ended_at', null)
    .limit(1)
  if (open && open.length) {
    console.log(`  ⚠ keeping "${s.name}" — a client is still assigned to it`)
    continue
  }
  await sb.from('programs').delete().eq('id', s.id)
  nRetired++
}

await logAction({
  action: 'seed-blueprint-programs',
  target: 'blueprint',
  summary: `Upserted ${nP} Blueprint templates (${nNew} new, ${nD} days, ${nE} exercises, ${nRetired} retired)`,
  detail: { programs: nP, created: nNew, days: nD, exercises: nE, retired: nRetired },
})

console.log(`\n✅ ${nP} programs upserted (${nNew} new, ${nRetired} retired), ${nD} days, ${nE} exercises.`)
console.log('   Existing client assignments were preserved.')
process.exit(0)
