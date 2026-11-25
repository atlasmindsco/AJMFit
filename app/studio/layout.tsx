'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import CheaChat from '@/components/chat/CheaChat'
import ResumeSession from '@/components/studio/ResumeSession'
import MembershipPaywall from '@/components/studio/MembershipPaywall'
import FeedbackButton from '@/components/studio/FeedbackButton'
import ActiveWorkoutBar from '@/components/studio/ActiveWorkoutBar'
import { SessionChromeProvider, useSessionChrome } from '@/components/studio/SessionChrome'
import { NAV_TABS, PROFILE_LINKS, owns } from '@/lib/nav'
import { signedAvatarUrl } from '@/lib/avatar'
import { recordView } from '@/lib/screen-views'
import { signOut } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'

/* The nav table, who owns which route, and the profile menu all live in
   lib/nav.ts so they can be checked. See tools/verify-nav.ts. */


const icon = (d: string) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)
  const [clientName, setClientName] = useState('')
  /**
   * The client's own photo, read through a short-lived signed URL.
   *
   * Null until it loads and whenever it fails, which falls back to the
   * initials rather than to a broken-image icon.
   */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  /** Only for counting screen views. Nothing on screen reads it. */
  const [studioUserId, setStudioUserId] = useState<string | null>(null)
  /**
   * One row per screen a client opens.
   *
   * Five audits reasoned about what clients look at and the app recorded
   * nothing, so every claim about attention in them was inference. This is
   * the smallest thing that answers it: who, which path, when.
   *
   * Fire-and-forget, never awaited, failures dropped. Measurement must never
   * be able to slow down or break a session.
   */
  useEffect(() => {
    if (!studioUserId || !pathname) return
    void recordView(studioUserId, pathname)
  }, [studioUserId, pathname])
  // Auth is enforced in middleware; here we additionally gate on subscription
  // status: only an active (incl. trialing) member sees the studio. Others are
  // shown the paywall. 'out' is a graceful fallback if no session/record loads.
  const [gate, setGate] = useState<'checking' | 'out' | 'paywall' | 'in'>('checking')

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    // When returning from Stripe checkout, the webhook may land a moment after
    // the redirect, poll briefly so we don't flash the paywall at a paid member.
    const justSubscribed =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('subscribed')

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setGate('out')
        return
      }
      const attempts = justSubscribed ? 6 : 1
      for (let i = 0; i < attempts; i++) {
        const { data: u } = await supabase
          .from('users')
          .select('id,status,name,is_beta,avatar_path')
          .eq('auth_id', user.id)
          .maybeSingle<{ id: string; status: string; name: string | null; is_beta: boolean; avatar_path: string | null }>()
        if (cancelled) return
        if (!u) {
          setGate('out')
          return
        }
        if (u.name) setClientName(u.name)
        // The signed-in client's own id, kept only so navigation can be
        // counted. See the view recorder below.
        if (u.id) setStudioUserId(u.id)
        // Signed separately and not awaited: the nav should not wait on a
        // storage round trip to render, and the initials stand in until the
        // photo arrives.
        if (u.avatar_path) {
          void signedAvatarUrl(u.avatar_path).then((signed) => {
            if (!cancelled) setAvatarUrl(signed)
          })
        }
        // Active members and beta testers get full access; beta bypasses payment.
        if (u.status === 'active' || u.is_beta) {
          setGate('in')
          return
        }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500))
      }
      if (!cancelled) setGate('paywall')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/members')
    router.refresh()
  }

  const initials = clientName
    ? clientName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : ''
  const firstName = clientName ? clientName.trim().split(/\s+/)[0] : ''

  // Avoid flashing the portal before we know status
  if (gate === 'checking') {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  // Approved but not yet subscribed → paywall.
  if (gate === 'paywall') {
    return <MembershipPaywall />
  }

  // Fallback prompt (middleware should have redirected already)
  if (gate === 'out') {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-4">
        <div className="flex items-center gap-2.5 mb-8">
          <Image src="/AJMfit-mark.png" alt="AJMFit" width={137} height={120} priority className="h-10 w-auto" />
          <span className="font-display font-bold text-white text-lg uppercase tracking-[0.15em]">AJM Fit</span>
        </div>
        <ResumeSession title="Sign in to your studio" />
      </div>
    )
  }

  return (
    <SessionChromeProvider userId={studioUserId}>
    <div className="min-h-screen bg-surface-base">
      {/* Top Navbar */}
      <nav className="bg-surface-base border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              <Link href="/studio" className="flex items-center gap-2.5 shrink-0">
                <Image
                  src="/AJMfit-mark.png"
                  alt="AJMFit"
                  width={123}
                  height={108}
                  priority
                  className="h-9 w-auto"
                />
                <span className="font-display font-bold text-white text-label uppercase tracking-[0.15em]">
                  AJM Fit
                </span>
              </Link>

              {/* Desktop nav tabs */}
              <div className="hidden md:flex items-center gap-1">
                {NAV_TABS.map((tab) => {
                  const isActive = owns(tab, pathname)
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`px-4 py-2 rounded-control text-body font-body font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-white/[0.10] text-white'
                          : 'text-ink-3 hover:text-ink-2 hover:bg-white/[0.06]'
                      }`}
                    >
                      {tab.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right: your initials, and what lives under them.
                Progress and Settings used to be behind the More button on the
                tab bar, where nobody found them — zero weights were ever
                logged. A profile menu is where people already look for the
                things that are about them rather than about today. */}
            <div className="relative flex items-center">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label="Your account"
                className="flex items-center gap-2.5 rounded-full pl-0.5 pr-2 py-0.5 hover:bg-white/[0.06] transition-colors duration-200"
              >
                {/* 44px, not 32. A profile photo you have to lean in to
                    recognise is not worth uploading, and 44 is also the
                    smallest comfortable touch target on a phone. */}
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-brand-orange to-brand-orangedark flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <span className="text-white text-label font-display font-bold">
                      {initials || '·'}
                    </span>
                  )}
                </div>
                {firstName && (
                  <span className="text-ink text-body font-body hidden sm:block max-w-[140px] truncate">
                    {firstName}
                  </span>
                )}
                <svg className="w-4 h-4 text-ink-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-card bg-surface-raised border border-white/[0.12] shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-1.5"
                  >
                    {PROFILE_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        onClick={() => setProfileOpen(false)}
                        className={`block px-3.5 py-2.5 rounded-control text-body font-body transition-colors duration-150 ${
                          pathname === link.href
                            ? 'bg-white/[0.10] text-white'
                            : 'text-ink-2 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <div className="h-px bg-white/[0.08] my-1.5" />
                    <button
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false)
                        void handleSignOut()
                      }}
                      className="block w-full text-left px-3.5 py-2.5 rounded-control text-body font-body text-ink-3 hover:bg-white/[0.06] hover:text-white transition-colors duration-150"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page content. Extra bottom padding on mobile so the last card is not
          hidden behind the tab bar. */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>

      {/* Mobile tab bar. This app gets used between sets, one-handed, so the
          destinations sit under the thumb rather than behind a menu at the
          top of the screen. Three slots and no More button: wider targets
          still, and nothing left to wonder about. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-base/95 backdrop-blur border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3">
          {NAV_TABS.map((tab) => {
            const isActive = owns(tab, pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-200 ${
                  isActive ? 'text-brand-blue' : 'text-ink-3 active:text-ink-2'
                }`}
              >
                {icon(tab.d)}
                <span className="text-caption font-display font-bold uppercase tracking-wide">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <FloatingChrome />
    </div>
    </SessionChromeProvider>
  )
}

/**
 * What sits in the bottom corner, and what gets to take it over.
 *
 * Three things want that strip of screen and only one of them can have it:
 *
 *   The chat bubble and the feedback button float over every screen. Both
 *   are there for the app's benefit rather than the client's, and on the
 *   training screen they sit on top of the one display that has earned the
 *   whole of it — the exercise, the weight, the reps, and what was lifted
 *   last time. They step aside for it entirely.
 *
 *   The resume bar outranks both of them everywhere else. A client who has
 *   left a session open needs the way back more than they need a chat
 *   bubble, and stacking it above them would put a third fixed element into
 *   a corner that is already how this app got crowded.
 *
 * Its own component so it can read the session context; the layout above it
 * provides it.
 */
function FloatingChrome() {
  const [chatOpen, setChatOpen] = useState(false)
  const pathname = usePathname()
  const { sessionActive, active, refreshActive } = useSessionChrome()

  // Not merely hidden: an open chat window would otherwise stay on screen
  // over the session it was told to get out of the way of.
  if (sessionActive) return null

  /* A workout is open and they are looking at something else. The training
     screen sets sessionActive, so this never doubles up with the in-session
     bar that screen draws for itself.

     totalExercises is 0 here on purpose: the layout does not load the
     client's plan and must not start, for a bar. progressLine shows the day
     name alone rather than inventing a denominator, and the real count is on
     the training screen where the plan already is.

     Not on the training screen itself. That page rehydrates the session on
     mount and draws its own in-session bar, so the only thing this would add
     is a Resume button pointing at the page you are already on — and a flash
     of it during the moment between the bar loading and the rehydrate
     setting sessionActive. */
  if (active && !pathname?.startsWith('/studio/programs')) {
    return <ActiveWorkoutBar workout={active} totalExercises={0} onAbandoned={refreshActive} />
  }

  return (
    <>
      <FeedbackButton />

      {chatOpen && (
        <div className="fixed bottom-[calc(160px+env(safe-area-inset-bottom))] md:bottom-20 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-[380px] h-[460px] md:h-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-card overflow-hidden">
          <CheaChat portal="client" onNavigate={() => setChatOpen(false)} />
        </div>
      )}

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-brand-blue flex items-center justify-center shadow-[0_4px_20px_rgba(26,123,255,0.4)] hover:shadow-[0_6px_30px_rgba(26,123,255,0.5)] active:scale-95 transition-all duration-200 overflow-hidden border-2 border-white/20"
        aria-label={chatOpen ? 'Close Chea' : 'Chat with Chea'}
      >
        {chatOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <Image
            src="/chea-avatar.jpg"
            alt="Chat with Chea"
            width={300}
            height={300}
            className="absolute left-1/2 top-1/2 w-[230%] h-[230%] max-w-none object-cover -translate-x-[29%] -translate-y-[37%]"
          />
        )}
      </button>
    </>
  )
}
