import Link from 'next/link'
import type { Metadata } from 'next'
import { stripe } from '@/lib/stripe/server'
import ResendInviteButton from '@/components/blueprint/ResendInviteButton'
import ClaimAccount from '@/components/blueprint/ClaimAccount'

export const metadata: Metadata = {
  title: 'Welcome to The Blueprint',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Landing page after a direct Blueprint checkout.
 *
 * This page used to say "check your inbox". That cost real customers: of the
 * first thirteen Blueprint buyers, one never opened the account at all and is
 * still paying for it, and three more took between one and twenty-one days to
 * get in because the step depended on finding an email.
 *
 * So the password is set here instead, on the page they are already looking
 * at, and they land in the app signed in. The emailed invite still goes out
 * from the webhook and still works — it is the fallback for anyone who closes
 * this tab, not the main route any more.
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

  // Only a verified, paid session may set a password here. Everything else
  // falls back to the email route, which is slower but needs no proof.
  const canClaim = Boolean(sessionId && paid)

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

        {canClaim ? (
          <>
            <p className="mt-5 text-brand-slate font-body text-lg leading-relaxed">
              Payment confirmed. One last thing and you&rsquo;re training.
            </p>

            <div className="mt-8 bg-white border border-brand-navy/[0.08] shadow-[0_4px_40px_rgba(27,45,80,0.06)] rounded-control p-6 md:p-8">
              <ClaimAccount sessionId={sessionId!} email={email} />
            </div>

            {/* Deliberately not "we sent you an email": when the password is
                set here before the webhook runs, the webhook sees a linked
                account and skips the invite, so no email ever goes out. The
                resend button below is the honest offer. */}
            <p className="mt-6 text-brand-slate/70 text-sm font-body">
              Rather use email? You can have a sign-in link sent to{' '}
              {email ? <strong>{email}</strong> : 'your inbox'} instead.
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 text-brand-slate font-body text-lg leading-relaxed">One step left:</p>

            <div className="mt-8 bg-brand-offwhite border-l-4 border-brand-orange rounded-control p-6 text-left">
              <ol className="space-y-3 text-brand-navy font-body text-[15px] leading-relaxed">
                <li>
                  <strong>1.</strong>{' '}
                  {email ? (
                    <>
                      We sent your <strong>&ldquo;set up your account&rdquo;</strong> email to{' '}
                      <strong>{email}</strong>. Open it and create your password. (Give it a minute,
                      and check spam if it&rsquo;s not there.)
                    </>
                  ) : (
                    <>
                      Check your inbox for an AJM Fit email called{' '}
                      <strong>&ldquo;set up your account&rdquo;</strong> and create your password.
                      (Give it a minute, and check spam if it&rsquo;s not there.)
                    </>
                  )}
                </li>
                <li>
                  <strong>2.</strong> Sign in, then <strong>pick your program</strong>: your goal,
                  days per week, and gym or home. It&rsquo;s ready in seconds.
                </li>
                <li>
                  <strong>3.</strong> Start training and logging. That&rsquo;s it.
                </li>
              </ol>
            </div>

            <div className="mt-8">
              <Link
                href="/members"
                className="inline-flex items-center justify-center px-8 py-4 bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-control shadow-[0_4px_24px_rgba(247,107,22,0.3)] hover:bg-orange-600 transition-colors"
              >
                Go to sign in
              </Link>
            </div>
          </>
        )}

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
