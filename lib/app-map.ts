/**
 * Client studio app map, gives Chea (the in-app assistant) awareness of how
 * the client side of AJM Fit is laid out so it can answer "where/how do I…"
 * questions and link the client straight to the right page.
 *
 * Pure data + string builders, safe to import in both the chat API route and
 * the client chat component. CLIENT_ROUTES is the whitelist the UI validates
 * navigation tags against.
 */

export type AppDestination = {
  route: string
  label: string // short button label, e.g. "Nutrition"
  title: string // human-facing page name
  does: string // what the client can accomplish there
  keywords: string[] // phrases that should point here
}

export const CLIENT_APP_MAP: AppDestination[] = [
  {
    route: '/studio',
    label: 'Dashboard',
    title: 'Dashboard',
    does: 'Your training snapshot, workouts this week, calories & macros today, water, recent PRs, and your currently assigned program.',
    keywords: ['home', 'dashboard', 'overview', 'snapshot', 'summary', 'progress', 'prs', 'personal records'],
  },
  {
    route: '/studio/programs',
    label: 'Programs',
    title: 'Programs & Training',
    does: 'See the program Coach Anthony assigned you, browse the full exercise library (800+ exercises with demos), and log your workouts, sets and PRs.',
    keywords: ['program', 'workout', 'training', 'exercise', 'lift', 'routine', 'split', 'log a workout', 'sets', 'reps', 'demo'],
  },
  {
    route: '/studio/nutrition',
    label: 'Nutrition',
    title: 'Nutrition',
    does: 'Log meals, track calories and macros (protein/carbs/fats) against your targets, log water, scan a barcode, and search foods.',
    keywords: ['nutrition', 'food', 'meal', 'calories', 'macros', 'protein', 'carbs', 'fats', 'water', 'barcode', 'scan', 'diet', 'log my food', 'eat'],
  },
  {
    route: '/studio/messages',
    label: 'Messages',
    title: 'Messages',
    does: 'Message Coach Anthony directly for personalized coaching, questions, or check-ins.',
    keywords: ['message', 'coach', 'anthony', 'chat with coach', 'talk to coach', 'contact', 'check in', 'check-in', 'dm'],
  },
  {
    route: '/studio/community',
    label: 'Community',
    title: 'Community',
    does: 'The member feed, share posts, comment, see upcoming events, and check the leaderboard.',
    keywords: ['community', 'feed', 'post', 'comment', 'event', 'leaderboard', 'members', 'social'],
  },
]

/** Routes the assistant is allowed to navigate the client to. */
export const CLIENT_ROUTES = new Set(CLIENT_APP_MAP.map((d) => d.route))

/** Compact app map + navigation instructions for the client system prompt. */
export function clientAppMapPrompt(): string {
  const lines = CLIENT_APP_MAP.map((d) => `- ${d.title} (${d.route}): ${d.does}`).join('\n')
  return `APP NAVIGATION, you also know how the AJM Fit member studio is organized and can guide clients around it:

${lines}

Account: the client's profile/initials and a Sign Out button are at the top-right of every page. A Feedback button floats at the bottom of the screen. Billing/membership is handled through Stripe when prompted.

When the client asks where or how to do something inside the app (log food, see their program, message the coach, etc.): give a one-sentence answer, then on a NEW line add a navigation tag so they can jump there, formatted EXACTLY like:
[[go:/studio/nutrition|Nutrition]]
Rules for tags:
- Use ONLY the exact routes listed above. Never invent a route.
- Add at most 1-2 tags, only when navigation actually helps.
- Do NOT add a tag for general fitness/nutrition questions that aren't about using the app.`
}
