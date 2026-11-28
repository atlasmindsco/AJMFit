/**
 * The image that leaves the product.
 *
 * Everything else in AJM Fit is seen by one client and their coach. This is
 * seen by their friends, with their name on it, so the bar is higher in two
 * specific ways: nothing on it may be untrue, and nothing on it may embarrass
 * them.
 */
import { buildShareCard, shareFilename, shareLayout, shareText, heroStartFont, SHARE_FORMATS } from '@/lib/share-card'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const input = (over: Partial<Parameters<typeof buildShareCard>[0]> = {}) => ({
  dayName: 'Push Day',
  reps: 186,
  sets: 24,
  duration: '1h 12m',
  recordCount: 2,
  volume: 7340,
  ...over,
})

console.log('THE SHAPES INSTAGRAM ACTUALLY WANTS\n')
const story = SHARE_FORMATS.find((f) => f.key === 'story')!
const post = SHARE_FORMATS.find((f) => f.key === 'post')!
ok(story.width === 1080 && story.height === 1920, 'story is 9:16 at 1080x1920', `${story.width}x${story.height}`)
ok(post.width === 1080 && post.height === 1350, 'post is 4:5 at 1080x1350', `${post.width}x${post.height}`)
ok(SHARE_FORMATS.length === 2, 'and there are only two', String(SHARE_FORMATS.length))

console.log('\nTHE CARD SAYS WHAT THE SCREEN SAID\n')
const card = buildShareCard(input())
console.log(`        ${card.heading} · ${card.subheading} · ${card.stats.map((s) => s.value + ' ' + s.label).join(' · ')}`)
ok(card.heading === 'Workout Complete', 'heading')
ok(card.subheading === 'Push Day', 'the day')
ok(card.stats[0].value === '186' && card.stats[0].label === 'Total Reps', 'reps', card.stats[0].value)
ok(card.stats[1].value === '24', 'sets', card.stats[1].value)
ok(card.stats[2].value === '1h 12m', 'duration, verbatim', card.stats[2].value)
ok(card.site === 'ajmfit.com', 'the site')

console.log('\nVOLUME IS THE FIGURE THE CARD LEADS ON\n')
/* A client asked for this: the number they wanted to post was how much they
   had moved, not how many times they had moved it. Reps and sets describe the
   shape of a session; volume describes the size of it. */
const hero = buildShareCard(input({ volume: 7340 })).hero!
ok(hero !== null, 'there is a hero figure at all')
ok(hero.value === '7,340 LBS', 'with thousands separated, because 7340 is slower to read', hero.value)
ok(hero.label === 'Total Volume', 'and labelled for what it is', hero.label)
ok(buildShareCard(input({ volume: 950 })).hero!.value === '950 LBS', 'no separator where none is needed')
ok(buildShareCard(input({ volume: 7340.6 })).hero!.value === '7,341 LBS', 'rounded to the pound')
ok(buildShareCard(input({ volume: 142500 })).hero!.value === '142,500 LBS', 'and a big one still reads')

console.log('\nBUT A BODYWEIGHT DAY DOES NOT POST A ZERO\n')
/* Pull-ups, dips, push-ups, a run. The data knows the weight was zero; it does
   not know the session was nothing. "0 LBS" in letters an inch high, on
   somebody's story, is the app telling their friends they did nothing — so the
   row is absent instead, and reps and sets carry the card. */
for (const [label, v] of [
  ['no load logged', 0],
  ['a negative slipped through', -40],
  ['NaN from a blank weight box', NaN],
  ['Infinity, which would print as a maths symbol', Infinity],
] as Array<[string, number]>) {
  const c = buildShareCard(input({ volume: v }))
  ok(c.hero === null, label, JSON.stringify(c.hero))
  ok(!/0 LBS|NaN|∞/.test(JSON.stringify(c)), 'and nothing on the card says it', JSON.stringify(c.hero))
}
ok(buildShareCard(input({ volume: 0 })).stats.length === 3, 'the three tiles still carry it')

console.log('\nDURATION IS QUOTED, NEVER RECALCULATED\n')
/* The card takes an already-formatted string on purpose. Two formatters
   eventually disagree, and a client posting "1h 12m" from a screen reading
   "1h 13m" has caught the app being wrong about something trivial — which is
   how they start wondering about the rest of the numbers. */
ok(buildShareCard(input({ duration: '47 min' })).stats[2].value === '47 min', 'whatever the screen said')
ok(buildShareCard(input({ duration: '' })).stats[2].value === '—', 'and an em dash when it said nothing')

console.log('\nA LONG DAY NAME DOES NOT RUN OFF THE EDGE\n')
const long = buildShareCard(input({ dayName: 'Upper Body Push and Accessories Week 3' }))
ok(long.subheading.length <= 24, 'trimmed to fit', `${long.subheading.length} chars`)
ok(long.subheading.endsWith('…'), 'and says it was trimmed', long.subheading)
ok(!long.subheading.endsWith(' …'), 'without a space before the ellipsis', long.subheading)
ok(buildShareCard(input({ dayName: 'Push Day' })).subheading === 'Push Day', 'a short one is left alone')
ok(buildShareCard(input({ dayName: '   ' })).subheading === 'Session', 'a blank name falls back to something sayable')

console.log('\nTHE PR LINE\n')
ok(buildShareCard(input({ recordCount: 2 })).achievement === '2 New PRs', 'plural', String(buildShareCard(input({ recordCount: 2 })).achievement))
ok(buildShareCard(input({ recordCount: 1 })).achievement === '1 New PR', 'singular', String(buildShareCard(input({ recordCount: 1 })).achievement))

console.log('\nAND NO CONSOLATION PRIZE IN PUBLIC\n')
/* "You showed up" is warm on the completion screen and an apology on
   somebody's story, in front of their friends, for not having set a record.
   The row simply is not there. */
const none = buildShareCard(input({ recordCount: 0 }))
ok(none.achievement === null, 'no record, no row', String(none.achievement))
ok(!/showed up|promise|discipline|counts/i.test(JSON.stringify(none)), 'and none of the encouragement lines leak onto it')

console.log('\nTHE NUMBERS ARE ALWAYS SAYABLE\n')
for (const [label, over] of [
  ['negative reps', { reps: -5 }],
  ['fractional sets', { sets: 23.6 }],
  ['zero everything', { reps: 0, sets: 0 }],
] as Array<[string, Partial<Parameters<typeof buildShareCard>[0]>]>) {
  const c = buildShareCard(input(over))
  const vals = c.stats.map((s) => s.value).join(' ')
  ok(!/-|NaN|undefined|\./.test(vals.replace(/[a-z ]/g, '')), label, vals)
}
ok(buildShareCard(input({ sets: 1 })).stats[1].label === 'Set', 'one set is singular')

console.log('\nAND THE CARD FITS, IN EVERY COMBINATION IT CAN BE IN\n')
/* The 4:5 post had fifteen pixels of real clearance between the bottom of the
   PR bar and the top of 'ajmfit.com' once the volume figure went in, and
   nobody noticed because the 9:16 story looked fine. The trap is the wordmark:
   520x346, so two thirds as tall as it is wide, which reads as a thin strip on
   screen and is 200px of vertical budget at the width it was being drawn.
   Cropped text on somebody's story, with their name on it, is not a cosmetic
   bug. So every combination is measured. */
const MIN_CLEARANCE = 60
for (const f of SHARE_FORMATS) {
  for (const hasHero of [true, false]) {
    for (const hasAchievement of [true, false]) {
      const L = shareLayout(f, { hasHero, hasAchievement, heroFont: heroStartFont(f) })
      const what = f.key + (hasHero ? ' + volume' : ' bodyweight') + (hasAchievement ? ' + PR' : '')
      ok(L.clearance >= MIN_CLEARANCE, what, L.clearance + 'px above the footer')
      ok(L.logoY > 0 && L.siteY < f.height, what + ': nothing off the top or bottom edge')
    }
  }
}
/* The story keeps clear of Instagram's own interface, which covers roughly the
   top and bottom 250px of a story and would otherwise sit on the wordmark. */
const story9 = shareLayout(story, { hasHero: true, hasAchievement: true, heroFont: heroStartFont(story) })
ok(story9.logoY >= 250, "the story starts below Instagram's top furniture", story9.logoY + 'px down')
ok(story9.siteY <= story.height - 120, 'and its footer stays above the bottom furniture', (story.height - story9.siteY) + 'px up')
/* A shrunk hero figure must not lift the rest of the card into it. */
const shrunk = shareLayout(story, { hasHero: true, hasAchievement: true, heroFont: 48 })
const full = shareLayout(story, { hasHero: true, hasAchievement: true, heroFont: 150 })
ok(shrunk.tilesY < full.tilesY, 'a narrower number pulls the tiles up rather than overlapping them', shrunk.tilesY + ' vs ' + full.tilesY)
ok(shrunk.clearance > full.clearance, 'and leaves more room, never less')
/* A bodyweight day drops the whole hero block rather than leaving a hole. */
const bw = shareLayout(story, { hasHero: false, hasAchievement: true, heroFont: 150 })
ok(bw.heroY === null && bw.heroLabelY === null, 'no hero means no hero position to draw at')
ok(bw.tilesY < full.tilesY, 'and the tiles move up into the space', bw.tilesY + ' vs ' + full.tilesY)

console.log('\nTHE FILENAME IS SAFE AND MEANS SOMETHING\n')
for (const [day, want] of [
  ['Push Day', 'ajmfit-push-day-story.png'],
  ['Upper / Lower', 'ajmfit-upper-lower-story.png'],
  ['', 'ajmfit-workout-story.png'],
  ['!!!', 'ajmfit-workout-story.png'],
] as Array<[string, string]>) {
  ok(shareFilename(day, 'story') === want, `"${day}"`, shareFilename(day, 'story'))
}
ok(shareFilename('Push Day', 'post').endsWith('-post.png'), 'the format is in the name')

console.log('\nTHE CAPTION STAYS OUT OF THEIR WAY\n')
const text = shareText(card)
console.log(`        ${text}`)
ok(text.includes('ajmfit.com'), 'credits the app')
ok(!text.includes('#'), 'no hashtags in somebody else\'s post')
ok(text.length <= 90, 'short enough to leave room for their own words', `${text.length} chars`)
ok(shareText(none).length > 0 && !shareText(none).includes('PR'), 'and says nothing about records when there were none', shareText(none))

console.log('\nNOTHING ODD THROWS\n')
for (const [label, run] of [
  ['everything empty', () => JSON.stringify(buildShareCard({ dayName: '', reps: 0, sets: 0, duration: '', recordCount: 0, volume: 0 })).length],
  ['enormous numbers', () => buildShareCard(input({ reps: 1e9 })).stats[0].value.length],
  ['unicode day name', () => buildShareCard(input({ dayName: '💪 Push' })).subheading.length],
] as Array<[string, () => number]>) {
  let got: string
  try {
    got = String(run())
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(failed === 0 ? '\nAll share-card checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
