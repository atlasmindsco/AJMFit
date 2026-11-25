/**
 * When to suggest installing, and — mostly — when not to.
 *
 * A prompt like this earns its place only by being rare. The rule that
 * matters is the one that returns null: already installed, already said no,
 * or a browser that will not honour it. Getting that wrong turns the one
 * honest answer to "why didn't my rest timer go off" into another banner
 * people learn to dismiss without reading.
 */
import { platformOf, suggestInstall, type Environment } from '@/lib/install-prompt'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const env = (over: Partial<Environment> = {}): Environment => ({
  userAgent: IPHONE,
  isStandalone: false,
  hasInstallEvent: false,
  dismissed: false,
  ...over,
})

console.log('WHICH PLATFORM\n')
ok(platformOf(IPHONE) === 'ios', 'iPhone', platformOf(IPHONE))
ok(platformOf(ANDROID) === 'android', 'Android', platformOf(ANDROID))
ok(platformOf(MAC) === 'desktop', 'Mac', platformOf(MAC))
ok(platformOf(WINDOWS) === 'desktop', 'Windows', platformOf(WINDOWS))
ok(platformOf('') === 'desktop', 'an empty user agent does not crash or guess iOS', platformOf(''))

console.log('\nIT SAYS NOTHING WHEN THERE IS NOTHING TO GAIN\n')
/* These three are the whole design. A prompt that shows in any of these
   states is a prompt people stop reading. */
ok(suggestInstall(env({ isStandalone: true })) === null, 'already installed')
ok(suggestInstall(env({ dismissed: true })) === null, 'already said no')
ok(suggestInstall(env({ isStandalone: true, dismissed: true })) === null, 'both')
ok(suggestInstall(env({ userAgent: MAC })) === null, 'a desktop does not have the rest-alert problem')
ok(suggestInstall(env({ userAgent: WINDOWS, hasInstallEvent: true })) === null, 'nor does a desktop that could install')

console.log('\nANDROID ONLY WHEN THE BROWSER WILL ACTUALLY HONOUR IT\n')
/* Chrome fires beforeinstallprompt when it is willing. Offering a button
   that does nothing is worse than offering nothing. */
ok(suggestInstall(env({ userAgent: ANDROID, hasInstallEvent: false })) === null, 'no install event, no offer')
const android = suggestInstall(env({ userAgent: ANDROID, hasInstallEvent: true }))
ok(android !== null, 'with the event, offer it')
ok(android?.canPromptDirectly === true, 'and it is one tap')

console.log('\nIOS IS THE CASE THIS EXISTS FOR\n')
/* Safari has no beforeinstallprompt and never will, so the offer cannot
   depend on one — and it has to be instructions rather than a button. */
const ios = suggestInstall(env())
ok(ios !== null, 'offered without any install event')
ok(ios?.canPromptDirectly === false, 'instructions, not a button, because Safari has no API for it')
ok(/share/i.test(ios?.body ?? ''), 'names the Share sheet', ios?.body)
ok(/add to home screen/i.test(ios?.body ?? ''), 'in the exact words iOS uses')

console.log('\nWHAT IT SAYS IS ABOUT THEM, NOT ABOUT US\n')
for (const [label, s] of [
  ['iOS', ios],
  ['Android', android],
] as Array<[string, ReturnType<typeof suggestInstall>]>) {
  ok(/rest timer|rest alerts/i.test(s?.title + ' ' + s?.body), `${label} names the thing it fixes`, s?.title)
  ok(!/install our app/i.test(s?.title + ' ' + s?.body), `${label} does not say "install our app"`)
  ok((s?.title.length ?? 99) <= 40, `${label} headline stays short`, String(s?.title.length))
}

console.log('\nNOTHING ODD THROWS\n')
for (const [label, run] of [
  ['empty everything', () => suggestInstall(env({ userAgent: '' }))],
  ['garbage user agent', () => suggestInstall(env({ userAgent: '!!!' }))],
] as Array<[string, () => unknown]>) {
  let got: string
  try {
    got = String(run() === null ? 'null' : 'suggestion')
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(failed === 0 ? '\nAll install-prompt checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
