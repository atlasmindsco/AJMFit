'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import ChaedynChat from '@/components/chat/ChaedynChat'
import ResumeSession from '@/components/studio/ResumeSession'
import MembershipPaywall from '@/components/studio/MembershipPaywall'
import FeedbackButton from '@/components/studio/FeedbackButton'
import { signOut } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'

/**
 * One list for both navigations. Desktop and the mobile tab bar previously had
 * separate arrays, which drifted immediately — the same four screens were
 * called Dashboard/Programs/Nutrition/Messages on desktop and
 * Home/Train/Food/Coach on a phone. Entries carrying an icon (`d`) also earn a
 * thumb-reachable slot on mobile; the rest live behind More.
 */
const navTabs = [
  { label: 'Home', href: '/studio', d: 'm2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75' },
  { label: 'Train', href: '/studio/programs', d: 'M6 12h12M6 9v6m12-6v6M3.75 10.5v3m16.5-3v3' },
  { label: 'Food', href: '/studio/nutrition', d: 'M6.75 3v8.25a2.25 2.25 0 0 0 4.5 0V3m-2.25 8.25V21M15.75 3c-1.243 1.5-1.5 3.75-1.5 5.25 0 1.243.757 2.25 1.5 2.25V21' },
  { label: 'Coach', href: '/studio/messages', d: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155' },
  { label: 'Schedule', href: '/studio/schedule' },
  { label: 'Community', href: '/studio/community' },
]

const icon = (d: string) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const primaryTabs = navTabs.filter((t): t is typeof t & { d: string } => Boolean(t.d))

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [clientName, setClientName] = useState('')
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
          .select('status,name,is_beta')
          .eq('auth_id', user.id)
          .maybeSingle<{ status: string; name: string | null; is_beta: boolean }>()
        if (cancelled) return
        if (!u) {
          setGate('out')
          return
        }
        if (u.name) setClientName(u.name)
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
          <Image src="/AJMfit.png" alt="AJMFit" width={40} height={40} className="w-10 h-10 object-contain" />
          <span className="font-display font-bold text-white text-lg uppercase tracking-[0.15em]">AJM Fit</span>
        </div>
        <ResumeSession title="Sign in to your studio" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Top Navbar */}
      <nav className="bg-surface-base border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              <Link href="/studio" className="flex items-center gap-2.5 shrink-0">
                <Image
                  src="/AJMfit.png"
                  alt="AJMFit"
                  width={36}
                  height={36}
                  className="w-9 h-9 object-contain"
                />
                <span className="font-display font-bold text-white text-sm uppercase tracking-[0.15em]">
                  AJM Fit
                </span>
              </Link>

              {/* Desktop nav tabs */}
              <div className="hidden md:flex items-center gap-1">
                {navTabs.map((tab) => {
                  const isActive = pathname === tab.href
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`px-4 py-2 rounded-lg text-sm font-body font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-white/[0.10] text-white'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                      }`}
                    >
                      {tab.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right: Avatar */}
            <div className="flex items-center gap-4">
              {/* Client identity */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-orangedark flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-display font-bold">
                    {initials || '·'}
                  </span>
                </div>
                {firstName && (
                  <span className="text-white/80 text-sm font-body hidden sm:block max-w-[140px] truncate">
                    {firstName}
                  </span>
                )}
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="text-white/40 hover:text-white/80 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
              </button>

            </div>
          </div>
        </div>
      </nav>

      {/* Page content. Extra bottom padding on mobile so the last card is not
          hidden behind the tab bar. */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>

      {/* Mobile tab bar. This app gets used between sets, one-handed — the six
          destinations were behind a hamburger at the top of the screen, which
          is two taps away and the hardest place to reach. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-base/95 backdrop-blur border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {primaryTabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-200 ${
                  isActive ? 'text-brand-blue' : 'text-white/40 active:text-white/70'
                }`}
              >
                {icon(tab.d)}
                <span className="text-[10px] font-display font-bold uppercase tracking-wide">{tab.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-200 ${
              mobileMenuOpen ? 'text-white' : 'text-white/40 active:text-white/70'
            }`}
          >
            {icon('M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z')}
            <span className="text-[10px] font-display font-bold uppercase tracking-wide">More</span>
          </button>
        </div>
      </nav>

      {/* "More" sheet — the destinations that do not earn a permanent slot. */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sits on top of the tab bar. The bar grows by the safe-area inset
              on phones with a home indicator, so the offset has to include it
              or this panel slides down over the buttons. */}
          <div className="md:hidden fixed bottom-[calc(68px+env(safe-area-inset-bottom))] left-0 right-0 z-50 bg-surface-raised border-t border-white/[0.08] px-4 py-3">
            {navTabs
              .filter((tab) => !primaryTabs.some((p) => p.href === tab.href))
              .map((tab) => {
                const isActive = pathname === tab.href
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-control text-sm font-body font-medium mb-1 ${
                      isActive ? 'bg-white/[0.10] text-white' : 'text-white/60'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
          </div>
        </>
      )}

      <FeedbackButton />

      {/* Floating Chaedyn Chat Widget */}
      {chatOpen && (
        <div className="fixed bottom-[calc(160px+env(safe-area-inset-bottom))] md:bottom-20 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-[380px] h-[460px] md:h-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-card overflow-hidden">
          <ChaedynChat portal="client" onNavigate={() => setChatOpen(false)} />
        </div>
      )}

      {/* Chaedyn FAB */}
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
    </div>
  )
}
