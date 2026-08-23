import { supabase } from '@/lib/supabase'

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
  { name: 'Lunch', time: '12:30:00', order: 2 },
  { name: 'Dinner', time: '19:00:00', order: 3 },
  { name: 'Snack', time: '21:00:00', order: 4 },
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
  try {
    // Call API that uses admin client to bypass RLS
    const res = await fetch('/api/nutrition/targets')
    if (!res.ok) {
      throw new Error(`Failed to fetch targets: ${res.status}`)
    }
    const data = await res.json()
    console.log('[fetchTargets] Got targets from API:', data)
    return data
  } catch (err) {
    console.error('[fetchTargets] Error, falling back to direct query:', err)
    // Fallback to direct query if API fails
    const { data, error } = await db
      .from('users')
      .select('daily_cal_target, protein_target, carb_target, fat_target, custom_cal_target, custom_protein_target, custom_carb_target, custom_fat_target')
      .eq('id', userId)
      .single()
    if (error || !data) throw error ?? new Error('Failed to load targets')

    // Use custom overrides if set, otherwise use calculated values, otherwise use defaults
    return {
      calories: data.custom_cal_target ?? data.daily_cal_target ?? 2000,
      protein: data.custom_protein_target ?? data.protein_target ?? 150,
      carbs: data.custom_carb_target ?? data.carb_target ?? 250,
      fats: data.custom_fat_target ?? data.fat_target ?? 70,
    }
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

export async function fetchMeals(userId: string): Promise<MealRow[]> {
  const { data, error } = await db
    .from('meals')
    .select('id, name, scheduled_time, meal_order')
    .eq('user_id', userId)
    .order('meal_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as MealRow[]
}

/** Creates default meals by calling server API that uses admin client. */
export async function ensureDefaultMeals(userId: string): Promise<MealRow[]> {
  try {
    console.log('[ensureDefaultMeals] Calling API to ensure meals')
    const res = await fetch('/api/nutrition/ensure-meals', {
      method: 'POST',
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to ensure meals')
    }
    const { meals } = await res.json()
    console.log('[ensureDefaultMeals] API returned meals:', meals)
    return meals
  } catch (err) {
    console.error('[ensureDefaultMeals] Error:', err)
    // Fallback: try to fetch existing meals
    return fetchMeals(userId)
  }
}

export async function fetchTodaysLogs(userId: string): Promise<FoodLogRow[]> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
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

export async function fetchDailyLog(userId: string): Promise<DailyLogRow> {
  const today = new Date().toISOString().slice(0, 10)
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
  const today = new Date().toISOString().slice(0, 10)
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
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6)
  const startStr = sevenDaysAgo.toISOString().slice(0, 10)
  const endStr = today.toISOString().slice(0, 10)

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
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
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
