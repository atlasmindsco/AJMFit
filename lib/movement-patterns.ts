/**
 * What an exercise is for, as a movement rather than as a muscle.
 *
 * WHY THE LIBRARY CANNOT ALREADY ANSWER THIS. The exercise dataset carries
 * `force` (push, pull, static), `mechanic` (compound, isolation) and a primary
 * muscle. Together those separate a compound push from an isolation pull, but
 * they cannot tell a bench press from an overhead press — both are a compound
 * push on the chest or shoulders — and they cannot tell a squat from a
 * deadlift, which differ in almost everything that matters while sharing
 * "compound push on the quadriceps" and "compound pull on the lower back".
 *
 * A program can therefore look balanced by muscle and still be missing a
 * whole pattern: all of its back work horizontal, nothing overhead, no hinge.
 * That is a real programming fault and nothing in the app could see it.
 *
 * AN EXPLICIT TABLE, NOT A CLASSIFIER. Every exercise the catalog actually
 * prescribes is named here and checked by a verifier. A heuristic would be
 * shorter and would be wrong somewhere nobody looked — and "somewhere nobody
 * looked" is exactly where a client's program would end up missing a pattern.
 * The heuristic below exists only for the 789 library exercises nobody has
 * prescribed yet, where a reasonable guess beats nothing.
 */

export type MovementPattern =
  | 'horizontal_press'
  | 'vertical_press'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hip_extension'
  | 'knee_flexion'
  | 'knee_extension'
  | 'shoulder_abduction'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'calf'
  | 'core'
  | 'carry'
  | 'power'
  | 'conditioning'
  | 'other'

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_press: 'Horizontal press',
  vertical_press: 'Overhead press',
  horizontal_pull: 'Row',
  vertical_pull: 'Pull-up or pulldown',
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge or single leg',
  hip_extension: 'Hip extension',
  knee_flexion: 'Hamstring curl',
  knee_extension: 'Leg extension',
  shoulder_abduction: 'Lateral raise',
  elbow_flexion: 'Curl',
  elbow_extension: 'Triceps',
  calf: 'Calf',
  core: 'Core',
  carry: 'Carry',
  power: 'Jump or sprint',
  conditioning: 'Conditioning',
  other: 'Other',
}

/**
 * Every exercise the catalog prescribes, by name exactly as stored.
 *
 * Judgement calls worth knowing about:
 *   - A fly and a cable crossover are horizontal pressing. They work the same
 *     joint in the same plane; `mechanic` is what says one is not a press.
 *   - An incline press is horizontal pressing, not overhead. The shoulder
 *     angle is closer to a bench than to a military press.
 *   - A pullover is vertical pulling. The dataset calls it a chest push; the
 *     shoulder extension it trains is the pulldown's.
 *   - Triceps dips are elbow extension, not a press, because that is the slot
 *     they fill in every program here.
 *   - Shrugs and the incline shoulder raise are `other`. They are scapular
 *     work and do not belong to any of the patterns a program is checked for.
 */
const PRESCRIBED: Record<string, MovementPattern> = {
  // Horizontal press
  'Barbell Bench Press - Medium Grip': 'horizontal_press',
  'Barbell Incline Bench Press - Medium Grip': 'horizontal_press',
  'Dumbbell Bench Press': 'horizontal_press',
  'Incline Dumbbell Press': 'horizontal_press',
  'Decline Push-Up': 'horizontal_press',
  'Dips - Chest Version': 'horizontal_press',
  'Chest Push (multiple response)': 'horizontal_press',
  'Dumbbell Flyes': 'horizontal_press',
  'Cable Crossover': 'horizontal_press',

  // Overhead press
  'Standing Military Press': 'vertical_press',
  'Dumbbell Shoulder Press': 'vertical_press',
  'Arnold Dumbbell Press': 'vertical_press',

  // Row
  'Bent Over Barbell Row': 'horizontal_pull',
  'Bent Over Two-Arm Long Bar Row': 'horizontal_pull',
  'Bent Over Two-Dumbbell Row': 'horizontal_pull',
  'One-Arm Dumbbell Row': 'horizontal_pull',
  'Seated Cable Rows': 'horizontal_pull',
  'Inverted Row': 'horizontal_pull',
  'Dumbbell Incline Row': 'horizontal_pull',
  'Barbell Rear Delt Row': 'horizontal_pull',
  'Face Pull': 'horizontal_pull',

  // Pull-up or pulldown
  'Chin-Up': 'vertical_pull',
  Pullups: 'vertical_pull',
  'Wide-Grip Lat Pulldown': 'vertical_pull',
  'Straight-Arm Pulldown': 'vertical_pull',
  'Bent-Arm Dumbbell Pullover': 'vertical_pull',

  // Squat
  'Barbell Squat': 'squat',
  'Dumbbell Squat': 'squat',
  'Leg Press': 'squat',

  // Hinge
  'Barbell Deadlift': 'hinge',
  'Romanian Deadlift': 'hinge',
  'Stiff-Legged Dumbbell Deadlift': 'hinge',

  // Hip extension
  'Barbell Hip Thrust': 'hip_extension',
  'Barbell Glute Bridge': 'hip_extension',
  'Butt Lift (Bridge)': 'hip_extension',
  'Single Leg Glute Bridge': 'hip_extension',

  // Lunge and single leg
  'Barbell Lunge': 'lunge',
  'Barbell Walking Lunge': 'lunge',
  'Dumbbell Lunges': 'lunge',
  'Dumbbell Rear Lunge': 'lunge',
  'Dumbbell Step Ups': 'lunge',
  'Split Squat with Dumbbells': 'lunge',

  // Hamstring curl
  'Lying Leg Curls': 'knee_flexion',
  'Seated Leg Curl': 'knee_flexion',
  'Floor Glute-Ham Raise': 'knee_flexion',

  // Leg extension
  'Leg Extensions': 'knee_extension',

  // Lateral raise
  'Side Lateral Raise': 'shoulder_abduction',
  'Dumbbell Lying Rear Lateral Raise': 'shoulder_abduction',
  'Bent Over Dumbbell Rear Delt Raise With Head On Bench': 'shoulder_abduction',

  // Curl
  'Barbell Curl': 'elbow_flexion',
  'Dumbbell Bicep Curl': 'elbow_flexion',
  'Hammer Curls': 'elbow_flexion',
  'Concentration Curls': 'elbow_flexion',

  // Triceps
  'Triceps Pushdown': 'elbow_extension',
  'EZ-Bar Skullcrusher': 'elbow_extension',
  'Lying Dumbbell Tricep Extension': 'elbow_extension',
  'Decline Dumbbell Triceps Extension': 'elbow_extension',
  'Dips - Triceps Version': 'elbow_extension',

  // Calf
  'Calf Raise On A Dumbbell': 'calf',
  'Seated Calf Raise': 'calf',
  'Standing Calf Raises': 'calf',
  'Standing Dumbbell Calf Raise': 'calf',

  // Core
  Plank: 'core',
  'Air Bike': 'core',
  'Dead Bug': 'core',
  'Russian Twist': 'core',
  'Standing Cable Wood Chop': 'core',

  // Jump or sprint
  'Front Box Jump': 'power',
  'Knee Tuck Jump': 'power',
  'Lateral Bound': 'power',
  'Side Hop-Sprint': 'power',
  'Carioca Quick Step': 'power',
  'Linear Acceleration Wall Drill': 'power',
  'Single-Cone Sprint Drill': 'power',

  // Conditioning
  'Bicycling, Stationary': 'conditioning',
  'Jogging, Treadmill': 'conditioning',
  'Rowing, Stationary': 'conditioning',
  'Running, Treadmill': 'conditioning',
  'Walking, Treadmill': 'conditioning',
  'Trail Running/Walking': 'conditioning',
  'Rope Jumping': 'conditioning',

  // Scapular work, which belongs to no pattern a program is checked for
  'Barbell Shrug': 'other',
  'Dumbbell Shrug': 'other',
  'Barbell Incline Shoulder Raise': 'other',
}

/** Attributes as the exercise library stores them. */
export interface LibraryFacts {
  primaryMuscle?: string | null
  force?: string | null
  mechanic?: string | null
  category?: string | null
}

/**
 * A guess, for library exercises nobody has prescribed.
 *
 * Reads the name first because the name is what distinguishes a squat from a
 * deadlift, then falls back to muscle and force. Returns `other` rather than
 * inventing a pattern it cannot see.
 */
function guess(name: string, facts: LibraryFacts): MovementPattern {
  const n = name.toLowerCase()

  if (/curl/.test(n) && !/leg|ham/.test(n)) return 'elbow_flexion'
  if (/tricep|skullcrush|pushdown|kickback|dip/.test(n)) return 'elbow_extension'
  if (/lateral raise|delt raise|lateral.*delt/.test(n)) return 'shoulder_abduction'
  if (/calf|toe raise/.test(n)) return 'calf'
  if (/leg curl|ham.*curl|glute.?ham/.test(n)) return 'knee_flexion'
  if (/leg extension/.test(n)) return 'knee_extension'
  if (/hip thrust|glute bridge|bridge/.test(n)) return 'hip_extension'
  if (/lunge|step.?up|split squat|bulgarian/.test(n)) return 'lunge'
  if (/deadlift|good morning|hyperextension|back extension/.test(n)) return 'hinge'
  if (/squat|leg press|hack/.test(n)) return 'squat'
  if (/pull.?up|chin.?up|pulldown|pullover/.test(n)) return 'vertical_pull'
  if (/row|face pull/.test(n)) return 'horizontal_pull'
  if (/overhead|military|shoulder press|push press|arnold/.test(n)) return 'vertical_press'
  if (/bench|push.?up|chest press|fly|crossover|pec/.test(n)) return 'horizontal_press'
  if (/carry|farmer|suitcase|waiter/.test(n)) return 'carry'
  if (/plank|crunch|sit.?up|twist|wood chop|dead bug|hollow|leg raise/.test(n)) return 'core'
  if (/jump|bound|sprint|hop|throw|slam|clean|snatch|jerk/.test(n)) return 'power'

  if (facts.category === 'cardio') return 'conditioning'
  if (facts.category === 'plyometrics') return 'power'

  switch (facts.primaryMuscle) {
    case 'abdominals':
      return 'core'
    case 'calves':
      return 'calf'
    case 'biceps':
      return 'elbow_flexion'
    case 'triceps':
      return 'elbow_extension'
    case 'quadriceps':
      return 'squat'
    case 'hamstrings':
      return 'hinge'
    case 'glutes':
      return 'hip_extension'
    default:
      return 'other'
  }
}

/** The pattern an exercise trains. Named exercises are exact; the rest guess. */
export function patternFor(name: string, facts: LibraryFacts = {}): MovementPattern {
  const exact = PRESCRIBED[name]
  if (exact) return exact
  return guess(name, facts)
}

/** True when this exercise is named rather than guessed at. */
export function isKnownExercise(name: string): boolean {
  return name in PRESCRIBED
}

/** Every exercise the catalog prescribes, for the verifier to check against. */
export function prescribedNames(): string[] {
  return Object.keys(PRESCRIBED)
}

/**
 * The patterns a complete week should cover.
 *
 * Deliberately short. These six are the ones whose absence changes what a
 * program does rather than how polished it is: no pushing, no pulling, no
 * squatting, no hinging, no overhead work, no vertical pulling. Curls, calves
 * and core are all worth having and none of them make a program incomplete.
 *
 * Conditioning and power are excluded on purpose: a hypertrophy program with
 * no sprinting in it is not missing anything.
 */
export const ESSENTIAL_PATTERNS: MovementPattern[] = [
  'horizontal_press',
  'vertical_press',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
]
