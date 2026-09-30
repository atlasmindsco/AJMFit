/**
 * Serving units: what you measure a food in, and how much of it.
 *
 * The add-food form used to offer one flat list that mixed the amount and the
 * unit together — "1 slice", "2 slices", "1/4 cup", "1 tbsp", "100 g". Two
 * problems fell out of that, both reported from a jar of grape jelly.
 *
 * There was exactly ONE gram option, "100 g". A tablespoon of that jelly is
 * 20g, and there was no way to say 20 — or 37, or anything else — without
 * typing a custom string and hoping the lookup understood it. Grams are how
 * labels are written and how scales read, and they were the hardest thing to
 * enter.
 *
 * And every food offered every unit, so a jar of jelly invited the client to
 * log it in slices. A unit list that suggests nonsense teaches people to
 * distrust the whole field.
 *
 * So: the amount and the unit are separate, grams take any number, and a food
 * is only offered units that could plausibly measure it.
 */

export type UnitKey =
  | 'g'
  | 'oz'
  | 'ml'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'slice'
  | 'piece'
  | 'scoop'
  | 'serving'

export interface Unit {
  key: UnitKey
  /** Shown in the dropdown. */
  label: string
  /** Used when the amount is not 1. */
  plural: string
  /** Offered as one-tap chips beside the amount box. */
  quick: number[]
  /** Fractions make sense for cups; they do not for grams. */
  allowsFraction: boolean
}

export const UNITS: Record<UnitKey, Unit> = {
  g: { key: 'g', label: 'grams (g)', plural: 'g', quick: [10, 20, 30, 50, 100, 150], allowsFraction: false },
  oz: { key: 'oz', label: 'ounces (oz)', plural: 'oz', quick: [1, 2, 3, 4, 6, 8], allowsFraction: true },
  ml: { key: 'ml', label: 'millilitres (ml)', plural: 'ml', quick: [50, 100, 200, 250, 500], allowsFraction: false },
  cup: { key: 'cup', label: 'cups', plural: 'cups', quick: [0.25, 0.33, 0.5, 1, 2], allowsFraction: true },
  tbsp: { key: 'tbsp', label: 'tablespoons', plural: 'tbsp', quick: [0.5, 1, 2, 3], allowsFraction: true },
  tsp: { key: 'tsp', label: 'teaspoons', plural: 'tsp', quick: [0.5, 1, 2, 3], allowsFraction: true },
  slice: { key: 'slice', label: 'slices', plural: 'slices', quick: [1, 2, 3, 4], allowsFraction: false },
  piece: { key: 'piece', label: 'pieces', plural: 'pieces', quick: [1, 2, 3, 4], allowsFraction: false },
  scoop: { key: 'scoop', label: 'scoops', plural: 'scoops', quick: [0.5, 1, 2], allowsFraction: true },
  serving: { key: 'serving', label: 'servings', plural: 'servings', quick: [0.5, 1, 2], allowsFraction: true },
}

/** Weight and a generic serving suit anything at all. */
const ALWAYS: UnitKey[] = ['g', 'oz', 'serving']

/**
 * Word boundaries on every term, without exception.
 *
 * The first version matched bare substrings and the results were absurd once
 * anyone looked: "chocolate" contains "cola" so a chocolate bar was a liquid,
 * "steak" contains "tea" so steak was a liquid, "Hamburger" and "Graham" both
 * contain "ham" so both were sliceable, "Delight" contains "deli", "Pierogi"
 * contains "pie", "Boiled" contains "oil" and "Coating" contains "oat".
 *
 * Multi-word phrases keep their internal spaces and only need boundaries at
 * the ends. Terms that legitimately take suffixes — oat/oats/oatmeal,
 * berry/berries — get a leading boundary only.
 */
const MATCHERS: Array<{ units: UnitKey[]; re: RegExp }> = [
  {
    // Spoonable and spreadable. The grape jelly case.
    units: ['tbsp', 'tsp', 'cup'],
    re: /\b(jell(y|ies)|jam|preserves?|marmalade|butter|spreads?|honey|syrups?|sauces?|dressings?|mayo|mayonnaise|ketchup|mustard|hummus|nutella|tahini|oils?|vinegar|cream cheese|sour cream|yogh?urt|pesto|salsa|gravy|glaze|pastes?|puree|condiment)\b/i,
  },
  {
    units: ['ml', 'cup', 'tbsp'],
    re: /\b(milk|juice|water|sodas?|cola|coffee|teas?|smoothies?|shakes?|broth|stock|soups?|beer|wine|cider|lemonade|kombucha|drinks?|latte|espresso|brew)\b/i,
  },
  {
    units: ['slice'],
    re: /\b(bread|loaf|toast|bagels?|baguette|cheese|pizza|cakes?|pies?|bacon|ham|salami|pepperoni|turkey breast|deli|tomatoe?s?|cucumbers?|melons?|watermelons?)\b/i,
  },
  {
    units: ['piece'],
    re: /\b(eggs?|apples?|bananas?|oranges?|pears?|peach(es)?|plums?|bars?|cookies?|biscuits?|crackers?|wraps?|tortillas?|burgers?|patty|patties|nuggets?|sausages?|wings?|drumsticks?|muffins?|donuts?|rolls?|buns?|dates?|figs?|nuts?|chicken breast|fillets?|steaks?|chops?|shrimp|prawns?|meatballs?)\b/i,
  },
  {
    units: ['scoop'],
    re: /\b(protein|whey|casein|creatine|powders?|isolate|collagen|greens|pre.?workout|mass gainer|bcaa)\b/i,
  },
  {
    units: ['cup'],
    re: /\b(rice|pasta|oats?|oatmeal|cereals?|granola|quinoa|couscous|lentils?|beans?|peas?|corn|berry|berries|grapes?|spinach|lettuce|salad|broccoli|flour|sugar|almonds?|cashews?|walnuts?|raisins?|popcorn|chips?)\b/i,
  },
]

/**
 * Units that could plausibly measure this food, best first.
 *
 * A list that offers everything is the same as a list that offers nothing: the
 * client stops reading it. Unknown foods get the safe general set — weight,
 * volume and a generic serving — and specifically NOT slices or scoops, which
 * are the two that look most obviously wrong on the wrong food.
 */
export function unitsFor(foodName: string): UnitKey[] {
  const name = String(foodName ?? '')
  const matched: UnitKey[] = []
  for (const m of MATCHERS) {
    if (m.re.test(name)) matched.push(...m.units)
  }

  if (matched.length === 0) {
    return ['g', 'oz', 'cup', 'tbsp', 'piece', 'serving']
  }

  // Matched units lead, then the universal ones, de-duplicated.
  const seen = new Set<UnitKey>()
  const out: UnitKey[] = []
  for (const u of [...matched, ...ALWAYS]) {
    if (!seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

/** The best unit to start on for a food: the first one that suits it. */
export function defaultUnitFor(foodName: string): UnitKey {
  return unitsFor(foodName)[0] ?? 'g'
}

const FRACTIONS: Array<[number, string]> = [
  [0.25, '1/4'],
  [0.33, '1/3'],
  [0.5, '1/2'],
  [0.67, '2/3'],
  [0.75, '3/4'],
]

/** "0.5" + tbsp -> "1/2 tbsp"; "20" + g -> "20 g". */
export function formatServing(amount: number, unit: UnitKey): string {
  if (!Number.isFinite(amount) || amount <= 0) return ''
  const u = UNITS[unit]
  const frac = u.allowsFraction ? FRACTIONS.find(([v]) => Math.abs(v - amount) < 0.02) : undefined
  const shown = frac ? frac[1] : String(Math.round(amount * 100) / 100)

  // Abbreviations do not inflect: "20 g", "2 tbsp", "100 ml".
  if (unit === 'g' || unit === 'oz' || unit === 'ml' || unit === 'tbsp' || unit === 'tsp') {
    return `${shown} ${u.plural}`
  }
  // Anything at or below one stays singular: "1/4 cup", not "1/4 cups".
  return `${shown} ${amount > 1 ? u.plural : u.key}`
}

/**
 * Read an existing serving string back into an amount and a unit.
 *
 * Needed so that re-logging a past food, or editing one, lands on the right
 * pair of controls rather than resetting to a default the client never chose.
 */
export function parseServing(text: string): { amount: number; unit: UnitKey } | null {
  const s = String(text ?? '').trim().toLowerCase()
  if (!s) return null

  let amount: number | null = null
  const frac = s.match(/^(\d+)?\s*(\d)\s*\/\s*(\d)/)
  if (frac) {
    const whole = frac[1] ? parseInt(frac[1], 10) : 0
    amount = whole + parseInt(frac[2], 10) / parseInt(frac[3], 10)
  } else {
    const n = s.match(/^(\d+(?:\.\d+)?)/)
    if (n) amount = parseFloat(n[1])
  }
  if (amount == null || !Number.isFinite(amount)) return null

  // Longest keys first so "tbsp" is not swallowed by "tsp"-style prefixes.
  const order: Array<[UnitKey, RegExp]> = [
    ['tbsp', /\btb?sp|tablespoon/],
    ['tsp', /\btsp|teaspoon/],
    ['scoop', /\bscoop/],
    ['slice', /\bslice/],
    ['piece', /\bpiece|\bitem|\bwhole/],
    ['serving', /\bserving|\bportion/],
    ['cup', /\bcup/],
    ['ml', /\bml\b|millilit/],
    ['oz', /\boz\b|ounce/],
    ['g', /\bg\b|\bgram/],
  ]
  for (const [key, re] of order) {
    if (re.test(s)) return { amount, unit: key }
  }
  return null
}

/* -------------------------------------------------------------------------- */

/**
 * A unit the client can pick for a searched food, and what one of it weighs.
 *
 * Search results scale off per-100g macros, so every choice offered here has to
 * carry a gram weight. That rules out cups and spoons in general — we do not
 * know the density of an arbitrary food — but NOT for the food in front of us,
 * because the label already tells us: "1 tbsp (20g)". When USDA gives us a
 * household serving we can read the unit out of it and offer that unit
 * directly, which is how the grape jelly ends up measurable in tablespoons AND
 * in grams without anyone guessing.
 */
export interface ServingChoice {
  unit: UnitKey
  /** Shown in the dropdown, e.g. "tablespoons (20 g)". */
  label: string
  /** What one of this unit weighs. */
  gramsPerUnit: number
  quick: number[]
  allowsFraction: boolean
}

const OZ_IN_G = 28.35

const choiceFor = (unit: UnitKey, gramsPerUnit: number, label: string): ServingChoice => ({
  unit,
  gramsPerUnit,
  label,
  quick: UNITS[unit].quick,
  allowsFraction: UNITS[unit].allowsFraction,
})

/**
 * The units to offer for a searched food, best first.
 *
 * The old list was "1 serving / 100 g / 1 oz (28 g) / 1 g", and it made grams —
 * the thing written on every label and read by every kitchen scale — the
 * clumsiest option on the list: 20 grams meant choosing "1 g" and then typing
 * 20 into a box labelled "number of servings". Grams are now a unit you pick
 * and 20 is the amount you type.
 */
export function servingChoices(
  labelServing: { label: string; grams: number } | null | undefined
): ServingChoice[] {
  const out: ServingChoice[] = []

  if (labelServing && labelServing.grams > 0) {
    const parsed = parseServing(labelServing.label)
    // "1 tbsp (20g)" -> one tablespoon is 20g. "2 tbsp (32g)" -> 16g each.
    if (parsed && parsed.amount > 0 && parsed.unit !== 'serving' && parsed.unit !== 'g' && parsed.unit !== 'oz') {
      const per = labelServing.grams / parsed.amount
      out.push(choiceFor(parsed.unit, per, `${UNITS[parsed.unit].label} (${Math.round(per)} g each)`))
    } else {
      out.push(choiceFor('serving', labelServing.grams, `servings (${Math.round(labelServing.grams)} g each)`))
    }
  }

  out.push(choiceFor('g', 1, 'grams (g)'))
  out.push(choiceFor('oz', OZ_IN_G, 'ounces (oz)'))

  const seen = new Set<UnitKey>()
  return out.filter((c) => (seen.has(c.unit) ? false : (seen.add(c.unit), true)))
}
