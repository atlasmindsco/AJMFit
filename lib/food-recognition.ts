/**
 * Food → macros pipeline. Three input modes share one output shape:
 *   1. Photo  → GPT-4o vision identifies dish + components → USDA lookup per component → sum
 *   2. Typed  → GPT-4o-mini parses text into components → USDA lookup per component → sum
 *              (single-ingredient queries skip GPT and hit USDA directly)
 *   3. Barcode → Open Food Facts product lookup (no GPT, no USDA)
 *
 * If a USDA lookup fails for a component, GPT's per-component estimate is used as a
 * fallback so a single missing ingredient doesn't tank the whole result.
 */

export type AnalysisSource = 'usda' | 'mixed' | 'gpt' | 'off'

export interface RecognizedFood {
  foodName: string
  servingSize: string
  calories: number
  protein: number
  carbs: number
  fats: number
  source: AnalysisSource
  confidence: 'high' | 'medium' | 'low'
  components: Array<{
    name: string
    grams: number
    source: 'usda' | 'gpt' | 'off'
  }>
}

interface GPTComponent {
  name: string
  grams: number
  est_calories: number
  est_protein: number
  est_carbs: number
  est_fats: number
}

interface GPTAnalysis {
  dish_name: string
  serving_description: string
  components: GPTComponent[]
  confidence: 'high' | 'medium' | 'low'
}

const SHARED_RULES = `Break dishes into INDIVIDUAL INGREDIENT COMPONENTS so we can look up canonical macros for each one. Return ONE JSON object:

{
  "dish_name": "short overall name (e.g., teriyaki chicken bowl)",
  "serving_description": "human-readable serving for the whole dish (e.g., 1 bowl, 1 plate)",
  "components": [
    {
      "name": "specific ingredient name suitable for a USDA database lookup, e.g., 'chicken thigh, cooked, with skin' or 'rice, white, cooked' or 'olive oil'",
      "grams": <best estimate of grams>,
      "est_calories": <integer>,
      "est_protein": <grams>,
      "est_carbs": <grams>,
      "est_fats": <grams>
    }
  ],
  "confidence": "high" | "medium" | "low"
}

CRITICAL RULES:
- Break dishes into separate ingredients (protein, starch, vegetables, sauces, oils)
- Include cooking oils, marinades, dressings, butter etc. — these often dominate fat content
- Use canonical USDA-style names ("chicken breast, cooked, roasted" not "grilled chicken")
- Estimate grams per ingredient, not per dish
- Confidence: "high" for clearly identifiable single dishes, "medium" for typical complexity, "low" for ambiguous
- Reply ONLY with the JSON, no commentary`

const VISION_SYSTEM_PROMPT = `You analyze food photos for a fitness coaching app. ${SHARED_RULES}`

const TEXT_SYSTEM_PROMPT = `You analyze food descriptions typed by users for a fitness coaching app. The user types a meal name or short description (e.g., "teriyaki chicken bowl", "scrambled eggs and toast", "chicken caesar salad"). Use typical restaurant/home portions when grams are not specified. ${SHARED_RULES}`

interface UsdaFood {
  description: string
  foodNutrients: Array<{ nutrientName: string; value: number; unitName: string }>
}

const USDA_NUTRIENTS = {
  calories: 'Energy',
  protein: 'Protein',
  carbs: 'Carbohydrate, by difference',
  fats: 'Total lipid (fat)',
}

async function callGptVision(imageBase64: string, mimeType: string): Promise<GPTAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this food photo. Break it into ingredient components with grams + est macros for each.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error: ${res.status} ${text}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')
  return JSON.parse(content) as GPTAnalysis
}

async function callGptText(query: string): Promise<GPTAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TEXT_SYSTEM_PROMPT },
        { role: 'user', content: `Food description: "${query}"\n\nBreak into ingredient components with grams + est macros for each.` },
      ],
      max_tokens: 600,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error: ${res.status} ${text}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')
  return JSON.parse(content) as GPTAnalysis
}

async function lookupUsda(foodName: string): Promise<UsdaFood | null> {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) return null

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', foodName)
  url.searchParams.set('pageSize', '3')
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS)')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const json = await res.json()
    const foods = json.foods as UsdaFood[] | undefined
    if (!foods || foods.length === 0) return null
    return foods[0]
  } catch {
    return null
  }
}

function extractMacro(food: UsdaFood, nutrientName: string): number {
  // USDA returns Energy as both kJ and KCAL; we only want KCAL for calories.
  const isEnergy = nutrientName === USDA_NUTRIENTS.calories
  const n = food.foodNutrients.find((x) => {
    if (x.nutrientName !== nutrientName) return false
    if (isEnergy) return x.unitName?.toUpperCase() === 'KCAL'
    return true
  })
  return n ? Number(n.value) : 0
}

interface ComponentMacros {
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fats: number
  source: 'usda' | 'gpt'
}

async function macrosForComponent(comp: GPTComponent): Promise<ComponentMacros> {
  const usda = await lookupUsda(comp.name)
  if (usda && comp.grams > 0) {
    const factor = comp.grams / 100
    const calories = extractMacro(usda, USDA_NUTRIENTS.calories) * factor
    const protein = extractMacro(usda, USDA_NUTRIENTS.protein) * factor
    const carbs = extractMacro(usda, USDA_NUTRIENTS.carbs) * factor
    const fats = extractMacro(usda, USDA_NUTRIENTS.fats) * factor
    if (calories > 0 || protein > 0 || carbs > 0 || fats > 0) {
      return { name: comp.name, grams: comp.grams, calories, protein, carbs, fats, source: 'usda' }
    }
  }
  return {
    name: comp.name,
    grams: comp.grams,
    calories: comp.est_calories,
    protein: comp.est_protein,
    carbs: comp.est_carbs,
    fats: comp.est_fats,
    source: 'gpt',
  }
}

function summarise(gpt: GPTAnalysis, resolved: ComponentMacros[]): RecognizedFood {
  const totals = resolved.reduce(
    (acc, c) => ({
      calories: acc.calories + c.calories,
      protein: acc.protein + c.protein,
      carbs: acc.carbs + c.carbs,
      fats: acc.fats + c.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  )
  const sources = resolved.map((c) => c.source)
  const allUsda = sources.every((s) => s === 'usda')
  const allGpt = sources.every((s) => s === 'gpt')
  const source: AnalysisSource = allUsda ? 'usda' : allGpt ? 'gpt' : 'mixed'

  return {
    foodName: gpt.dish_name,
    servingSize: gpt.serving_description,
    calories: Math.round(totals.calories),
    protein: Number(totals.protein.toFixed(1)),
    carbs: Number(totals.carbs.toFixed(1)),
    fats: Number(totals.fats.toFixed(1)),
    source,
    confidence: gpt.confidence,
    components: resolved.map((c) => ({ name: c.name, grams: Math.round(c.grams), source: c.source })),
  }
}

export async function analyzeFood(imageBase64: string, mimeType: string): Promise<RecognizedFood> {
  const gpt = await callGptVision(imageBase64, mimeType)
  if (!gpt.components || gpt.components.length === 0) {
    throw new Error('No components identified in photo')
  }
  const resolved = await Promise.all(gpt.components.map(macrosForComponent))
  return summarise(gpt, resolved)
}

function looksLikeSingleIngredient(query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.split(/\s+/).length > 5) return false
  if (/\b(and|with|plus)\b|,|&/.test(trimmed)) return false
  return true
}

interface ParsedQuantity {
  grams: number
  servingDescription: string
  ingredientName: string
}

const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  lbs: 453.6,
  pound: 453.6,
  pounds: 453.6,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  ml: 1,
}

function parseQuantity(query: string): ParsedQuantity {
  const trimmed = query.trim()
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(.+)$/)
  if (match) {
    const qty = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    const name = match[3].trim()
    const gramsPerUnit = UNIT_TO_GRAMS[unit]
    if (gramsPerUnit && qty > 0) {
      return {
        grams: qty * gramsPerUnit,
        servingDescription: `${match[1]} ${unit} ${name}`,
        ingredientName: name,
      }
    }
  }
  return { grams: 100, servingDescription: '100g', ingredientName: trimmed }
}

export async function lookupTypedFood(query: string): Promise<RecognizedFood> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('Query is empty')

  if (looksLikeSingleIngredient(trimmed)) {
    const parsed = parseQuantity(trimmed)
    const usda = await lookupUsda(parsed.ingredientName)
    if (usda) {
      const factor = parsed.grams / 100
      const calories = extractMacro(usda, USDA_NUTRIENTS.calories) * factor
      const protein = extractMacro(usda, USDA_NUTRIENTS.protein) * factor
      const carbs = extractMacro(usda, USDA_NUTRIENTS.carbs) * factor
      const fats = extractMacro(usda, USDA_NUTRIENTS.fats) * factor
      if (calories > 0 || protein > 0 || carbs > 0 || fats > 0) {
        return {
          foodName: parsed.ingredientName,
          servingSize: parsed.servingDescription,
          calories: Math.round(calories),
          protein: Number(protein.toFixed(1)),
          carbs: Number(carbs.toFixed(1)),
          fats: Number(fats.toFixed(1)),
          source: 'usda',
          confidence: 'high',
          components: [{ name: parsed.ingredientName, grams: Math.round(parsed.grams), source: 'usda' }],
        }
      }
    }
  }

  const gpt = await callGptText(trimmed)
  if (!gpt.components || gpt.components.length === 0) {
    throw new Error('Could not parse food description')
  }
  const resolved = await Promise.all(gpt.components.map(macrosForComponent))
  return summarise(gpt, resolved)
}

interface OffNutriments {
  'energy-kcal_serving'?: number
  'energy-kcal_100g'?: number
  proteins_serving?: number
  proteins_100g?: number
  carbohydrates_serving?: number
  carbohydrates_100g?: number
  fat_serving?: number
  fat_100g?: number
  serving_quantity?: number
}

interface OffProduct {
  product_name?: string
  product_name_en?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number
  nutriments?: OffNutriments
}

interface OffResponse {
  status: 0 | 1
  product?: OffProduct
  status_verbose?: string
}

function offMacro(
  nutriments: OffNutriments,
  servingKey: keyof OffNutriments,
  per100Key: keyof OffNutriments,
  servingGrams: number | undefined
): number {
  const direct = nutriments[servingKey]
  if (typeof direct === 'number' && !Number.isNaN(direct)) return direct
  const per100 = nutriments[per100Key]
  if (typeof per100 === 'number' && !Number.isNaN(per100) && servingGrams && servingGrams > 0) {
    return (per100 * servingGrams) / 100
  }
  return 0
}

export class BarcodeNotFoundError extends Error {
  constructor(barcode: string) {
    super(`Product not found for barcode ${barcode}`)
    this.name = 'BarcodeNotFoundError'
  }
}

export async function lookupBarcode(barcode: string): Promise<RecognizedFood> {
  const clean = barcode.trim()
  if (!clean) throw new Error('Barcode is empty')

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AJM-FIT/1.0 (https://atlasmindspreview.com)',
    },
  })
  if (!res.ok) throw new Error(`Open Food Facts error: ${res.status}`)
  const json = (await res.json()) as OffResponse

  if (json.status !== 1 || !json.product) {
    throw new BarcodeNotFoundError(clean)
  }

  const product = json.product
  const nutriments = product.nutriments ?? {}
  const servingGrams = product.serving_quantity ?? nutriments.serving_quantity

  const calories = offMacro(nutriments, 'energy-kcal_serving', 'energy-kcal_100g', servingGrams)
  const protein = offMacro(nutriments, 'proteins_serving', 'proteins_100g', servingGrams)
  const carbs = offMacro(nutriments, 'carbohydrates_serving', 'carbohydrates_100g', servingGrams)
  const fats = offMacro(nutriments, 'fat_serving', 'fat_100g', servingGrams)

  const baseName = product.product_name_en || product.product_name || 'Scanned product'
  const foodName = product.brands ? `${product.brands} ${baseName}`.trim() : baseName
  const servingSize = product.serving_size || (servingGrams ? `${servingGrams}g` : '1 serving')

  return {
    foodName,
    servingSize,
    calories: Math.round(calories),
    protein: Number(protein.toFixed(1)),
    carbs: Number(carbs.toFixed(1)),
    fats: Number(fats.toFixed(1)),
    source: 'off',
    confidence: 'high',
    components: [
      {
        name: baseName,
        grams: Math.round(servingGrams ?? 0),
        source: 'off',
      },
    ],
  }
}
