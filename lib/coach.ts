import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface CoachSettings {
  full_name: string
  email: string
  phone: string
  bio: string
  timezone: string
  business_name: string
  website: string
  instagram: string
  notify_new_application: boolean
  notify_new_message: boolean
  notify_payment: boolean
}

export const DEFAULT_COACH_SETTINGS: CoachSettings = {
  full_name: 'Anthony M.',
  email: 'anthony@ajmfit.com',
  phone: '',
  bio: '',
  timezone: 'Eastern Time (ET)',
  business_name: 'AJM Fit',
  website: 'https://ajmfit.com',
  instagram: '@ajmfit',
  notify_new_application: true,
  notify_new_message: true,
  notify_payment: true,
}

export async function fetchCoachSettings(authId: string): Promise<CoachSettings | null> {
  const { data } = await db.from('coach_settings').select('*').eq('auth_id', authId).maybeSingle()
  return (data as CoachSettings) ?? null
}

export async function saveCoachSettings(authId: string, s: CoachSettings) {
  const { error } = await db
    .from('coach_settings')
    .upsert({ auth_id: authId, ...s, updated_at: new Date().toISOString() }, { onConflict: 'auth_id' })
  if (error) throw error
}
