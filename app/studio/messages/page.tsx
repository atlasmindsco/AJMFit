'use client'

import { motion } from 'framer-motion'
import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getCurrentUserId } from '@/lib/current-user'
import {
  fetchThread,
  sendMessage as dbSendMessage,
  markThreadRead,
  formatMsgTime,
  type Message,
} from '@/lib/messages'
import { fetchCheckInForWeek, weekOf } from '@/lib/check-ins'

export default function ClientMessagesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  /**
   * Whether this week's update is already in.
   *
   * The two cards above the thread were identical whether a client had sent
   * their check-in on Monday or had not sent one in a month. One of them is
   * something to do and the other is a place to go, and the screen said
   * nothing about which was which.
   *
   * Starts true so nothing is flagged as outstanding before we know. An
   * empty highlight that corrects itself a moment later is worse than a
   * highlight that arrives late.
   */
  const [checkInDone, setCheckInDone] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (id: string) => {
    const msgs = await fetchThread(id)
    setMessages(msgs)
    void markThreadRead(id, false)
  }, [])

  // initial load + poll
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null
    getCurrentUserId().then((id) => {
      if (!active || !id) {
        setLoading(false)
        return
      }
      setUserId(id)
      void fetchCheckInForWeek(id, weekOf())
        .then((row) => active && setCheckInDone(!!row))
        .catch(() => {})
      load(id).finally(() => active && setLoading(false))
      timer = setInterval(() => active && load(id), 5000)
    })
    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [load])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const body = input.trim()
    if (!body || !userId || sending) return
    setSending(true)
    setInput('')
    // optimistic
    const optimistic: Message = {
      id: 'tmp-' + body, user_id: userId, from_trainer: false, body, read_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      await dbSendMessage(userId, body, false)
      fetch('/api/studio/message-notify', { method: 'POST' }).catch(() => {})
      await load(userId)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(body)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
    {/* The rest of the coaching relationship.
        The weekly check-in and booking a call used to be two separate
        destinations behind a More button, which made one relationship feel
        like three small features — and neither was ever used. They belong
        with the person they are about. */}
    <div className="flex gap-2 mb-3">
      {/* Outstanding, or done. Highlighted only while there is something
          to do — a card that looks urgent every week of the year stops
          looking like anything at all. */}
      <Link
        href="/studio/check-in"
        className={`flex-1 px-4 py-3 rounded-card border text-center transition-colors duration-200 ${
          checkInDone
            ? 'bg-surface-raised border-white/[0.10] hover:border-white/[0.18]'
            : 'bg-brand-orange/[0.10] border-brand-orange/30 hover:bg-brand-orange/[0.16]'
        }`}
      >
        <span className="block font-display font-bold text-white text-label">Weekly update</span>
        <span
          className={`block text-caption font-body mt-0.5 ${
            checkInDone ? 'text-ink-3' : 'text-brand-orange'
          }`}
        >
          {checkInDone ? 'Sent this week' : 'Three taps'}
        </span>
      </Link>
      <Link
        href="/studio/schedule"
        className="flex-1 px-4 py-3 rounded-card bg-surface-raised border border-white/[0.10] text-center hover:border-white/[0.18] transition-colors duration-200"
      >
        <span className="block font-display font-bold text-white text-label">Schedule</span>
        <span className="block text-ink-3 text-caption font-body mt-0.5">Calls and training days</span>
      </Link>
    </div>

    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-card border border-brand-navy/[0.06] overflow-hidden"
      style={{ height: 'calc(100vh - 210px)' }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-brand-navy/[0.06] flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-brand-navy">
            <Image src="/AJMfit.png" alt="Coach Anthony" width={40} height={40} className="w-full h-full object-contain p-1" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-heading text-brand-navy">Coach Anthony</h2>
            <span className="text-caption font-body text-brand-slate">Usually replies within a day</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F5F6F8]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-navy/10 border-t-brand-navy/40 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <p className="text-brand-navy font-display font-bold text-label">Say hi to Coach Anthony</p>
              <p className="text-brand-slate text-label font-body mt-1">Questions about your program, form, or nutrition? Send a message.</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isClient = !msg.from_trainer
              const showAvatar = !isClient && (i === 0 || !messages[i - 1]?.from_trainer)
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isClient && (
                    <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 bg-brand-navy ${showAvatar ? 'visible' : 'invisible'}`}>
                      <Image src="/AJMfit.png" alt="" width={28} height={28} className="w-full h-full object-contain p-0.5" />
                    </div>
                  )}
                  <div className="max-w-[75%]">
                    <div className={`px-3.5 py-2.5 text-caption font-body leading-relaxed ${
                      isClient
                        ? 'bg-brand-bluefill text-white rounded-card rounded-br-md'
                        : 'bg-white text-brand-navy rounded-card rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}>
                      {msg.body}
                    </div>
                    <p className={`text-badge font-body mt-0.5 px-1 text-brand-slate/40 ${isClient ? 'text-right' : ''}`}>
                      {formatMsgTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-2.5 border-t border-brand-navy/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Coach Anthony..."
              disabled={!userId}
              className="flex-1 rounded-full px-4 py-2 text-body font-body bg-[#F5F6F8] text-brand-navy placeholder:text-brand-slate/50 focus:outline-none focus:bg-[#ECEEF2] disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="w-9 h-9 rounded-full bg-brand-blue flex items-center justify-center hover:bg-brand-bluedark active:scale-95 transition-all duration-200 disabled:opacity-30 shrink-0"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
    </>
  )
}
