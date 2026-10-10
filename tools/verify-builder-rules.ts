import { readFileSync } from 'node:fs'
import {
  filterLibrary,
  defaultRestSeconds,
  defaultPrescription,
  dominantGroup,
  canSave,
  estimateMinutes,
  MUSCLE_GROUPS,
  EQUIPMENT_FILTERS,
  type LibraryExercise,
} from '../lib/builder-rules.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 54), detail)
}

/** The real library, not a fixture. 873 exercises. */
const LIB: LibraryExercise[] = JSON.parse(
  readFileSync(new URL('../public/exercises/exercises.json', import.meta.url), 'utf8')
)
const byName = (n: string) => LIB.find((e) => e.name === n) ?? null
const base = { search: '', group: null, equipment: 'any', type: 'any' }

console.log('THE REAL LIBRARY\n')
{
  g('873 exercises load', LIB.length === 873, String(LIB.length))
  g('no filter returns everything', filterLibrary(LIB, base).length === LIB.length)

  // Every muscle in the library must be reachable from some group, or those
  // exercises are invisible in the picker.
  const covered = new Set(MUSCLE_GROUPS.flatMap((x) => x.muscles))
  const orphans = new Set<string>()
  for (const e of LIB) for (const m of e.primaryMuscles) if (!covered.has(m)) orphans.add(m)
  g('every primary muscle maps to a group', orphans.size === 0, [...orphans].join(', '))

  const reachable = new Set<string>()
  for (const grp of MUSCLE_GROUPS) {
    for (const e of filterLibrary(LIB, { ...base, group: grp.key })) reachable.add(e.name)
  }
  const unreachable = LIB.filter((e) => !reachable.has(e.name) && e.primaryMuscles.length > 0)
  g('no exercise is unreachable by group', unreachable.length === 0, `${unreachable.length} stranded`)
}

console.log('\nFILTERS DO WHAT THEY SAY\n')
{
  const chest = filterLibrary(LIB, { ...base, group: 'chest' })
  g('chest returns only chest', chest.every((e) => e.primaryMuscles.includes('chest')), `${chest.length} found`)

  const back = filterLibrary(LIB, { ...base, group: 'back' })
  g('back spans four muscles', back.length > 80, `${back.length} found`)

  const bw = filterLibrary(LIB, { ...base, equipment: 'bodyweight' })
  g('bodyweight is body only', bw.every((e) => e.equipment === 'body only'), `${bw.length} found`)

  const bar = filterLibrary(LIB, { ...base, equipment: 'barbell' })
  g('barbell includes the EZ bar', bar.some((e) => e.equipment === 'e-z curl bar'), `${bar.length} found`)

  const comp = filterLibrary(LIB, { ...base, type: 'compound' })
  g('compound is compound', comp.every((e) => e.mechanic === 'compound'), `${comp.length} found`)

  // The combination a home client actually uses.
  const home = filterLibrary(LIB, { ...base, group: 'chest', equipment: 'dumbbell' })
  g('chest + dumbbells gives real options', home.length >= 5, `${home.length} found`)
  g('and they are all dumbbells', home.every((e) => e.equipment === 'dumbbell'))
}

console.log('\nSEARCH\n')
{
  const bench = filterLibrary(LIB, { ...base, search: 'bench press' })
  g('finds bench presses', bench.length > 5, `${bench.length} found`)
  g('matches the name only', bench.every((e) => e.name.toLowerCase().includes('bench press')))
  g('is case-insensitive', filterLibrary(LIB, { ...base, search: 'BENCH PRESS' }).length === bench.length)
  g('nonsense finds nothing', filterLibrary(LIB, { ...base, search: 'zorbium' }).length === 0)
  g('search narrows within a group',
    filterLibrary(LIB, { ...base, group: 'legs', search: 'squat' }).every((e) => e.name.toLowerCase().includes('squat')))
}

console.log('\nDEFAULTS THAT SAVE A TAP\n')
{
  const squat = byName('Barbell Squat')
  const fly = byName('Dumbbell Flyes')
  g('a barbell compound rests long', squat != null && defaultRestSeconds(squat) === 150, String(squat && defaultRestSeconds(squat)))
  g('an isolation rests short', fly != null && defaultRestSeconds(fly) === 60, String(fly && defaultRestSeconds(fly)))
  g('a compound gets 3 x 8-12', squat != null && defaultPrescription(squat).reps === '8-12')
  g('an isolation gets 3 x 12-15', fly != null && defaultPrescription(fly).reps === '12-15')

  // Every default rep value must be something the progression engine can read.
  const cardio = LIB.filter((e) => e.category === 'cardio')[0]
  g('cardio is prescribed in minutes', defaultPrescription(cardio).reps.includes('min'), defaultPrescription(cardio).reps)
  g('and rests for nothing', defaultRestSeconds(cardio) === 0)

  // No default should ever be zero sets or an empty prescription.
  const bad = LIB.filter((e) => { const p = defaultPrescription(e); return p.sets < 1 || !p.reps })
  g('no exercise gets an empty prescription', bad.length === 0, `${bad.length} bad`)
}

console.log('\nTHE PICKER OPENS SOMEWHERE SENSIBLE\n')
{
  g('a chest day opens on chest',
    dominantGroup(['Barbell Bench Press', 'Dumbbell Flyes', 'Decline Push-Up'], byName) === 'chest')
  g('a leg day opens on legs',
    dominantGroup(['Barbell Squat', 'Lying Leg Curls', 'Standing Calf Raises'], byName) === 'legs')
  g('an empty day opens on nothing', dominantGroup([], byName) === null)
  g('unknown names do not crash', dominantGroup(['Zorbium Crunch'], byName) === null)
}

console.log('\nWHAT BLOCKS A SAVE (ALMOST NOTHING)\n')
{
  const day = (name: string, n = 1) => ({ name, exercises: Array.from({ length: n }, () => ({})) })

  g('a good program saves', canSave({ name: 'My Program', days: [day('Push'), day('Pull')] }).ok)
  g('no name blocks', !canSave({ name: '  ', days: [day('Push')] }).ok)
  g('no exercises at all blocks', !canSave({ name: 'x', days: [day('Push', 0)] }).ok)

  // The rotation matches logged workouts to days BY NAME. Two days called
  // "Push" make "today" wrong and completed ticks disappear.
  const dupes = canSave({ name: 'x', days: [day('Push'), day('Push')] })
  g('duplicate day names block', !dupes.ok, dupes.reason ?? '')
  g('and the reason says why', (dupes.reason ?? '').includes('same name'))
  g('case does not dodge it', !canSave({ name: 'x', days: [day('Push'), day('PUSH')] }).ok)
  g('an empty day may share a name', canSave({ name: 'x', days: [day('Push'), day('Push', 0)] }).ok)

  // Everything else is the health check's business, not a block.
  g('a 1-day program saves', canSave({ name: 'x', days: [day('Full Body')] }).ok)
  g('a 20-exercise day saves', canSave({ name: 'x', days: [day('Everything', 20)] }).ok)
}

console.log('\nDURATION IS ROUGH AND SAYS SO\n')
{
  // 4 sets, 150s rest: 4 x 190s = 12.7 min
  g('one heavy compound is about 13 min', estimateMinutes([{ sets: 4, restSeconds: 150 }]) === 13, String(estimateMinutes([{ sets: 4, restSeconds: 150 }])))
  g('an empty day is zero', estimateMinutes([]) === 0)
  const typical = estimateMinutes([
    { sets: 4, restSeconds: 150 }, { sets: 3, restSeconds: 90 }, { sets: 3, restSeconds: 90 },
    { sets: 3, restSeconds: 60 }, { sets: 3, restSeconds: 60 },
  ])
  g('a typical 5-exercise day is 30-50 min', typical >= 30 && typical <= 50, `${typical} min`)
}

console.log('\n' + (fail === 0 ? 'ALL BUILDER RULE CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
