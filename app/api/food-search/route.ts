import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 15

/**
 * Food database search for the log-food flow. Queries USDA FoodData Central
 * (branded products + generic foods) and returns a normalised result list
 * with per-100g macros and the serving options printed on the label, so the
 * client can scale macros to any serving size without another request.
 */

const NUTRIENTS = {
  calories: 'Energy',
  protein: 'Protein',
  carbs: 'Carbohydrate, by difference',
  fats: 'Total lipid (fat)',
} as const

interface FdcNutrient {
  nutrientName: string
  unitName?: string
  value: number
}

interface FdcFood {
  fdcId: number
  description: string
  dataType: string
  brandOwner?: string
  brandName?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients: FdcNutrient[]
}

export interface FoodServing {
  label: string
  grams: number
}

export interface FoodSearchHit {
  id: number
  name: string
  brand: string | null
  /** Data straight from USDA / the product label, not an AI estimate. */
  verified: boolean
  per100: { calories: number; protein: number; carbs: number; fats: number }
  servings: FoodServing[]
  /** Precomputed for the results list: macros at the first serving option. */
  defaultServing: { label: string; calories: number }
}

function macro(food: FdcFood, name: string): number {
  const wantKcal = name === NUTRIENTS.calories
  const n = food.foodNutrients.find((x) => {
    if (x.nutrientName !== name) return false
    if (wantKcal) return x.unitName?.toUpperCase() === 'KCAL'
    return true
  })
  return n ? Number(n.value) : 0
}

/** Branded names arrive SHOUTING; make them readable. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase())
    .trim()
}

/** Generic USDA names mix case ("Soup, CAMPBELL'S, chicken"); calm only the shouting words. */
function calmCaps(s: string): string {
  return s.replace(/\b[A-Z][A-Z'&]{2,}\b/g, (w) => titleCase(w))
}

/** Household serving text uses odd unit codes and sometimes its own gram note. */
function cleanHousehold(text: string, grams: number): string {
  const cleaned = text
    .replace(/\bONZ\b/gi, 'oz')
    .replace(/\bOZA\b/gi, 'fl oz')
    .replace(/\bGRM\b/gi, 'g')
    .toLowerCase()
    .trim()
  if (/\(\s*\d+(\.\d+)?\s*(g|ml)\s*\)/.test(cleaned)) return cleaned
  return `${cleaned} (${grams}g)`
}

function normalise(food: FdcFood): FoodSearchHit | null {
  const per100 = {
    calories: Math.round(macro(food, NUTRIENTS.calories)),
    protein: Math.round(macro(food, NUTRIENTS.protein) * 10) / 10,
    carbs: Math.round(macro(food, NUTRIENTS.carbs) * 10) / 10,
    fats: Math.round(macro(food, NUTRIENTS.fats) * 10) / 10,
  }
  if (per100.calories <= 0 && per100.protein <= 0 && per100.carbs <= 0 && per100.fats <= 0) {
    return null
  }

  const isBranded = food.dataType === 'Branded'
  const brand = isBranded ? titleCase(food.brandName || food.brandOwner || '') || null : null

  const servings: FoodServing[] = []
  // Label serving first (branded foods measured in g or ml only; ml ~ g for
  // the soups/drinks this covers, same approximation the label itself makes).
  const unit = (food.servingSizeUnit || '').toLowerCase()
  if (isBranded && food.servingSize && ['g', 'grm', 'ml', 'mlt'].includes(unit)) {
    const grams = Math.round(food.servingSize)
    const household = (food.householdServingFullText || '').trim()
    servings.push({
      label: household ? cleanHousehold(household, grams) : `1 serving (${grams}g)`,
      grams,
    })
  }
  servings.push({ label: '100 g', grams: 100 })
  servings.push({ label: '1 oz (28 g)', grams: 28 })
  servings.push({ label: '1 g', grams: 1 })

  const first = servings[0]
  return {
    id: food.fdcId,
    name: isBranded ? titleCase(food.description) : calmCaps(food.description),
    brand,
    verified: true,
    per100,
    servings,
    defaultServing: {
      label: first.label,
      calories: Math.round((per100.calories * first.grams) / 100),
    },
  }
}

export async function POST(req: Request) {
  // Signed-in members only: this proxies our USDA API quota.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (query.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }
  if (query.length > 120) {
    return NextResponse.json({ error: 'Query too long' }, { status: 400 })
  }

  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Food database not configured' }, { status: 500 })
  }

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', query)
  url.searchParams.set('pageSize', '25')
  url.searchParams.set('dataType', 'Branded,Foundation,SR Legacy')

  let foods: FdcFood[]
  try {
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`USDA responded ${res.status}`)
    const json = await res.json()
    foods = (json.foods as FdcFood[] | undefined) ?? []
  } catch (err) {
    console.error('[food-search] USDA request failed:', err)
    return NextResponse.json({ error: 'Food search is unavailable right now' }, { status: 502 })
  }

  // Normalise, then drop the near-duplicate branded submissions FDC returns.
  const seen = new Set<string>()
  const results: FoodSearchHit[] = []
  for (const food of foods) {
    const hit = normalise(food)
    if (!hit) continue
    const key = `${hit.name}|${hit.brand ?? ''}|${hit.per100.calories}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(hit)
    if (results.length >= 20) break
  }

  return NextResponse.json({ results })
}
