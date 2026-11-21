/**
 * Three tabs, and nowhere a client can get lost.
 *
 * Train came off the bar because Home and Train had led with the same thing
 * since the Home rebuild — today's session and a Start button. Two doors into
 * one room. The program is reached from Today now, at the same URL.
 *
 * The risk in that change is not the deletion, it is the highlighting.
 * `pathname === tab.href` worked only while every destination was a tab; with
 * Train gone it would leave /studio/programs lighting nothing, so a client who
 * opened their plan would watch the bar go dark and have no idea which tab
 * they were under. The same bug had always been there for Check-in and
 * Schedule, both reached from Coach, and nobody had reported it.
 *
 * Every route in app/studio is listed below by hand. That is the point: the
 * list is a second opinion, so a route that quietly stops being reachable
 * fails here rather than in front of a client.
 */
import { NAV_TABS, PROFILE_LINKS, owns, activeTab } from '@/lib/nav'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

/** Every page under app/studio, written out rather than globbed. */
const EVERY_STUDIO_ROUTE = [
  '/studio',
  '/studio/programs',
  '/studio/nutrition',
  '/studio/setup-nutrition',
  '/studio/messages',
  '/studio/check-in',
  '/studio/schedule',
  '/studio/progress',
  '/studio/settings',
  '/studio/community',
  '/studio/onboarding',
  '/studio/food',
]

/** Reached from the avatar, or from inside a screen. No tab owns these. */
const DELIBERATELY_UNOWNED = [
  '/studio/progress', // avatar menu
  '/studio/settings', // avatar menu
  '/studio/community', // off the navigation until there is a community
  '/studio/onboarding', // a nudge on Today, coached tiers only
  '/studio/food', // a redirect kept for old links
]

console.log('THREE TABS\n')
ok(NAV_TABS.length === 3, 'there are three', String(NAV_TABS.length))
ok(
  NAV_TABS.map((t) => t.label).join(' · ') === 'Today · Food · Coach',
  'Today, Food, Coach, in that order',
  NAV_TABS.map((t) => t.label).join(' · ')
)
ok(!NAV_TABS.some((t) => t.label === 'Train'), 'Train is not one of them')
ok(!NAV_TABS.some((t) => t.label === 'More'), 'and there is still no More button')

console.log('\nEVERY TAB OWNS ITS OWN HREF\n')
// A tab that does not light up on its own page is the most embarrassing
// version of this bug and the easiest to introduce by editing one list.
for (const tab of NAV_TABS) {
  ok(owns(tab, tab.href), `${tab.label} lights up on ${tab.href}`)
}

console.log('\nNO ROUTE BELONGS TO TWO TABS\n')
const seen = new Map<string, string>()
let doubled = 0
for (const tab of NAV_TABS) {
  for (const route of tab.owns) {
    if (seen.has(route)) {
      doubled++
      console.log(`        ${route} is claimed by ${seen.get(route)} and ${tab.label}`)
    }
    seen.set(route, tab.label)
  }
}
ok(doubled === 0, 'each owned route has exactly one tab', `${doubled} doubled`)

console.log('\nTHE PROGRAM IS UNDER TODAY\n')
// The whole point of the phase. /studio/programs kept its URL; what changed
// is which tab a client is under while they are there.
const plan = activeTab('/studio/programs')
ok(plan != null, '/studio/programs lights a tab at all', plan ? plan.label : 'NOTHING')
ok(plan?.label === 'Today', 'and the tab it lights is Today', plan?.label ?? '—')

console.log('\nCHECK-IN AND SCHEDULE ARE UNDER COACH\n')
// These two were already reached from Coach and already lit nothing. Fixed in
// passing, because it is the same mistake.
ok(activeTab('/studio/check-in')?.label === 'Coach', 'the weekly check-in', String(activeTab('/studio/check-in')?.label))
ok(activeTab('/studio/schedule')?.label === 'Coach', 'sessions', String(activeTab('/studio/schedule')?.label))
ok(
  activeTab('/studio/setup-nutrition')?.label === 'Food',
  'and nutrition setup is under Food',
  String(activeTab('/studio/setup-nutrition')?.label)
)

console.log('\nTODAY DOES NOT SWALLOW EVERYTHING\n')
/* `/studio` is a prefix of every other studio route. Matching on prefixes
   would light Today on the nutrition page, the messages page and everywhere
   else — which is why owns() compares whole paths. */
for (const route of ['/studio/nutrition', '/studio/messages', '/studio/check-in']) {
  ok(activeTab(route)?.label !== 'Today', `${route} is not Today`, String(activeTab(route)?.label))
}

console.log('\nEVERY ROUTE IS EITHER OWNED OR DELIBERATELY NOT\n')
// The check that catches a route added later and wired to nothing.
for (const route of EVERY_STUDIO_ROUTE) {
  const tab = activeTab(route)
  const intended = DELIBERATELY_UNOWNED.indexOf(route) !== -1
  ok(
    intended ? tab === null : tab !== null,
    `${route.padEnd(26)} ${intended ? 'is reached another way' : `is under ${tab?.label}`}`,
    intended && tab !== null ? `but ${tab.label} claims it` : ''
  )
}

console.log('\nNOTHING OWNED POINTS AT A ROUTE THAT DOES NOT EXIST\n')
let ghosts = 0
for (const tab of NAV_TABS) {
  for (const route of tab.owns) {
    if (EVERY_STUDIO_ROUTE.indexOf(route) === -1) {
      ghosts++
      console.log(`        ${tab.label} owns ${route}, which is not a page`)
    }
  }
}
ok(ghosts === 0, 'every owned route is a real page', `${ghosts} ghosts`)

console.log('\nTHE AVATAR MENU HOLDS WHAT IT SHOULD, AND NOT MY PLAN\n')
ok(PROFILE_LINKS.length === 2, 'two items', String(PROFILE_LINKS.length))
ok(
  !PROFILE_LINKS.some((l) => l.href === '/studio/programs'),
  'the program is NOT behind the avatar',
  PROFILE_LINKS.map((l) => l.label).join(', ')
)
for (const link of PROFILE_LINKS) {
  ok(activeTab(link.href) === null, `${link.label} lights no tab`, String(activeTab(link.href)?.label))
}

console.log('\nAND A PAGE OUTSIDE THE STUDIO LIGHTS NOTHING\n')
for (const route of ['/members', '/luffy', '/', '/studio/nutrition/']) {
  ok(activeTab(route) === null, `${route} is not a studio tab`, String(activeTab(route)?.label))
}

console.log(failed === 0 ? '\nAll nav checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
