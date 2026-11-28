'use client'

/**
 * One line, once, about why the rest timer cannot reach a locked phone.
 *
 * The timer fires a beep, a vibration and a notification when rest is over.
 * On an iPhone in Safari two of those three do nothing — `navigator.vibrate`
 * is not implemented, and a backgrounded tab has its timers suspended, so
 * the notification usually never fires. Lock the phone during a 180-second
 * rest and nothing reaches you. That is the platform, not a bug, and no
 * amount of work on the timer changes it.
 *
 * Installed to the home screen, iOS 16.4+ does deliver web notifications.
 * So this is the honest answer to "why didn't my timer go off", and it is
 * deliberately the smallest possible version of it: no modal, no overlay,
 * no second ask. Dismissed is dismissed, forever, on that device.
 *
 * The decision of whether to show anything is in lib/install-prompt.ts and
 * pinned in tools/verify-install-prompt.ts, because the rule that matters
 * is the one that returns nothing.
 */

import { useEffect, useState } from 'react'
import { suggestInstall, type Suggestion } from '@/lib/install-prompt'

const KEY = 'ajmfit.installHint.dismissed'

/** The Chrome event. Not in lib.dom, and only ever fired by Chromium. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallHint() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    /* Chrome fires this when it is willing to install, which may be before
       or after mount — so it is captured here and re-evaluated, rather than
       read once. Safari never fires it, which is why iOS is offered on the
       user agent instead. */
    const onInstallable = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onInstallable)
    return () => window.removeEventListener('beforeinstallprompt', onInstallable)
  }, [])

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(KEY) === '1'
    } catch {
      // Private window, blocked storage. Treat as not dismissed — the hint
      // is one line and reappearing is a smaller cost than never showing.
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true

    setSuggestion(
      suggestInstall({
        userAgent: window.navigator.userAgent,
        isStandalone: standalone,
        hasInstallEvent: installEvent !== null,
        dismissed,
      })
    )
  }, [installEvent])

  const dismiss = () => {
    setGone(true)
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      // Then it comes back next time. Still only one line.
    }
  }

  const install = async () => {
    if (!installEvent) return
    try {
      await installEvent.prompt()
      await installEvent.userChoice
    } catch {
      // Chrome refused or the client cancelled. Either way the hint goes:
      // asking twice is how a suggestion becomes nagging.
    }
    dismiss()
  }

  if (!suggestion || gone) return null

  return (
    <div className="rounded-card border border-brand-blue/25 bg-brand-blue/[0.06] px-card py-base mb-stack">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-white text-label font-display font-bold">{suggestion.title}</p>
          <p className="text-ink-3 text-caption font-body mt-1 leading-relaxed">{suggestion.body}</p>
          {suggestion.canPromptDirectly && (
            <button
              onClick={() => void install()}
              className="mt-base h-tap px-card rounded-control bg-brand-bluefill text-white text-caption font-display font-bold uppercase tracking-wide active:scale-95 transition-transform duration-150"
            >
              Add to home screen
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="w-tap h-tap -m-2 shrink-0 flex items-center justify-center text-ink-4 hover:text-white active:scale-95 transition-all duration-150"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
