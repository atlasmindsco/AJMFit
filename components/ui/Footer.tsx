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
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 items-start">
          {/* Brand */}
          <div className="flex flex-col gap-5">
            <Link href="/">
              <Image
                src="/AJMfit.png"
                alt="AJMFit"
                width={72}
                height={72}
                className="w-16 h-16 object-contain"
              />
            </Link>
            <p className="text-white/50 text-base font-body leading-relaxed max-w-xs">
              Personal training built on accountability, stewardship, and real results.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-4">
            <span className="font-display font-bold text-sm uppercase tracking-[0.2em] text-brand-orange mb-2">
              Navigate
            </span>
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/60 hover:text-white text-base font-body transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-4">
            <span className="font-display font-bold text-sm uppercase tracking-[0.2em] text-brand-orange mb-2">
              Connect
            </span>
            <a
              href="mailto:anthony@ajmfit.com"
              className="text-white/60 hover:text-white text-base font-body transition-colors duration-200 flex items-center gap-2.5"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              anthony@ajmfit.com
            </a>
            <a
              href="https://www.instagram.com/anthony.j.martin?igsh=cm1qZXdsMW4wb212&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white text-base font-body transition-colors duration-200 flex items-center gap-2.5"
            >
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
              </svg>
              @anthony.j.martin
            </a>
          </div>

          {/* Scripture */}
          <div className="flex flex-col gap-4 md:text-right">
            <span className="font-display font-bold text-sm uppercase tracking-[0.2em] text-brand-orange mb-2">
              The Standard
            </span>
            <p className="text-white/60 text-base font-body leading-relaxed italic">
              &ldquo;To whom much is given, much is required.&rdquo;
            </p>
            <p className="text-white/40 text-sm font-body">— Luke 12:48</p>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm font-body">
            © {new Date().getFullYear()} AJMFit. All rights reserved.
          </p>
          <p className="text-white/30 text-sm font-body">
            ISSA Certified Personal Trainer
          </p>
        </div>
      </div>
    </footer>
  )
}
