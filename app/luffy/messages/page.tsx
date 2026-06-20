'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, useRef, useCallback } from 'react'
import ChaedynChat from '@/components/chat/ChaedynChat'
import { fadeInAdmin as fadeIn } from '@/lib/animations'
import {
  fetchAllThreads,
  fetchThread,
  sendMessage as dbSendMessage,
  markThreadRead,
  formatMsgTime,
  type ThreadSummary,
  type Message,
} from '@/lib/messages'

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export default function MessagesPage() {
  const [activeView, setActiveView] = useState<'clients' | 'chaedyn'>('clients')
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const loadThreads = useCallback(async () => {
    const t = await fetchAllThreads()
    setThreads(t)
    setSelected((cur) => cur ?? (t[0]?.userId ?? null))
  }, [])

  const loadThread = useCallback(async (userId: string) => {
    const msgs = await fetchThread(userId)
    setMessages(msgs)
    void markThreadRead(userId, true)
  }, [])

  useEffect(() => {
    let active = true
    loadThreads().finally(() => active && setLoading(false))
    const timer = setInterval(() => active && loadThreads(), 7000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [loadThreads])

  useEffect(() => {
    if (!selected) return
    let active = true
    loadThread(selected)
    const timer = setInterval(() => active && loadThread(selected), 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [selected, loadThread])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const active = threads.find((t) => t.userId === selected) ?? null
  const totalUnread = threads.reduce((s, t) => s + t.unread, 0)
  const visible = search
    ? threads.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : threads

  const send = async () => {
    const body = input.trim()
    if (!body || !selected || sending) return
    setSending(true)
    setInput('')
    try {
      await dbSendMessage(selected, body, true)
      await loadThread(selected)
      void loadThreads()
    } catch {
      setInput(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display font-extrabold text-3xl uppercase tracking-tight text-white">
          Messages
        </motion.h1>
        <p className="text-white/40 font-body text-sm mt-1">
          {totalUnread} unread &middot; {threads.length} clients
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveView('clients')} className={`px-5 py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${activeView === 'clients' ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'}`}>
          Client Messages
        </button>
        <button onClick={() => setActiveView('chaedyn')} className={`px-5 py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${activeView === 'chaedyn' ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'}`}>
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#F76B16] to-[#D8590C] flex items-center justify-center">
            <span className="text-white text-[6px] font-display font-bold">CH</span>
          </div>
          Chea AI
        </button>
      </div>

      {activeView === 'chaedyn' ? (
        <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="h-[600px]">
          <ChaedynChat portal="admin" />
        </motion.div>
      ) : (
        <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
            {/* Conversation list */}
            <div className="lg:col-span-4 border-r border-white/[0.06]">
              <div className="p-4 border-b border-white/[0.06]">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Search clients..." className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white/70 font-body placeholder:text-white/20 focus:outline-none focus:border-[#F76B16]/30" />
                </div>
              </div>
              <div className="overflow-y-auto max-h-[540px]">
                {loading ? (
                  <div className="p-6 flex justify-center"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>
                ) : visible.length === 0 ? (
                  <p className="p-6 text-white/30 text-sm font-body text-center">No clients yet.</p>
                ) : (
                  visible.map((t) => (
                    <button key={t.userId} onClick={() => setSelected(t.userId)} className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors duration-200 border-b border-white/[0.03] ${selected === t.userId ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                      <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                        <span className="text-white text-[10px] font-display font-bold">{initialsOf(t.name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-white text-sm font-body font-semibold truncate">{t.name}</p>
                          <span className="text-white/20 text-[10px] font-body shrink-0 ml-2">{t.lastAt ? formatMsgTime(t.lastAt) : ''}</span>
                        </div>
                        <p className="text-white/30 text-xs font-body truncate mt-0.5">{t.lastBody ?? 'No messages yet'}</p>
                      </div>
                      {t.unread > 0 && (
                        <div className="w-5 h-5 rounded-full bg-[#F76B16] flex items-center justify-center shrink-0">
                          <span className="text-white text-[10px] font-display font-bold">{t.unread}</span>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Thread */}
            <div className="lg:col-span-8 flex flex-col">
              {active ? (
                <>
                  <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center">
                      <span className="text-white text-[10px] font-display font-bold">{initialsOf(active.name)}</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-body font-semibold">{active.name}</p>
                      <p className="text-white/30 text-[10px] font-body">{active.email}</p>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[460px]">
                    {messages.length === 0 ? (
                      <p className="text-white/30 text-sm font-body text-center mt-8">No messages yet. Say hello.</p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.from_trainer ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${msg.from_trainer ? 'bg-[#1A7BFF] text-white rounded-br-md' : 'bg-white/[0.06] text-white/80 rounded-bl-md'}`}>
                            <p className="text-sm font-body leading-relaxed">{msg.body}</p>
                            <p className={`text-[10px] font-body mt-1 ${msg.from_trainer ? 'text-white/40' : 'text-white/20'}`}>{formatMsgTime(msg.created_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={endRef} />
                  </div>

                  <div className="px-6 py-4 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} type="text" placeholder="Type a message..." className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body placeholder:text-white/20 focus:outline-none focus:border-[#F76B16]/30" />
                      <button onClick={send} disabled={!input.trim() || sending} className="w-10 h-10 rounded-lg bg-[#F76B16] flex items-center justify-center hover:bg-[#D8590C] active:scale-95 transition-all duration-200 disabled:opacity-30">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-white/30 text-sm font-body">
                  {loading ? '' : 'Select a client to view the conversation.'}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
