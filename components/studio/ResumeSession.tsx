'use client'

import Link from 'next/link'

/**
 * Fallback "sign-in required" card. Real auth is enforced server-side in
 * middleware, so this is rarely seen — it's a graceful prompt for any client
 * render path that loads without a session. Sends the user to /members.
 */
export default function ResumeSession({ title = 'Sign in to continue' }: { title?: string }) {
  return (
    <div className="p-8 max-w-md mx-auto">
      <div className="bg-white rounded-xl border border-[#1B2D50]/[0.06] p-8 text-center">
        <h1 className="font-display font-extrabold text-2xl text-[#1B2D50] mb-2">{title}</h1>
        <p className="text-[#64748B] text-sm font-body mb-6">
          Please log in to access your studio.
        </p>
        <Link
          href="/members"
          className="inline-block w-full py-3 bg-[#1A7BFF] text-white text-sm font-display font-bold uppercase tracking-[0.12em] rounded-md hover:bg-[#0F5FE0] transition-colors duration-200"
        >
          Go to Login
        </Link>
        <p className="text-[#64748B] text-xs font-body mt-6">
          Don&rsquo;t have an account?{' '}
          <Link href="/apply" className="text-[#1A7BFF] underline">
            Apply for coaching
          </Link>
        </p>
      </div>
    </div>
  )
}
