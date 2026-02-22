'use client'

import Link from 'next/link'
import Image from 'next/image'

const footerLinks = [
  { label: 'Programs', href: '/work-with-me' },
  { label: 'About', href: '/about' },
  { label: 'Newsletter', href: '/newsletter' },
  { label: 'Apply', href: '/apply' },
]

export default function Footer() {
  return (
    <footer className="border-t border-brand-navy/10 bg-brand-navy">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link href="/">
              <Image
                src="/AJMfit.png"
                alt="AJMFit"
                width={56}
                height={56}
                className="w-12 h-12 object-contain"
              />
            </Link>
            <p className="text-white/50 text-sm font-body leading-relaxed max-w-xs">
              Personal training built on accountability, stewardship, and real results.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            <span className="font-display font-bold text-xs uppercase tracking-[0.2em] text-brand-orange mb-2">
              Navigate
            </span>
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/60 hover:text-white text-sm font-body transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Scripture */}
          <div className="flex flex-col gap-3">
            <span className="font-display font-bold text-xs uppercase tracking-[0.2em] text-brand-orange mb-2">
              The Standard
            </span>
            <p className="text-white/60 text-sm font-body leading-relaxed italic">
              &ldquo;To whom much is given, much is required.&rdquo;
            </p>
            <p className="text-white/40 text-xs font-body">— Luke 12:48</p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs font-body">
            © {new Date().getFullYear()} AJMFit. All rights reserved.
          </p>
          <p className="text-white/30 text-xs font-body">
            ISSA Certified Personal Trainer
          </p>
        </div>
      </div>
    </footer>
  )
}
