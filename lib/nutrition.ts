import { supabase } from '@/lib/supabase'
import { localDate, localDateDaysAgo } from '@/lib/dates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface MacroTargets {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export interface MealRow {
  id: string
  name: string
  scheduled_time: string | null
  meal_order: number
}

export interface FoodLogRow {
  id: string
  meal_id: string | null
  food_name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  serving_size: string | null
}

export interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export interface DailyLogRow {
  water_oz: number
  notes: string | null
}

/** Default meals for new users, we seed these on first load. */
const DEFAULT_MEALS: Array<{ name: string; time: string; order: number }> = [
  { name: 'Breakfast', time: '07:00:00', order: 1 },
  { name: 'Snack', time: '10:00:00', order: 2 },
  { name: 'Lunch', time: '12:30:00', order: 3 },
  { name: 'Dinner', time: '19:00:00', order: 4 },
]

export interface NutritionSetupData {
  nutrition_goal_setup_complete: boolean
  current_weight: number | null
  goal_weight: number | null
  height: number | null
  age: number | null
  sex: string | null
  activity_level: string | null
  nutrition_goal: string | null
  custom_cal_target: number | null
  custom_protein_target: number | null
  custom_carb_target: number | null
  custom_fat_target: number | null
}

export async function fetchTargets(userId: string): Promise<MacroTargets> {
  const { data, error } = await db
    .from('users')
    .select('daily_cal_target, protein_target, carb_target, fat_target, custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')
    .eq('id', userId)
    .single()
  if (error || !data) throw error ?? new Error('Failed to load targets')

  // Coach overrides win over the calculated values when present.
  //
  // There used to be a fallback here that treated exactly 2,000 calories as a
  // sentinel for "the database save failed" and substituted values from
  // localStorage up to 24 hours old. It was papering over a save bug, and it
  // silently replaced the real target of any client whose calculated number
  // happened to be 2,000. A failed save should surface as a failed save.
  return {
    calories: data.custom_cal_target ?? data.daily_cal_target,
    protein: data.custom_protein_target ?? data.protein_target,
    carbs: data.custom_carb_target ?? data.carb_target,
    fats: data.custom_fat_target ?? data.fat_target,
  }
}

export async function fetchNutritionSetup(userId: string): Promise<NutritionSetupData> {
  const { data, error } = await db
    .from('users')
    .select('nutrition_goal_setup_complete, current_weight, goal_weight, height, age, sex, activity_level, nutrition_goal, custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')
    .eq('id', userId)
    .single()
  if (error || !data) throw error ?? new Error('Failed to load nutrition setup')
  return data as NutritionSetupData
}

export async function updateTargets(userId: string, targets: MacroTargets) {
  const { error } = await db
    .from('users')
    .update({
      daily_cal_target: targets.calories,
      protein_target: targets.protein,
      carb_target: targets.carbs,
      fat_target: targets.fats,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

export interface TargetChangeNote {
  calories: number | null
  reason: string | null
  source: string
  created_at: string
}

/**
 * The most recent change to this client's targets, so the daily page can say
 * why the number moved. A target that changes without explanation is the
 * fastest way to lose someone's trust in the whole system.
 *
 * Clients can read their own history rows; the table has no insert policy, so
 * this is read-only by construction.
 */
export async function fetchLatestTargetChange(userId: string): Promise<TargetChangeNote | null> {
  const { data, error } = await db
    .from('nutrition_target_history')
    .select('cal_target, reason, source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error || !data?.length) return null
  const row = data[0]
  return {
    calories: row.cal_target === null ? null : Number(row.cal_target),
    reason: row.reason,
    source: row.source,
    created_at: row.created_at,
  }
}

export async function fetchMeals(userId: string): Promise<MealRow[]> {
  const { data, error } = await db
    .from('meals')
    .select('id, name, scheduled_time, meal_order')
    .eq('user_id', userId)
    .order('meal_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as MealRow[]
}

/** Creates default meals if the user has none. Returns the meals (new or existing). */
export async function ensureDefaultMeals(userId: string): Promise<MealRow[]> {
  const existing = await fetchMeals(userId)
  if (existing.length > 0) return existing

  const rows = DEFAULT_MEALS.map((m) => ({
    user_id: userId,
    name: m.name,
    scheduled_time: m.time,
    meal_order: m.order,
  }))
  const { error } = await db.from('meals').insert(rows)
  if (error) throw error
  return fetchMeals(userId)
}

export async function fetchTodaysLogs(userId: string): Promise<FoodLogRow[]> {
  const today = localDate()
  const { data, error } = await db
    .from('food_logs')
    .select('id, meal_id, food_name, calories, protein, carbs, fats, serving_size')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as FoodLogRow[]
}

export interface AddFoodInput {
  userId: string
  mealId: string | null
  foodName: string
  calories: number
  protein: number
  carbs: number
  fats: number
  servingSize?: string
}

export async function addFoodLog(input: AddFoodInput): Promise<FoodLogRow> {
  const { data, error } = await db
    .from('food_logs')
    .insert({
      user_id: input.userId,
      meal_id: input.mealId,
      food_name: input.foodName,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fats: input.fats,
      serving_size: input.servingSize ?? null,
      // Must be stamped explicitly. Left out, the column falls back to the
      // database default current_date, which is UTC on Supabase — so an
      // evening entry was filed under tomorrow and vanished from today the
      // moment it was saved.
      date: localDate(),
    })
    .select('id, meal_id, food_name, calories, protein, carbs, fats, serving_size')
    .single()
  if (error || !data) throw error ?? new Error('Failed to add food')
  return data as FoodLogRow
}

export async function deleteFoodLog(id: string) {
  const { error } = await db.from('food_logs').delete().eq('id', id)
  if (error) throw error
}

export interface UpdateFoodInput {
  id: string
  calories: number
  protein: number
  carbs: number
  fats: number
  servingSize?: string
}

export async function updateFoodLog(input: UpdateFoodInput): Promise<FoodLogRow> {
  const { data, error } = await db
    .from('food_logs')
    .update({
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fats: input.fats,
      serving_size: input.servingSize ?? null,
    })
    .eq('id', input.id)
    .select('id, meal_id, food_name, calories, protein, carbs, fats, serving_size')
    .single()
  if (error || !data) throw error ?? new Error('Failed to update food')
  return data as FoodLogRow
}

export interface RecentFood {
  food_name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  serving_size: string | null
}

/** Most recently logged foods, deduped by name, for one-tap re-logging. */
export async function fetchRecentFoods(userId: string, limit = 12): Promise<RecentFood[]> {
  const { data, error } = await db
    .from('food_logs')
    .select('food_name, calories, protein, carbs, fats, serving_size')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) throw error
  const seen = new Set<string>()
  const out: RecentFood[] = []
  for (const row of (data ?? []) as RecentFood[]) {
    const key = row.food_name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
    if (out.length >= limit) break
  }
  return out
}

export async function fetchDailyLog(userId: string): Promise<DailyLogRow> {
  const today = localDate()
  const { data, error } = await db
    .from('daily_logs')
    .select('water_oz, notes')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()
  if (error) throw error
  return data ? (data as DailyLogRow) : { water_oz: 0, notes: null }
}

export async function setWater(userId: string, waterOz: number) {
  const today = localDate()
  const { error } = await db
    .from('daily_logs')
    .upsert(
      { user_id: userId, date: today, water_oz: Math.max(0, waterOz) },
      { onConflict: 'user_id,date' }
    )
  if (error) throw error
}

export interface DailyCalories {
  date: string
  calories: number
}

export async function fetchWeeklyCalories(userId: string): Promise<DailyCalories[]> {
  const today = new Date()
  const startStr = localDateDaysAgo(6, today)
  const endStr = localDate(today)

  const { data, error } = await db
    .from('food_logs')
    .select('date, calories')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', endStr)
  if (error) throw error

  // Sum calories per day
  const byDate: Record<string, number> = {}
  for (const row of (data ?? []) as { date: string; calories: number }[]) {
    byDate[row.date] = (byDate[row.date] ?? 0) + row.calories
  }

  // Build 7-day array, earliest first
  const result: DailyCalories[] = []
  for (let i = 6; i >= 0; i--) {
    const key = localDateDaysAgo(i, today)
    result.push({ date: key, calories: byDate[key] ?? 0 })
  }
  return result
}

export function sumTotals(logs: FoodLogRow[]): NutritionTotals {
  return logs.reduce<NutritionTotals>(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein: acc.protein + Number(l.protein),
      carbs: acc.carbs + Number(l.carbs),
      fats: acc.fats + Number(l.fats),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  )
}
