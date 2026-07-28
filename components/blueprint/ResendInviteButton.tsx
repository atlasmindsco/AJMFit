'use client'

import { useState } from 'react'

/** "Resend my setup email" on the Blueprint welcome page. */
export default function ResendInviteButton({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const resend = async () => {
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/blueprint/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="text-brand-navy font-body text-sm font-semibold">
        Sent. Give it a minute and check spam too.
      </p>
    )
  }
  return (
    <div>
      <button
        onClick={resend}
        disabled={state === 'sending'}
        className="font-body text-sm text-brand-blue underline underline-offset-4 hover:text-brand-navy transition-colors disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Resend my setup email'}
      </button>
      {state === 'error' && (
        <p className="mt-2 text-red-500 text-sm font-body">Could not send. Try again in a minute.</p>
      )}
    </div>
  )
}
