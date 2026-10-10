/**
 * The program health check, against every program AJM Fit ships.
 *
 * The contract: run it over all 68 seeded programs and not one WARNING may
 * fire. A check that tells a client the program their coach sold them is
 * broken has failed at something more important than being right, and it is
 * the only way to know the thresholds came from the data rather than from my
 * opinion about training.
 *
 * Needs DATABASE_URL, because the seeded content is the point. Without it the
 * synthetic half still runs and the real half is skipped loudly.
 */
import { readFileSync } from 'node:fs'
import { reviewProgram, volumeOf, healthSummary, type Finding } from '../lib/program-health.ts'
import type { LibraryExercise } from '../lib/builder-rules.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 56), detail)
}

const LIB: LibraryExercise[] = JSON.parse(readFileSync('public/exercises/exercises.json', 'utf8'))
const byName = new Map(LIB.map((e) => [e.name, e]))
const lookup = (n: string) => byName.get(n) ?? null

const named = (name: string, sets = 3, restSeconds = 90) => ({ exerciseName: name, sets, restSeconds })
const codes = (fs: Finding[]) => fs.map((f) => f.code).sort().join(',')

/* Real exercises, so the muscle mapping is the real one. */
const BENCH = 'Barbell Bench Press - Medium Grip'
const ROW = 'Bent Over Barbell Row'
const SQUAT = 'Barbell Squat'
const CURL = 'Barbell Curl'
const PRESS = 'Standing Military Press'
const CRUNCH = 'Crunches'
const PUSHDOWN = 'Triceps Pushdown'
const RUN = 'Trail Running/Walking'

console.log('THE LIBRARY NAMES RESOLVE\n')
for (const n of [BENCH, ROW, SQUAT, CURL, PRESS, CRUNCH, PUSHDOWN, RUN]) {
  g(`"${n.slice(0, 40)}"`, Boolean(lookup(n)))
}

console.log('\nCOUNTING THE WEEK\n')
{
  const v = volumeOf(
    { days: [{ name: 'A', exercises: [named(BENCH, 4), named(ROW, 3)] }] },
    lookup
  )
  g('chest gets the bench sets', v.setsByGroup.chest === 4, String(v.setsByGroup.chest))
  g('back gets the row sets', v.setsByGroup.back === 3, String(v.setsByGroup.back))
  g('total is every set', v.totalSets === 7, String(v.totalSets))
  // Secondary muscles must NOT be counted: a bench press would otherwise
  // credit shoulders and triceps, and then nothing ever looks undertrained.
  g('the bench does not count as shoulders', v.setsByGroup.shoulders === 0, String(v.setsByGroup.shoulders))
  g('the bench does not count as arms', v.setsByGroup.arms === 0, String(v.setsByGroup.arms))

  const v2 = volumeOf(
    { days: [{ name: 'A', exercises: [named(BENCH)] }, { name: 'B', exercises: [named(BENCH)] }] },
    lookup
  )
  g('a group trained twice lists both days', v2.daysByGroup.chest.length === 2, JSON.stringify(v2.daysByGroup.chest))

  const v3 = volumeOf({ days: [{ name: 'A', exercises: [named('Not A Real Exercise')] }] }, lookup)
  g('an unknown name counts in the total', v3.totalSets === 3)
  g('but lands in no group', Object.values(v3.setsByGroup).every((x) => x === 0))
}

console.log('\nWHAT FIRES, AND WHAT DOES NOT\n')
{
  const empty = reviewProgram({ days: [] }, lookup)
  g('an empty program says nothing', empty.length === 0, 'canSave owns that')

  const restOnly = reviewProgram({ days: [{ name: 'Rest', exercises: [] }] }, lookup)
  g('a week of rest days says nothing', restOnly.length === 0)

  // A believable balanced week, inside every library range.
  const balanced = reviewProgram(
    {
      days: [
        { name: 'Upper A', exercises: [named(BENCH, 4, 150), named(ROW, 4, 150), named(PRESS, 3, 120), named(CURL, 3, 60)] },
        { name: 'Lower A', exercises: [named(SQUAT, 4, 150), named(CRUNCH, 3, 45)] },
        { name: 'Upper B', exercises: [named(BENCH, 3, 150), named(ROW, 4, 150), named(PUSHDOWN, 3, 60)] },
        { name: 'Lower B', exercises: [named(SQUAT, 4, 150), named(CRUNCH, 3, 45)] },
      ],
    },
    lookup
  )
  g('a balanced week is quiet', balanced.filter((f) => f.severity === 'warn').length === 0, codes(balanced))

  // Chest and no back at all.
  const noBack = reviewProgram(
    { days: [{ name: 'Push', exercises: [named(BENCH, 5, 150), named(PRESS, 4, 120), named(SQUAT, 4, 150), named(CURL, 3, 60), named(CRUNCH, 3, 45)] }] },
    lookup
  )
  g('a missing group warns', noBack.some((f) => f.code === 'missing_group'), noBack[0]?.title)
  g('and it names the group', Boolean(noBack.find((f) => f.code === 'missing_group')?.title.includes('back')))

  // Everything missing but one group is not six warnings, it is a choice.
  const armsOnly = reviewProgram({ days: [{ name: 'Arms', exercises: [named(CURL, 5, 60), named(PUSHDOWN, 5, 60)] }] }, lookup)
  g('an arms-only week still warns once', armsOnly.filter((f) => f.code === 'missing_group').length === 1, codes(armsOnly))
  g('and calls arms dominant', armsOnly.some((f) => f.code === 'dominant_group'))

  // Push/pull skew, with back present so it is a ratio not a gap.
  const skewed = reviewProgram(
    {
      days: [
        { name: 'A', exercises: [named(BENCH, 6, 150), named(PRESS, 5, 120), named(ROW, 2, 150), named(SQUAT, 5, 150), named(CURL, 3, 60), named(CRUNCH, 3, 45)] },
      ],
    },
    lookup
  )
  g('a push/pull skew warns', skewed.some((f) => f.code === 'push_pull_imbalance'), skewed.find((f) => f.code === 'push_pull_imbalance')?.title)
  g('and it is not reported as missing', !skewed.some((f) => f.code === 'missing_group'))

  // A ratio just inside the library's own worst case must stay quiet.
  const ratio24 = reviewProgram(
    { days: [{ name: 'A', exercises: [named(BENCH, 12, 150), named(ROW, 5, 150), named(SQUAT, 5), named(PRESS, 3), named(CURL, 3), named(CRUNCH, 3)] }] },
    lookup
  )
  g('a 2.4 ratio stays quiet', !ratio24.some((f) => f.code === 'push_pull_imbalance'), 'the bodybuilding split reaches 2.4')

  // Zero rest on a barbell compound.
  const noRest = reviewProgram(
    { days: [{ name: 'A', exercises: [named(SQUAT, 5, 0), named(ROW, 3, 150), named(BENCH, 3, 150), named(PRESS, 3), named(CURL, 3), named(CRUNCH, 3)] }] },
    lookup
  )
  g('no rest on a heavy lift warns', noRest.some((f) => f.code === 'no_rest_on_heavy'), noRest.find((f) => f.code === 'no_rest_on_heavy')?.title)

  // A DUMBBELL compound counts too. The first version only looked at barbells,
  // and a real client's home program — dumbbells throughout — had its rest
  // zeroed in simulation and produced nothing to flag.
  const noRestDb = reviewProgram(
    { days: [{ name: 'A', exercises: [named('Dumbbell Squat', 5, 0), named(ROW, 3, 150), named(BENCH, 3, 150), named(PRESS, 3), named(CURL, 3), named(CRUNCH, 3)] }] },
    lookup
  )
  g('no rest on a dumbbell compound warns', noRestDb.some((f) => f.code === 'no_rest_on_heavy'), noRestDb.find((f) => f.code === 'no_rest_on_heavy')?.title)

  // But a plyometric drill with no rest is correct, and the library ships one
  // the exercise data calls a compound.
  const drill = reviewProgram(
    { days: [{ name: 'Speed', exercises: [{ exerciseName: 'Linear Acceleration Wall Drill', sets: 4, restSeconds: 0 }, named(SQUAT, 4, 150), named(BENCH, 3, 150), named(ROW, 3, 150), named(PRESS, 3), named(CURL, 3), named(CRUNCH, 3)] }] },
    lookup
  )
  g('no rest on a wall drill does not warn', !drill.some((f) => f.code === 'no_rest_on_heavy'), 'the library has 56 such rows')

  // Zero rest on an isolation is a choice, not a mistake.
  const noRestIso = reviewProgram(
    { days: [{ name: 'A', exercises: [named(CURL, 3, 0), named(BENCH, 3, 150), named(ROW, 3, 150), named(SQUAT, 3), named(PRESS, 3), named(CRUNCH, 3)] }] },
    lookup
  )
  g('no rest on an isolation does not', !noRestIso.some((f) => f.code === 'no_rest_on_heavy'))

  // The same exercise twice — the bug found in the library itself.
  const dupe = reviewProgram(
    { days: [{ name: 'Push B', exercises: [named(BENCH, 3, 150), named(BENCH, 3, 150), named(ROW, 3), named(SQUAT, 3), named(PRESS, 3), named(CRUNCH, 3)] }] },
    lookup
  )
  g('a duplicate exercise warns', dupe.some((f) => f.code === 'duplicate_exercise'), dupe.find((f) => f.code === 'duplicate_exercise')?.title)
  g('and it names the day', Boolean(dupe.find((f) => f.code === 'duplicate_exercise')?.title.includes('Push B')))
  g('and points at the day index', dupe.find((f) => f.code === 'duplicate_exercise')?.dayIndex === 0)

  // A very long day.
  const long = reviewProgram(
    { days: [{ name: 'Everything', exercises: [named(SQUAT, 8, 180), named(BENCH, 8, 180), named(ROW, 8, 180), named(PRESS, 5, 150), named(CURL, 4, 60), named(CRUNCH, 4, 45)] }] },
    lookup
  )
  g('a 2-hour day is noted, not warned', long.some((f) => f.code === 'long_day' && f.severity === 'note'), long.find((f) => f.code === 'long_day')?.title)

  // A single lifting exercise vs a single cardio one.
  const oneLift = reviewProgram({ days: [{ name: 'Quick', exercises: [named(BENCH, 3, 150)] }] }, lookup)
  g('a one-lift day is noted', oneLift.some((f) => f.code === 'single_exercise_day'))
  const oneRun = reviewProgram({ days: [{ name: 'Long Run', exercises: [{ exerciseName: RUN, sets: 1, restSeconds: 0 }] }] }, lookup)
  g('a one-cardio day is not', !oneRun.some((f) => f.code === 'single_exercise_day'), 'twelve library days look like this')

  g('warnings come before notes', (() => {
    const mixed = reviewProgram(
      { days: [{ name: 'A', exercises: [named(CURL, 8, 0), named(PUSHDOWN, 8, 60)] }] },
      lookup
    )
    const firstNote = mixed.findIndex((f) => f.severity === 'note')
    const lastWarn = mixed.map((f) => f.severity).lastIndexOf('warn')
    return firstNote === -1 || lastWarn === -1 || lastWarn < firstNote
  })())

  g('the summary is null when quiet', healthSummary([]) === null)
  g('the summary counts warnings', healthSummary(noBack)?.includes('to check') === true, healthSummary(noBack) ?? '')
}

console.log('\nEVERY PROGRAM AJM FIT SHIPS')
console.log('Not one warning may fire. This is the whole contract.\n')

const url = (() => {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line)
      if (!m) continue
      let v = m[1].trim()
      if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1)
      return v
    }
  } catch {
    /* no local env */
  }
  return process.env.DATABASE_URL ?? null
})()

if (!url) {
  console.log('  SKIPPED — no DATABASE_URL. The synthetic checks above still ran.')
} else {
  const pg = (await import('pg')).default
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const rows = await c.query(`
    select p.id, p.name, pd.day_index, pd.name day_name,
           pe.exercise_name, pe.sets, pe.rest_seconds
    from programs p
    join program_days pd on pd.program_id = p.id
    left join program_exercises pe on pe.program_day_id = pd.id
    where p.source = 'blueprint'
    order by p.id, pd.day_index, pe.order_index`)
  await c.end()

  const progs = new Map<string, { name: string; days: Map<number, { name: string; exercises: Array<{ exerciseName: string; sets: number; restSeconds: number }> }> }>()
  for (const r of rows.rows as any[]) {
    let p = progs.get(r.id)
    if (!p) { p = { name: r.name, days: new Map() }; progs.set(r.id, p) }
    if (!p.days.has(r.day_index)) p.days.set(r.day_index, { name: r.day_name, exercises: [] })
    if (r.exercise_name) {
      p.days.get(r.day_index)!.exercises.push({
        exerciseName: r.exercise_name,
        sets: r.sets ?? 3,
        restSeconds: r.rest_seconds ?? 90,
      })
    }
  }

  g('68 programs loaded', progs.size === 68, String(progs.size))

  const offenders: string[] = []
  const noteTally: Record<string, number> = {}
  for (const p of progs.values()) {
    const days = [...p.days.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d)
    const findings = reviewProgram({ days }, lookup)
    for (const f of findings) {
      if (f.severity === 'warn') offenders.push(`${p.name.slice(0, 46)} :: ${f.code} :: ${f.title}`)
      else noteTally[f.code] = (noteTally[f.code] ?? 0) + 1
    }
  }

  g('no shipped program triggers a warning', offenders.length === 0, offenders.length ? `${offenders.length} did` : '')
  for (const o of offenders.slice(0, 10)) console.log('         ' + o)

  console.log('\n  notes across the 68 (allowed, these are observations):')
  const entries = Object.entries(noteTally).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) console.log('    none at all')
  for (const [code, n] of entries) console.log(`    ${W(code, 24)} ${n}`)
}

console.log(fail === 0 ? '\nAll health checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
