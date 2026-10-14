import { redirect } from 'next/navigation'

/**
 * This screen moved into /studio/nutrition as a tab.
 *
 * It was reached by a nav item called "Meals" while the item called "Food"
 * opened the tracker — two labels pointing at each other's destinations, which
 * is the kind of thing nobody reports and everybody quietly works around.
 *
 * The route stays as a redirect rather than being deleted: this URL has been
 * live, it is linked from older in-app copy, and a client who has it
 * bookmarked or open in a tab should land somewhere useful rather than on a
 * 404. It costs one file.
 */
export default function FoodPageMoved() {
  redirect('/studio/nutrition')
}
