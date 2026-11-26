/**
 * The image that leaves the product.
 *
 * Everything else in AJM Fit is seen by one client and their coach. This is
 * seen by their friends, with their name on it, so the bar is higher in two
 * specific ways: nothing on it may be untrue, and nothing on it may embarrass
 * them.
 */
import { buildShareCard, shareFilename, shareText, SHARE_FORMATS } from '@/lib/share-card'

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
  ['everything empty', () => JSON.stringify(buildShareCard({ dayName: '', reps: 0, sets: 0, duration: '', recordCount: 0 })).length],
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
