/**
 * The image that leaves the product.
 *
 * Everything else in AJM Fit is seen by one client and their coach. This is
 * seen by their friends, with their name on it, so the bar is higher in two
 * specific ways: nothing on it may be untrue, and nothing on it may embarrass
 * them.
 */
import { buildShareCard, shareFilename, shareLayout, maxExerciseRows, shareText, heroStartFont, SHARE_FORMATS } from '@/lib/share-card'

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
  exercises: [
    { name: 'Barbell Bench Press', detail: '225 lb × 5' },
    { name: 'Incline Dumbbell Press', detail: '70 lb × 10' },
    { name: 'Dips', detail: '3 × 12' },
  ],
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

console.log('\nNOTHING SITS ON TOP OF ANYTHING ELSE\n')
/* TWO BUGS IN A ROW CAME FROM THE SAME MISREADING, so it is a check now
   rather than a comment. Canvas text grows UPWARDS from its baseline: a 64px
   heading occupies about 46px above the number the layout stores and hangs
   about 14px below it. Advance to the next thing by a plain gap and the two
   overlap.
   First the blue tick landed on "Workout Complete". The fix for that pushed
   "Push Day" up into the heading's descenders one line further down. Both
   were arithmetically consistent and both were invisible until a card was
   actually drawn — which is exactly the kind of bug a test should be holding,
   because the next person to resize this type will not be looking for it. */
const CAPH = 0.72
const DESCH = 0.22
for (const f of SHARE_FORMATS) {
  for (const hasAchievement of [true, false]) {
    const rows = maxExerciseRows(f, { hasHero: true, hasAchievement })
    const L = shareLayout(f, { hasHero: true, hasAchievement, heroFont: heroStartFont(f), rows })
    const tag = f.key + (hasAchievement ? ' + PR' : '')

    const tickBottom = L.tickY + L.tickR * 2
    const headingTop = L.headingY - L.headingFont * CAPH
    ok(headingTop > tickBottom, tag + ': the tick clears the heading', Math.round(headingTop - tickBottom) + 'px')

    const headingBottom = L.headingY + L.headingFont * DESCH
    const subTop = L.subY - L.subFont * CAPH
    ok(subTop > headingBottom, tag + ': the heading clears the day name', Math.round(subTop - headingBottom) + 'px')

    const subBottom = L.subY + L.subFont * DESCH
    const heroTop = L.heroY! - heroStartFont(f) * 0.78
    ok(heroTop > subBottom, tag + ': the day name clears the volume figure', Math.round(heroTop - subBottom) + 'px')

    const heroBottom = L.heroLabelY! + 34 * DESCH
    ok(L.tilesY > heroBottom, tag + ': the volume label clears the tiles', Math.round(L.tilesY - heroBottom) + 'px')

    const tilesBottom = L.tilesY + L.tileH
    const firstAfterTiles = hasAchievement ? L.barY : L.listHeadY! - 28 * CAPH
    ok(firstAfterTiles > tilesBottom, tag + ': the tiles clear what follows them', Math.round(firstAfterTiles - tilesBottom) + 'px')

    if (hasAchievement) {
      const barBottom = L.barY + L.barH
      const listTop = L.listHeadY! - 28 * CAPH
      ok(listTop > barBottom, tag + ': the PR bar clears the list', Math.round(listTop - barBottom) + 'px')
    }

    const lastRow = L.listY! + (rows - 1) * L.listRowH + 32 * DESCH
    const footTop = L.siteY - 34 * CAPH
    ok(footTop > lastRow, tag + ': the last exercise clears the footer', Math.round(footTop - lastRow) + 'px')
  }
}

console.log('\nTHE WORK IS LISTED, AND THE LIST IS TRUE\n')
/* Anthony asked for the exercises on the card. The volume figure is the size
   of a session; this is the evidence for it, and evidence that overstates is
   worse than none — the person posting it knows exactly what they did, and so
   does anybody who trains with them. */
const work = buildShareCard(input(), story)
console.log('        ' + work.exercises.map((e) => e.name + ' ' + e.detail).join('  ·  '))
ok(work.exercises.length === 3, 'all three exercises are on it', String(work.exercises.length))
ok(work.exercises[0].detail === '225 lb × 5', 'a loaded set reads as weight by reps', work.exercises[0].detail)
ok(work.exercises[2].detail === '3 × 12', 'and bodyweight reads as sets by reps', work.exercises[2].detail)
ok(work.more === null, 'nothing is hidden when it all fits', String(work.more))

console.log('\nA LONG SESSION SAYS THAT IT WAS TRIMMED\n')
/* Six of eight shown silently would understate the session. The card has to
   either show it or admit it. */
const many = Array.from({ length: 12 }, (_, i) => ({ name: 'Exercise ' + (i + 1), detail: '100 lb × 8' }))
for (const f of SHARE_FORMATS) {
  const c = buildShareCard(input({ exercises: many }), f)
  const accounted = c.exercises.length + (c.more ? Number(c.more.replace(/\D/g, '')) : 0)
  ok(c.more !== null, f.key + ': a trimmed list says so', String(c.more))
  ok(accounted === 12, f.key + ': every exercise is either shown or counted', accounted + ' of 12')
  ok(c.exercises.length > 0, f.key + ': and it still shows some of them', String(c.exercises.length))
}
/* THE STORY IS 570px TALLER AND HOLDS THE SAME SIX, which is not what I
   assumed when writing this check — it asserted the story held more and
   failed. Instagram covers roughly the top and bottom 250px of a story with
   its own header and reply bar, so a 1920 frame has about 1420 usable, while
   the 1350 post has all of it. The extra height is rented, not owned.
   That is exactly why the cap is derived instead of written down: a guess
   would have been wrong in the direction that pushes text off a post. */
const worst = { hasHero: true, hasAchievement: true }
ok(maxExerciseRows(story, worst) >= 6, 'the story holds six in the worst case', String(maxExerciseRows(story, worst)))
ok(maxExerciseRows(post, worst) >= 6, 'and so does the post, despite being 570px shorter', String(maxExerciseRows(post, worst)))
/* Six covers the library: its longest day is eight exercises and the median
   is five, so a trimmed card is the exception rather than the rule. */
ok(maxExerciseRows(story, worst) <= 10, 'and nothing turns the card into a spreadsheet', String(maxExerciseRows(story, worst)))
/* And a card with no PR bar has room the bar would have taken. */
ok(
  maxExerciseRows(post, { hasHero: true, hasAchievement: false }) >=
    maxExerciseRows(post, { hasHero: true, hasAchievement: true }),
  'and a card without a PR bar holds at least as many'
)

console.log('\nA NAME TOO LONG FOR THE ROW IS CUT, NOT RUN OVER\n')
const longName = buildShareCard(input({ exercises: [{ name: 'Barbell Bench Press - Medium Grip Variation', detail: '225 lb × 5' }] }), story)
ok(longName.exercises[0].name.length <= 26, 'trimmed to fit the column', longName.exercises[0].name.length + ' chars')
ok(longName.exercises[0].name.endsWith('…'), 'and says it was trimmed', longName.exercises[0].name)
ok(longName.exercises[0].detail === '225 lb × 5', 'the figure is never the part that gets cut', longName.exercises[0].detail)

console.log('\nAND A SESSION WITH NOTHING LOGGED HAS NO LIST\n')
/* Not an empty box with a heading over it. */
for (const [label, list] of [
  ['nothing logged', []],
  ['a blank name', [{ name: '   ', detail: '100 lb × 5' }]],
] as Array<[string, Array<{ name: string; detail: string }>]>) {
  const c = buildShareCard(input({ exercises: list }), story)
  ok(c.exercises.length === 0 && c.more === null, label, JSON.stringify(c.exercises))
}

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
