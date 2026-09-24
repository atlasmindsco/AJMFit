/**
 * The Supabase client is imported lazily inside the two functions that need
 * it, so that importing the vocabulary below -- which the meal library and its
 * filters depend on -- does not drag a database client into the bundle, or
 * into a test that only exercises pure filtering logic.
 */
async function client() {
  const { supabase } = await import('@/lib/supabase')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

/**
 * Structured food preferences.
 *
 * Onboarding asked for allergies as one free-text box and nothing read it. The
 * vocabulary below exists so the answer can actually filter a meal library:
 * prose cannot be matched against a tag, and guessing at prose is how someone
 * ends up being shown a dish they cannot eat.
 */

export type EatingPattern = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'halal' | 'kosher'

export type Allergen =
  | 'dairy'
  | 'eggs'
  | 'fish'
  | 'shellfish'
  | 'tree_nuts'
  | 'peanuts'
  | 'wheat_gluten'
  | 'soy'
  | 'sesame'

export const EATING_PATTERNS: Array<{ value: EatingPattern; label: string }> = [
  { value: 'none', label: 'No restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
]

export const ALLERGENS: Array<{ value: Allergen; label: string }> = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'tree_nuts', label: 'Tree nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'wheat_gluten', label: 'Wheat or gluten' },
  { value: 'soy', label: 'Soy' },
  { value: 'sesame', label: 'Sesame' },
]

export interface FoodPreferences {
  eatingPattern: EatingPattern
  allergens: Allergen[]
  allergenNotes: string
  dislikes: string
  /** Null means never asked, which is different from "no restrictions". */
  setAt: string | null
}

export const DEFAULT_PREFERENCES: FoodPreferences = {
  eatingPattern: 'none',
  allergens: [],
  allergenNotes: '',
  dislikes: '',
  setAt: null,
}

export async function fetchPreferences(userId: string): Promise<FoodPreferences> {
  const db = await client()
  const { data, error } = await db
    .from('users')
    .select('eating_pattern, allergens, allergen_notes, food_dislikes, food_prefs_set_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return DEFAULT_PREFERENCES
  return {
    eatingPattern: (data.eating_pattern as EatingPattern) ?? 'none',
    allergens: (data.allergens as Allergen[]) ?? [],
    allergenNotes: data.allergen_notes ?? '',
    dislikes: data.food_dislikes ?? '',
    setAt: data.food_prefs_set_at ?? null,
  }
}

export async function savePreferences(userId: string, prefs: FoodPreferences): Promise<void> {
  const db = await client()
  const { error } = await db
    .from('users')
    .update({
      eating_pattern: prefs.eatingPattern,
      allergens: prefs.allergens,
      allergen_notes: prefs.allergenNotes.trim() || null,
      food_dislikes: prefs.dislikes.trim() || null,
      food_prefs_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

/**
 * True when this client has an unparsed free-text allergy note.
 *
 * Such a note cannot be matched against meal tags, so the library must say so
 * rather than quietly filtering on the structured fields alone and presenting
 * the result as safe.
 */
export function hasUncheckableNote(prefs: FoodPreferences): boolean {
  return prefs.allergenNotes.trim().length > 0
}
