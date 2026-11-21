/**
 * Where a client can go, and which tab lights up when they are there.
 *
 * Three destinations. There is no More button, and no Train tab.
 *
 * There used to be nine: Today, Train, Food, Coach, plus Check-in, Progress,
 * Schedule, Community and Settings behind a More button. Three of those five
 * had never been opened by a single client in the product's history, which is
 * what a hidden menu does — a feature behind More has to be remembered rather
 * than noticed, and a new customer has nothing to remember yet.
 *
 * Then Train went too, which is the change this file is really about. Home and
 * Train had led with the same thing since the Home rebuild — today's session
 * and a Start button — so the bar was asking people to choose between two
 * doors into one room. The program now hangs off Today as "My Plan", at the
 * same URL, with the same six views and the same back behaviour. Nothing
 * moved; one door was closed.
 *
 * `owns` is why a tab can light up for a page that is not its own href.
 * Highlighting used to be `pathname === tab.href`, which worked only while
 * every destination was a tab. It would have left /studio/programs lighting
 * nothing at all, and it had always left Check-in and Schedule — both reached
 * from Coach — lighting nothing either, so you could tap through from Coach
 * and watch the bar go dark. A tab is lit when you are anywhere it owns.
 *
 * This lives in lib/ rather than in the layout so it can be checked: a route
 * that belongs to two tabs, or to none, is the kind of thing nobody notices
 * until a client is lost. See tools/verify-nav.ts.
 */

export interface NavTab {
  label: string
  href: string
  /** SVG path for the mobile bar's icon. */
  d: string
  /**
   * Every route under this tab, its own href included.
   *
   * Exact paths, not prefixes. `/studio` is a prefix of every other studio
   * route, so prefix matching would light Today everywhere.
   */
  owns: string[]
}

export const NAV_TABS: NavTab[] = [
  {
    label: 'Today',
    href: '/studio',
    d: 'm2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
    owns: ['/studio', '/studio/programs'],
  },
  {
    label: 'Food',
    href: '/studio/nutrition',
    d: 'M6.75 3v8.25a2.25 2.25 0 0 0 4.5 0V3m-2.25 8.25V21M15.75 3c-1.243 1.5-1.5 3.75-1.5 5.25 0 1.243.757 2.25 1.5 2.25V21',
    owns: ['/studio/nutrition', '/studio/setup-nutrition'],
  },
  {
    label: 'Coach',
    href: '/studio/messages',
    d: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
    owns: ['/studio/messages', '/studio/check-in', '/studio/schedule'],
  },
]

/**
 * Under your initials, top right. Things you check rather than places you go.
 *
 * Deliberately not owned by any tab: you can be on Progress with the whole bar
 * dark, because you got there from the avatar and that is where you go back to.
 * My Plan is NOT here — burying the program behind an icon that everywhere
 * else on a phone means "account settings" is the one arrangement that tested
 * worse than changing nothing.
 */
export const PROFILE_LINKS = [
  { label: 'Progress', href: '/studio/progress' },
  { label: 'Settings', href: '/studio/settings' },
]

/** Is this tab the one you are under right now? */
export function owns(tab: NavTab, pathname: string): boolean {
  return tab.owns.indexOf(pathname) !== -1
}

/** The tab to light for a path, or null when none should be. */
export function activeTab(pathname: string): NavTab | null {
  for (const tab of NAV_TABS) {
    if (owns(tab, pathname)) return tab
  }
  return null
}
