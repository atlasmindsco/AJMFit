import type { Sex } from '@/lib/nutrition-goals'

/**
 * Hand portions and situation cards.
 *
 * Both exist for the same reason: a client needs an answer at the moment they
 * are holding a plate, not a lookup they will not do. Hand portions are
 * deliberately approximate — they get an untrained client to roughly the right
 * intake with no logging at all, which is the difference between someone who
 * starts and someone who does not.
 */

export interface Portion {
  component: string
  measure: string
  perMeal: string
  note: string
}

export function portionsFor(sex: Sex): Portion[] {
  const two = sex === 'male'
  return [
    {
      component: 'Protein',
      measure: 'One palm',
      perMeal: two ? '2 palms' : '1 palm',
      note: 'Chicken, beef, fish, tofu, eggs, Greek yoghurt. The one to get right.',
    },
    {
      component: 'Vegetables',
      measure: 'One fist',
      perMeal: two ? '2 fists' : '1 to 2 fists',
      note: 'Anything green or colourful. Hard to overdo.',
    },
    {
      component: 'Carbs',
      measure: 'One cupped hand',
      perMeal: two ? '2 cupped hands' : '1 cupped hand',
      note: 'Rice, potato, pasta, oats, bread, fruit.',
    },
    {
      component: 'Fats',
      measure: 'One thumb',
      perMeal: two ? '2 thumbs' : '1 thumb',
      note: 'Oil, butter, nuts, cheese, avocado. Easy to add without noticing.',
    },
  ]
}

export interface SituationCard {
  id: string
  title: string
  rules: string[]
}

/**
 * Three rules per situation, not a menu database.
 *
 * A restaurant menu lookup is enormous to maintain, stale within months, and
 * the client will not open it at the table. Three things they can remember
 * beat a database they will not use.
 */
export const SITUATIONS: SituationCard[] = [
  {
    id: 'fast-food',
    title: 'Fast food',
    rules: [
      'Order the grilled item, not the crispy or breaded one.',
      'Skip the drink calories. Water or diet, every time.',
      'One side, not two, and make it the smaller size.',
    ],
  },
  {
    id: 'italian',
    title: 'Italian',
    rules: [
      'Tomato-based sauce over cream-based.',
      'Say no to the bread basket before it lands, not after.',
      'Add a grilled chicken or fish to the pasta so it carries protein.',
    ],
  },
  {
    id: 'mexican',
    title: 'Mexican',
    rules: [
      'Bowl or fajitas rather than a burrito wrap.',
      'Double the meat, single the rice.',
      'Guacamole is fine. Cheese, sour cream and chips together are not.',
    ],
  },
  {
    id: 'asian',
    title: 'Asian',
    rules: [
      'Steamed over fried, and ask for sauce on the side.',
      'Start with a broth-based soup so you order less of the rest.',
      'Plain rice rather than fried rice.',
    ],
  },
  {
    id: 'steakhouse',
    title: 'Steakhouse or pub',
    rules: [
      'Leaner cut, and take half home if it arrives huge.',
      'Swap the fries for a baked potato or vegetables.',
      'The steak is rarely the problem. The sides and drinks are.',
    ],
  },
  {
    id: 'drinks',
    title: 'Drinking',
    rules: [
      'Spirits with a zero-calorie mixer are the cheapest option, calorie-wise.',
      'Eat a protein-heavy meal beforehand, not after.',
      'Alternate with water. Most of the damage is the 2am food, not the drinks.',
    ],
  },
  {
    id: 'travel',
    title: 'Travelling',
    rules: [
      'Pack protein you do not need a fridge for: jerky, bars, shakes.',
      'Hit your protein and let the rest be imperfect.',
      'One sit-down meal a day you actually choose beats three you did not.',
    ],
  },
  {
    id: 'social',
    title: 'Parties and family meals',
    rules: [
      'Eat normally during the day. Arriving starving is the whole problem.',
      'Fill the plate with protein and vegetables first, then whatever is left.',
      'Enjoy it, log it roughly, carry on tomorrow. One meal changes nothing.',
    ],
  },
]

/**
 * What to say when someone has a bad day. Not a feature so much as the thing
 * the product should have been saying all along: the target was a weekly
 * average, and one day cannot move a weekly average much.
 */
export const OFF_PLAN_GUIDANCE = [
  'One day over does not undo a week. The maths genuinely does not work that way.',
  'Do not skip meals tomorrow to make up for it. That is what turns one day into three.',
  'Go back to your normal target at the very next meal, not the next Monday.',
]
