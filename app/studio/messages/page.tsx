'use client'

import { motion } from 'framer-motion'
import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { getCurrentUserId } from '@/lib/current-user'
import {
  fetchThread,
  sendMessage as dbSendMessage,
  markThreadRead,
  formatMsgTime,
  type Message,
} from '@/lib/messages'

export default function ClientMessagesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-xl border border-[#1B2D50]/[0.06] overflow-hidden"
      style={{ height: 'calc(100vh - 130px)' }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1B2D50]/[0.06] flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-[#1B2D50]">
            <Image src="/AJMfit.png" alt="Coach Anthony" width={40} height={40} className="w-full h-full object-contain p-1" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-sm text-[#1B2D50]">Coach Anthony</h2>
            <span className="text-[10px] font-body text-[#64748B]">Usually replies within a day</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F5F6F8]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#1B2D50]/10 border-t-[#1B2D50]/40 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <p className="text-[#1B2D50] font-display font-bold text-sm">Say hi to Coach Anthony</p>
              <p className="text-[#64748B] text-xs font-body mt-1">Questions about your program, form, or nutrition? Send a message.</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isClient = !msg.from_trainer
              const showAvatar = !isClient && (i === 0 || !messages[i - 1]?.from_trainer)
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isClient && (
                    <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#1B2D50] ${showAvatar ? 'visible' : 'invisible'}`}>
                      <Image src="/AJMfit.png" alt="" width={28} height={28} className="w-full h-full object-contain p-0.5" />
                    </div>
                  )}
                  <div className="max-w-[75%]">
                    <div className={`px-3.5 py-2.5 text-[13px] font-body leading-relaxed ${
                      isClient
                        ? 'bg-[#1A7BFF] text-white rounded-2xl rounded-br-md'
                        : 'bg-white text-[#1B2D50] rounded-2xl rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}>
                      {msg.body}
                    </div>
                    <p className={`text-[9px] font-body mt-0.5 px-1 text-[#64748B]/40 ${isClient ? 'text-right' : ''}`}>
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
        <div className="px-3 py-2.5 border-t border-[#1B2D50]/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Coach Anthony..."
              disabled={!userId}
              className="flex-1 rounded-full px-4 py-2 text-sm font-body bg-[#F5F6F8] text-[#1B2D50] placeholder:text-[#64748B]/50 focus:outline-none focus:bg-[#ECEEF2] disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-full bg-[#1A7BFF] flex items-center justify-center hover:bg-[#0F5FE0] active:scale-95 transition-all duration-200 disabled:opacity-30 shrink-0"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
