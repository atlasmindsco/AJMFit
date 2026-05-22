'use client'

import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

type Message = {
  from: 'client' | 'coach'
  text: string
  time: string
}

function getTimeNow() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const initialMessages: Message[] = [
  { from: 'coach', text: 'Hey! Welcome to AJM Fit. Phase 1 program is ready. How are you feeling?', time: 'Mar 20, 10:00 AM' },
  { from: 'client', text: 'Feeling great! Should I take creatine before or after workouts?', time: 'Mar 20, 11:30 AM' },
  { from: 'coach', text: 'Timing doesn\'t matter — just 5g daily. Morning with breakfast works.', time: 'Mar 20, 12:15 PM' },
  { from: 'client', text: 'Got it, thanks coach!', time: 'Mar 20, 12:20 PM' },
  { from: 'coach', text: 'How did upper body go? Any soreness?', time: 'Mar 22, 5:30 PM' },
  { from: 'client', text: 'Bench felt solid. Shoulders tight on OHP though.', time: 'Mar 22, 6:00 PM' },
  { from: 'coach', text: 'Do 2 min of band pull-aparts before pressing. Should fix it.', time: 'Mar 22, 6:15 PM' },
]

export default function ClientMessagesPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim()) return

    const newMsg: Message = {
      from: 'client',
      text: input.trim(),
      time: getTimeNow(),
    }
    setMessages(prev => [...prev, newMsg])
    setInput('')

    // Simulate coach typing + auto-reply
    setTimeout(() => {
      const replies = [
        'Got it! I\'ll check on that and get back to you.',
        'Good question — let me look into that for you.',
        'Noted! We\'ll cover that in your next check-in.',
        'Nice work! Keep it up and stay consistent.',
      ]
      const reply: Message = {
        from: 'coach',
        text: replies[Math.floor(Math.random() * replies.length)],
        time: getTimeNow(),
      }
      setMessages(prev => [...prev, reply])
    }, 1500)

    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
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
            <Image
              src="/AJMfit.png"
              alt="Coach Anthony"
              width={40}
              height={40}
              className="w-full h-full object-contain p-1"
            />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-sm text-[#1B2D50]">Coach Anthony</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-body text-[#64748B]">Online now</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F5F6F8]">
          {messages.map((msg, i) => {
            const isClient = msg.from === 'client'
            const showAvatar = !isClient && (i === 0 || messages[i - 1]?.from === 'client')

            return (
              <div
                key={i}
                className={`flex items-end gap-2 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Coach avatar */}
                {!isClient && (
                  <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#1B2D50] ${showAvatar ? 'visible' : 'invisible'}`}>
                    <Image src="/AJMfit.png" alt="" width={28} height={28} className="w-full h-full object-contain p-0.5" />
                  </div>
                )}

                <div className="max-w-[75%]">
                  <div className={`px-3.5 py-2.5 text-[13px] font-body leading-relaxed ${
                    isClient
                      ? 'bg-[#1668E0] text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-[#1B2D50] rounded-2xl rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  }`}>
                    {msg.text}
                  </div>
                  <p className={`text-[9px] font-body mt-0.5 px-1 text-[#64748B]/40 ${isClient ? 'text-right' : ''}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            )
          })}
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
              className="flex-1 rounded-full px-4 py-2 text-sm font-body bg-[#F5F6F8] text-[#1B2D50] placeholder:text-[#64748B]/50 focus:outline-none focus:bg-[#ECEEF2]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-full bg-[#1668E0] flex items-center justify-center hover:bg-[#0F52C9] active:scale-95 transition-all duration-200 disabled:opacity-30 shrink-0"
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
