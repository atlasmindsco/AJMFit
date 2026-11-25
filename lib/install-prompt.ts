/**
 * Whether to suggest installing the app, and what to say.
 *
 * WHY THIS IS ABOUT THE REST TIMER. The timer fires a beep, a vibration and
 * a notification when rest is over. On an iPhone in Safari, two of those
 * three do nothing: `navigator.vibrate` is not implemented at all, and a
 * backgrounded tab has its timers suspended, so the notification usually
 * never fires. Lock the phone during a 180-second rest and nothing reaches
 * you. There is no code fix for that — it is the platform.
 *
 * Installed to the home screen, iOS 16.4+ does deliver web notifications,
 * and the tab stops being a tab somebody can navigate away from. So the
 * honest answer to "why didn't my timer go off" is a one-line suggestion,
 * not a bigger beep.
 *
 * Pure. No DOM, no storage, no React — it takes what the browser reports and
 * returns what to show, so the awkward cases can be checked directly rather
 * than discovered on somebody's phone mid-set.
 */

export type Platform = 'ios' | 'android' | 'desktop'

export interface Environment {
  /** navigator.userAgent */
  userAgent: string
  /** display-mode: standalone, or navigator.standalone on iOS */
  isStandalone: boolean
  /** Whether a beforeinstallprompt event has been captured. */
  hasInstallEvent: boolean
  /** Whether the client dismissed this before. */
  dismissed: boolean
}

export interface Suggestion {
  /** The headline. Says what they GET, never "install our app". */
  title: string
  /** How, in the words the platform's own menus use. */
  body: string
  /** True when the browser can do it in one tap and we should show a button. */
  canPromptDirectly: boolean
}

export function platformOf(userAgent: string): Platform {
  const ua = userAgent.toLowerCase()
  // iPadOS 13+ reports itself as a Mac. The touch check that normally
  // distinguishes them is not available here, so a desktop Safari user may
  // occasionally see the iOS wording. That is a worse outcome than nothing
  // only if the wording is wrong, so it reads as an instruction they can
  // ignore rather than a claim about their device.
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

/**
 * Nothing at all, most of the time.
 *
 * Returns null unless there is a real gain to offer: already installed means
 * the problem is solved, dismissed means they answered, and desktop browsers
 * do not have the rest-alert problem this exists for.
 */
export function suggestInstall(env: Environment): Suggestion | null {
  if (env.isStandalone) return null
  if (env.dismissed) return null

  const platform = platformOf(env.userAgent)

  if (platform === 'ios') {
    return {
      title: 'Let the rest timer reach you',
      // The exact words in the iOS share sheet, so there is nothing to work out.
      body: 'In Safari, tap Share, then Add to Home Screen. Rest alerts can then reach you with the phone locked.',
      canPromptDirectly: false,
    }
  }

  if (platform === 'android' && env.hasInstallEvent) {
    return {
      title: 'Let the rest timer reach you',
      body: 'Add AJM Fit to your home screen so rest alerts reach you with the phone locked.',
      canPromptDirectly: true,
    }
  }

  // Android without the event (already installed, unsupported browser, or
  // Chrome has decided not to offer it) and every desktop: say nothing. A
  // suggestion the browser will not honour is worse than silence.
  return null
}
