import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * What a coached client is asked before their program is built.
 *
 * This was seventeen questions and had exactly one submission in the product's
 * history. The eight marked ASKED below are the ones that change which program
 * gets assigned; the rest were good coaching questions asked at the wrong
 * moment — stress level and sleep hours decide nothing on day zero, the weekly
 * check-in asks about sleep anyway, and every extra field is another reason to
 * close the tab before the end.
 *
 * Two of the eight are NEW, and their absence was the real problem: the form
 * never asked where someone trains or how long they have. Those are two of the
 * three inputs that pick a template, so the questionnaire could not actually
 * answer the question it existed to answer.
 *
 * The retired fields stay in the type, optional and unasked. One person filled
 * the long form in; deleting the keys would silently drop their answers, and
 * the coach view still reads whatever is stored.
 */
export interface OnboardingAnswers {
  /* ── ASKED ── */
  goal?: string // 'muscle' | 'strength' | 'lean_out' — matches BlueprintGoal
  experience?: string // 'new' | 'returning' | 'consistent'
  daysPerWeek?: string
  location?: string // 'gym' | 'home' — matches BlueprintLocation
  sessionMinutes?: string // '30' | '45' | '60' | '75'
  injuries?: string
  currentWeight?: string
  goalWeight?: string
  anythingElse?: string

  /* ── Retired: still read, no longer asked ── */
  age?: string
  height?: string
  yearsTraining?: string
  preferredTime?: string
  medications?: string
  sleepHours?: string
  stressLevel?: string
  jobActivity?: string
  eatingStyle?: string
  foodAllergies?: string
  ninetyDayGoal?: string
}

export interface OnboardingForm {
  id: string
  user_id: string
  answers: OnboardingAnswers
  created_at: string
  updated_at: string
}

/** The signed-in client's onboarding form, or null if not filled yet. */
export async function fetchMyOnboarding(userId: string): Promise<OnboardingForm | null> {
  const { data } = await db
    .from('onboarding_forms')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as OnboardingForm) ?? null
}

/** Create or update the client's onboarding form (one row per client). */
export async function saveMyOnboarding(userId: string, answers: OnboardingAnswers): Promise<void> {
  const { error } = await db
    .from('onboarding_forms')
    .upsert(
      { user_id: userId, answers, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

/** Trainer: all onboarding forms, keyed by user_id. */
export async function fetchAllOnboarding(): Promise<Map<string, OnboardingForm>> {
  const { data, error } = await db.from('onboarding_forms').select('*')
  if (error) throw error
  return new Map(((data ?? []) as OnboardingForm[]).map((f) => [f.user_id, f]))
}

/**
 * Field labels for coach-facing displays (luffy + notification email).
 *
 * Retired fields keep their labels: one client's long-form answers are still
 * in the database and should still read properly on the coach's side.
 */
export const ONBOARDING_LABELS: Record<keyof OnboardingAnswers, string> = {
  goal: 'Main goal',
  experience: 'Training experience',
  daysPerWeek: 'Days per week',
  location: 'Trains at',
  sessionMinutes: 'Time per session',
  injuries: 'Injuries or pain',
  currentWeight: 'Current weight',
  goalWeight: 'Goal weight',
  anythingElse: 'Anything else',

  age: 'Age',
  height: 'Height',
  yearsTraining: 'Years training',
  preferredTime: 'Preferred time',
  medications: 'Medications or conditions',
  sleepHours: 'Sleep (hours per night)',
  stressLevel: 'Stress level (1-5)',
  jobActivity: 'Job activity',
  eatingStyle: 'Current eating style',
  foodAllergies: 'Allergies or foods to avoid',
  ninetyDayGoal: '90-day success looks like',
}

/** The eight that are actually asked, in the order the form asks them. */
export const ASKED_FIELDS: Array<keyof OnboardingAnswers> = [
  'goal',
  'experience',
  'daysPerWeek',
  'location',
  'sessionMinutes',
  'injuries',
  'currentWeight',
  'goalWeight',
  'anythingElse',
]

/**
 * Where the client said they are starting from, as told to the program picker.
 *
 * Separate from the onboarding answers because it is asked somewhere else and
 * means something narrower: onboarding is the coached-tier intake form, which
 * Blueprint clients never see. `onboarding_forms` holds a single row, created
 * in July, whose answers object is empty — so no client has ever had an
 * `experience` or `currentWeight` answer to read. That is why every client in
 * the app got the beginner load increments, including people two years in.
 */
export async function fetchTrainingExperience(userId: string): Promise<string | null> {
  const { data } = await db
    .from('users')
    .select('training_experience')
    .eq('id', userId)
    .maybeSingle()
  return (data as { training_experience?: string | null } | null)?.training_experience ?? null
}

/** Everything the template matcher needs is present. */
export function isAssessmentComplete(a: OnboardingAnswers | null | undefined): boolean {
  if (!a) return false
  return Boolean(a.goal && a.experience && a.daysPerWeek && a.location)
}

/**
 * Whether the client says they have a bench, a sturdy chair or a step.
 *
 * Null means never asked, and lib/equipment.ts reads that as YES. Every
 * client who picked a program before the question existed has a null here,
 * and reading it the other way would substitute exercises into 34 programs
 * overnight for people who never asked for it.
 */
export async function fetchHasBench(userId: string): Promise<boolean | null> {
  const { data } = await db
    .from('users')
    .select('has_bench')
    .eq('id', userId)
    .maybeSingle()
  const value = (data as { has_bench?: boolean | null } | null)?.has_bench
  return typeof value === 'boolean' ? value : null
}
