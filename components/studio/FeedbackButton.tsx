'use client'

import { useState } from 'react'
import { getCurrentUserId } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'
import { submitFeedback } from '@/lib/feedback'

/** Floating beta-feedback widget for the studio. */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const userId = await getCurrentUserId()
      let name = ''
      if (userId) {
        const supabase = createClient()
        const { data } = await supabase.from('users').select('name').eq('id', userId).maybeSingle<{ name: string }>()
        name = data?.name ?? ''
      }
      await submitFeedback({
        userId,
        name,
        page: typeof window !== 'undefined' ? window.location.pathname : '',
        message: message.trim(),
      })
      setDone(true)
      setMessage('')
      setTimeout(() => { setDone(false); setOpen(false) }, 1600)
    } catch (e) {
      console.error('[feedback] failed', e)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Send feedback"
        className="fixed bottom-6 left-6 z-50 px-4 h-11 rounded-full bg-white/[0.08] backdrop-blur border border-white/[0.12] text-white/80 text-xs font-display font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-white/[0.14] transition-colors duration-200"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        Feedback
      </button>

      {open && (
        <div className="fixed bottom-20 left-6 z-50 w-[320px] rounded-xl border border-white/[0.12] bg-[#1A1A1A] shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-4">
          {done ? (
            <p className="text-emerald-400 text-sm font-body py-6 text-center">Thanks! Feedback sent. 🙌</p>
          ) : (
            <>
              <p className="text-white font-display font-bold text-sm">Beta feedback</p>
              <p className="text-white/40 text-xs font-body mt-0.5 mb-3">Found a bug or have a suggestion? Tell us.</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="What's on your mind?"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-body resize-none focus:outline-none focus:border-[#F76B16]/40"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-white/40 text-xs font-body hover:text-white/70">Cancel</button>
                <button onClick={send} disabled={sending || !message.trim()} className="px-4 py-1.5 bg-[#F76B16] text-white text-xs font-display font-bold uppercase rounded-lg disabled:opacity-40">{sending ? 'Sending…' : 'Send'}</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
