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

const navTabs = [
  { label: 'Dashboard', href: '/studio' },
  { label: 'Programs', href: '/studio/programs' },
  { label: 'Nutrition', href: '/studio/nutrition' },
  { label: 'Messages', href: '/studio/messages' },
  { label: 'Community', href: '/studio/community' },
]

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
    // the redirect — poll briefly so we don't flash the paywall at a paid member.
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
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center px-4">
        <div className="flex items-center gap-2.5 mb-8">
          <Image src="/AJMfit.png" alt="AJMFit" width={40} height={40} className="w-10 h-10 object-contain" />
          <span className="font-display font-bold text-white text-lg uppercase tracking-[0.15em]">AJM Fit</span>
        </div>
        <ResumeSession title="Sign in to your studio" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#111]">
      {/* Top Navbar */}
      <nav className="bg-[#111111] border-b border-white/[0.06] sticky top-0 z-50">
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
              <button className="relative text-white/40 hover:text-white/70 transition-colors duration-200 hidden sm:block">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </button>

              {/* Client identity */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F76B16] to-[#D8590C] flex items-center justify-center shrink-0">
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

              {/* Mobile hamburger */}
              <button
                className="md:hidden text-white/60 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-2">
            {navTabs.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-body font-medium mb-1 ${
                    isActive
                      ? 'bg-white/[0.10] text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <FeedbackButton />

      {/* Floating Chaedyn Chat Widget */}
      {chatOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] h-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden">
          <ChaedynChat portal="client" />
        </div>
      )}

      {/* Chaedyn FAB */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1A7BFF] flex items-center justify-center shadow-[0_4px_20px_rgba(26,123,255,0.4)] hover:shadow-[0_6px_30px_rgba(26,123,255,0.5)] active:scale-95 transition-all duration-200 overflow-hidden border-2 border-white/20"
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
