import Link from 'next/link'
import type { Metadata } from 'next'
import { stripe } from '@/lib/stripe/server'
import ResendInviteButton from '@/components/blueprint/ResendInviteButton'

export const metadata: Metadata = {
  title: 'Welcome to The Blueprint',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Landing page after a direct Blueprint checkout. Verifies the session with
 * Stripe server-side, tells the buyer exactly which inbox their set-password
 * email went to, and offers a resend so a lost email never strands them.
 */
export default async function BlueprintWelcome({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const sessionId = searchParams.session_id
  let email: string | null = null
  let paid = false
  if (sessionId && /^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      paid = session.status === 'complete'
      email = session.customer_details?.email?.toLowerCase() ?? null
    } catch {
      // fall through to the generic copy
    }
  }

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
          {paid ? 'Payment confirmed. Your login is on its way:' : 'One step left:'}
        </p>

        <div className="mt-8 bg-brand-offwhite border-l-4 border-brand-orange rounded-sm p-6 text-left">
          <ol className="space-y-3 text-brand-navy font-body text-[15px] leading-relaxed">
            <li>
              <strong>1.</strong>{' '}
              {email ? (
                <>
                  We sent your <strong>&ldquo;set up your account&rdquo;</strong> email to{' '}
                  <strong>{email}</strong>. Open it and create your password. (Give it a minute, and
                  check spam if it&rsquo;s not there.)
                </>
              ) : (
                <>
                  Check your inbox for an AJM Fit email called{' '}
                  <strong>&ldquo;set up your account&rdquo;</strong> and create your password. (Give
                  it a minute, and check spam if it&rsquo;s not there.)
                </>
              )}
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

        <div className="mt-6 space-y-2">
          {sessionId && paid && <ResendInviteButton sessionId={sessionId} />}
          <p className="text-brand-slate/70 text-sm font-body">
            Still stuck? Write{' '}
            <a href="mailto:anthony@ajmfit.com" className="text-brand-blue">anthony@ajmfit.com</a> and
            we&rsquo;ll sort it out.
          </p>
        </div>
      </div>
    </div>
  )
}
