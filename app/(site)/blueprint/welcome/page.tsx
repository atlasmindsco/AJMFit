import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Welcome to The Blueprint',
  robots: { index: false, follow: false },
}

/**
 * Landing page after a direct Blueprint checkout. The webhook has already
 * created their account and emailed the set-password link, so this page's
 * one job is pointing them at that email.
 */
export default function BlueprintWelcome() {
  return (
    <div className="pt-36 pb-24 min-h-[70vh]">
      <div className="max-w-xl mx-auto px-6 text-center">
        <div className="w-16 h-16 mx-auto mb-8 rounded-full bg-brand-blue/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">
          The Blueprint
        </span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl uppercase tracking-[-0.02em] mt-3 text-brand-navy">
          You&rsquo;re in
        </h1>
        <p className="mt-5 text-brand-slate font-body text-lg leading-relaxed">
          Payment confirmed. One step left:
        </p>

        <div className="mt-8 bg-brand-offwhite border-l-4 border-brand-orange rounded-sm p-6 text-left">
          <ol className="space-y-3 text-brand-navy font-body text-[15px] leading-relaxed">
            <li>
              <strong>1.</strong> Check your inbox for an AJM Fit email called{' '}
              <strong>&ldquo;set up your account&rdquo;</strong> and create your password. (Give it a
              minute, and check spam if it&rsquo;s not there.)
            </li>
            <li>
              <strong>2.</strong> Sign in, then <strong>pick your program</strong>: your goal, days per
              week, and gym or home. It&rsquo;s ready in seconds.
            </li>
            <li>
              <strong>3.</strong> Start training and logging. That&rsquo;s it.
            </li>
          </ol>
        </div>

        <div className="mt-8">
          <Link
            href="/members"
            className="inline-flex items-center justify-center px-8 py-4 bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm shadow-[0_4px_24px_rgba(247,107,22,0.3)] hover:bg-orange-600 transition-colors"
          >
            Go to sign in
          </Link>
        </div>
        <p className="mt-6 text-brand-slate/70 text-sm font-body">
          Didn&rsquo;t get the email after a few minutes? Reply to any AJM Fit email or write{' '}
          <a href="mailto:anthony@ajmfit.com" className="text-brand-blue">anthony@ajmfit.com</a> and
          we&rsquo;ll sort it out.
        </p>
      </div>
    </div>
  )
}
