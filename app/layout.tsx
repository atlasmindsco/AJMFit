import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import CustomCursor from '@/components/ui/CustomCursor'
import AuthErrorCatcher from '@/components/auth/AuthErrorCatcher'
import './globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://ajmfit.com'),
  title: {
    default: 'AJM Fit, Personal Training That Counts',
    template: '%s | AJM Fit',
  },
  description:
    "You're already showing up. Let's make it count. Custom training programs, accountability coaching, and real results with AJM Fit.",
  keywords: ['personal training', 'online coaching', 'fitness', 'AJM Fit', 'home workouts', 'ISSA certified'],
  alternates: { canonical: '/' },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'AJM Fit, Personal Training That Counts',
    description: "You're already showing up. Let's make it count.",
    url: 'https://ajmfit.com',
    siteName: 'AJM Fit',
    type: 'website',
    images: [{ url: '/BandGnewsletter.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AJM Fit, Personal Training That Counts',
    description: "You're already showing up. Let's make it count.",
    images: ['/BandGnewsletter.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="bg-brand-white text-brand-navy font-body">
        <CustomCursor />
        <AuthErrorCatcher />
        {children}
      </body>
    </html>
  )
}
