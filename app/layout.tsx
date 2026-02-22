import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import CustomCursor from '@/components/ui/CustomCursor'

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
  title: 'AJMFit — Personal Training That Counts',
  description:
    "You're already showing up. Let's make it count. Custom training programs, accountability coaching, and real results with AJMFit.",
  keywords: ['personal training', 'online coaching', 'fitness', 'AJMFit', 'home workouts', 'ISSA certified'],
  openGraph: {
    title: 'AJMFit — Personal Training That Counts',
    description: "You're already showing up. Let's make it count.",
    url: 'https://ajmfit.com',
    siteName: 'AJMFit',
    type: 'website',
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
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
