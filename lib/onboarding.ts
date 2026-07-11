import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Onboarding questionnaire answers. Stored as jsonb so the shape can evolve
 * (the AI program builder consumes this later). Keys mirror the form fields.
 */
export interface OnboardingAnswers {
  age?: string
  height?: string
  currentWeight?: string
  goalWeight?: string
  experience?: string // 'new' | 'returning' | 'consistent'
  yearsTraining?: string
  daysPerWeek?: string
  preferredTime?: string // 'morning' | 'midday' | 'evening'
  injuries?: string
  medications?: string
  sleepHours?: string
  stressLevel?: string // '1'..'5'
  jobActivity?: string // 'sedentary' | 'on-my-feet' | 'physical'
  eatingStyle?: string
  foodAllergies?: string
  ninetyDayGoal?: string
  anythingElse?: string
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

/** Field labels for coach-facing displays (luffy + notification email). */
export const ONBOARDING_LABELS: Record<keyof OnboardingAnswers, string> = {
  age: 'Age',
  height: 'Height',
  currentWeight: 'Current weight',
  goalWeight: 'Goal weight',
  experience: 'Training experience',
  yearsTraining: 'Years training',
  daysPerWeek: 'Days per week',
  preferredTime: 'Preferred time',
  injuries: 'Injuries or pain',
  medications: 'Medications or conditions',
  sleepHours: 'Sleep (hours per night)',
  stressLevel: 'Stress level (1-5)',
  jobActivity: 'Job activity',
  eatingStyle: 'Current eating style',
  foodAllergies: 'Allergies or foods to avoid',
  ninetyDayGoal: '90-day success looks like',
  anythingElse: 'Anything else',
}
