'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import ChaedynChat from '@/components/chat/ChaedynChat'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
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

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F08B1E] to-[#e07810] flex items-center justify-center">
                  <span className="text-white text-[10px] font-display font-bold">AJ</span>
                </div>
                <span className="text-white/70 text-sm font-body hidden sm:block">
                  Hi, Alex
                </span>
                <svg className="w-4 h-4 text-white/40 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

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

      {/* Floating Chaedyn Chat Widget */}
      {chatOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] h-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden">
          <ChaedynChat portal="client" />
        </div>
      )}

      {/* Chaedyn FAB */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#3B7DD8] flex items-center justify-center shadow-[0_4px_20px_rgba(59,125,216,0.4)] hover:shadow-[0_6px_30px_rgba(59,125,216,0.5)] active:scale-95 transition-all duration-200 overflow-hidden border-2 border-white/20"
        aria-label={chatOpen ? 'Close Chaedyn' : 'Chat with Chaedyn'}
      >
        {chatOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <Image
            src="/chaedyn-avatar.png"
            alt="Chat with Chaedyn"
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        )}
      </button>
    </div>
  )
}
