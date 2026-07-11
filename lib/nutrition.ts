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
  { name: 'Snack', time: '10:00:00', order: 2 },
  { name: 'Lunch', time: '12:30:00', order: 3 },
  { name: 'Pre-Workout', time: '16:00:00', order: 4 },
  { name: 'Dinner', time: '19:00:00', order: 5 },
]

export async function fetchTargets(userId: string): Promise<MacroTargets> {
  const { data, error } = await db
    .from('users')
    .select('daily_cal_target, protein_target, carb_target, fat_target')
    .eq('id', userId)
    .single()
  if (error || !data) throw error ?? new Error('Failed to load targets')
  return {
    calories: data.daily_cal_target,
    protein: data.protein_target,
    carbs: data.carb_target,
    fats: data.fat_target,
  }
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
