/**
 * The small decisions the builder makes on the client's behalf.
 *
 * Kept out of the components so they can be tested: defaults that are wrong
 * are the difference between a builder that feels like it knows what it is
 * doing and one that makes you fix every row.
 */

export interface LibraryExercise {
  name: string
  /** Absolute URLs, straight from the library file. See lib/exercise-images.ts. */
  images: string[]
  primaryMuscles: string[]
  equipment: string
  category: string
  mechanic?: string | null
  force?: string | null
  level: string
}

/**
 * Six buttons over seventeen muscles.
 *
 * Nobody thinks "middle back" when choosing a row, and the library has no
 * "back" muscle at all — it is lats, middle back, lower back and traps. This
 * is the whole of the new taxonomy: a grouping over a real field, with nothing
 * invented.
 */
export const MUSCLE_GROUPS: Array<{ key: string; label: string; muscles: string[] }> = [
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders', 'neck'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  {
    key: 'legs',
    label: 'Legs',
    muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  },
  { key: 'core', label: 'Core', muscles: ['abdominals'] },
]

/**
 * Equipment, collapsed for the common question.
 *
 * The library has twelve values including "foam roll" and "e-z curl bar". A
 * home client's filter should be one tap, not a hunt.
 */
export const EQUIPMENT_FILTERS: Array<{ key: string; label: string; equipment: string[] | null }> = [
  { key: 'any', label: 'Anything', equipment: null },
  { key: 'bodyweight', label: 'Just bodyweight', equipment: ['body only'] },
  { key: 'dumbbell', label: 'Dumbbells only', equipment: ['dumbbell'] },
  { key: 'barbell', label: 'Barbell', equipment: ['barbell', 'e-z curl bar'] },
  { key: 'machine', label: 'Machines & cables', equipment: ['machine', 'cable'] },
]

export const TYPE_FILTERS: Array<{ key: string; label: string; match: (e: LibraryExercise) => boolean }> = [
  { key: 'any', label: 'Anything', match: () => true },
  { key: 'compound', label: 'Compound', match: (e) => e.mechanic === 'compound' },
  { key: 'isolation', label: 'Isolation', match: (e) => e.mechanic === 'isolation' },
  { key: 'cardio', label: 'Cardio', match: (e) => e.category === 'cardio' },
  { key: 'stretching', label: 'Stretching', match: (e) => e.category === 'stretching' },
  { key: 'plyometric', label: 'Plyometric', match: (e) => e.category === 'plyometrics' },
]

export interface PickerFilters {
  search: string
  group: string | null
  equipment: string
  type: string
}

/**
 * Filter the library for the picker.
 *
 * Search matches the NAME only. Searching instructions returns forty
 * exercises for "bench" because forty of them mention lying on one.
 */
export function filterLibrary(all: LibraryExercise[], f: PickerFilters): LibraryExercise[] {
  const q = f.search.trim().toLowerCase()
  const group = f.group ? MUSCLE_GROUPS.find((g) => g.key === f.group) : null
  const equip = EQUIPMENT_FILTERS.find((e) => e.key === f.equipment)?.equipment ?? null
  const type = TYPE_FILTERS.find((t) => t.key === f.type) ?? TYPE_FILTERS[0]

  return all.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q)) return false
    if (group && !e.primaryMuscles.some((m) => group.muscles.includes(m))) return false
    if (equip && !equip.includes(e.equipment)) return false
    if (!type.match(e)) return false
    return true
  })
}

/**
 * How long to rest, inferred from the movement.
 *
 * A compound barbell lift is not a cable fly, and making the client set rest
 * on every exercise is the kind of per-row chore that makes a builder feel
 * like paperwork. These mirror what the 68 library programs actually use:
 * 180s on a 5x5 bench down to 45s on calf raises.
 */
export function defaultRestSeconds(e: LibraryExercise): number {
  if (e.category === 'cardio' || e.category === 'stretching') return 0
  if (e.category === 'plyometrics' || e.category === 'olympic weightlifting') return 120
  if (e.mechanic === 'isolation') return 60
  // Compound: heavier with a bar than with a machine.
  if (e.equipment === 'barbell' || e.equipment === 'e-z curl bar') return 150
  return 90
}

/** A sensible starting prescription, which the client can change. */
export function defaultPrescription(e: LibraryExercise): { sets: number; reps: string } {
  if (e.category === 'cardio') return { sets: 1, reps: '20 min' }
  if (e.category === 'stretching') return { sets: 1, reps: '30 sec' }
  if (e.category === 'plyometrics') return { sets: 4, reps: '3' }
  if (e.mechanic === 'isolation') return { sets: 3, reps: '12-15' }
  return { sets: 3, reps: '8-12' }
}

export const REP_PRESETS = ['5', '6-8', '8-12', '10-15', '12-15', '15-20']
export const REST_PRESETS = [30, 45, 60, 90, 120, 180]

/**
 * Which muscle group a day is already leaning toward.
 *
 * So that adding a fourth exercise to a chest day opens the picker on Chest
 * rather than on nothing.
 */
export function dominantGroup(
  exerciseNames: string[],
  lookup: (name: string) => LibraryExercise | null
): string | null {
  const tally: Record<string, number> = {}
  for (const name of exerciseNames) {
    const ex = lookup(name)
    if (!ex) continue
    for (const g of MUSCLE_GROUPS) {
      if (ex.primaryMuscles.some((m) => g.muscles.includes(m))) {
        tally[g.key] = (tally[g.key] ?? 0) + 1
        break
      }
    }
  }
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : null
}

export interface SaveBlock {
  ok: boolean
  reason: string | null
}

/**
 * Whether a program can be saved at all.
 *
 * Deliberately almost nothing. The health check gives guidance and never
 * blocks; these two are different — they are states the rest of the app
 * cannot represent, not opinions about programming.
 */
export function canSave(program: { name: string; days: Array<{ name: string; exercises: unknown[] }> }): SaveBlock {
  if (!program.name.trim()) return { ok: false, reason: 'Give your program a name.' }
  if (!program.days.some((d) => d.exercises.length > 0)) {
    return { ok: false, reason: 'Add at least one exercise to one day.' }
  }
  // Duplicate day names break the rotation: `rotationState` matches logged
  // workouts to days by name, so two days called "Push" make "today" wrong
  // and completed ticks vanish.
  const named = program.days.filter((d) => d.exercises.length > 0).map((d) => d.name.trim().toLowerCase())
  if (new Set(named).size !== named.length) {
    return { ok: false, reason: 'Two days have the same name. Give each one its own.' }
  }
  return { ok: true, reason: null }
}

/**
 * Roughly how long a day will take.
 *
 * Deliberately rough, and labelled as such wherever it is shown: real rest
 * bears little resemblance to prescribed rest. About forty seconds a set plus
 * the rest between them.
 */
export function estimateMinutes(exercises: Array<{ sets: number; restSeconds: number }>): number {
  const seconds = exercises.reduce((total, e) => total + e.sets * (40 + e.restSeconds), 0)
  return Math.round(seconds / 60)
}
