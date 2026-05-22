import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AJM FIT — Pricing Research Brief',
  description: 'Online fitness coaching pricing benchmark report for AJM FIT (2025-2026).',
  robots: 'noindex, nofollow',
}

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
