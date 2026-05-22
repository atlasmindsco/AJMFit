'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type ChaedynChatProps = {
  portal: 'client' | 'admin'
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ChaedynChat({ portal }: ChaedynChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: portal === 'admin'
        ? "What's up Coach! Need help with ISSA references, program design, or a client question?"
        : "Hey! I'm Chaedyn — your AI fitness assistant. Ask me anything about training, nutrition, or exercises!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date() }])

    try {
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          portal: portal === 'admin' ? 'admin' : 'client',
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          for (const line of text.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  fullContent += parsed.content
                  setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent }
                    return updated
                  })
                }
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: "Sorry, I'm having trouble right now. Try again or message Coach Anthony directly." }
        return updated
      })
    }

    setIsStreaming(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isDark = portal === 'admin'

  return (
    <div className={`flex flex-col h-full rounded-xl border overflow-hidden ${
      isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-[#1B2D50]/[0.06]'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center gap-3 shrink-0 ${
        isDark ? 'border-white/[0.06]' : 'border-[#1B2D50]/[0.06]'
      }`}>
        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-[#1668E0]">
          <Image
            src="/chaedyn-avatar.png"
            alt="Chaedyn"
            width={80}
            height={80}
            className="w-[200%] h-[200%] object-cover object-[82%_15%]"
          />
        </div>
        <div className="flex-1">
          <h2 className={`font-display font-bold text-sm ${isDark ? 'text-white' : 'text-[#1B2D50]'}`}>
            Chaedyn
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className={`text-[10px] font-body ${isDark ? 'text-white/30' : 'text-[#64748B]'}`}>Online now</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 ${isDark ? 'bg-[#0d1820]' : 'bg-[#F5F6F8]'}`}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const showAvatar = !isUser && (i === 0 || messages[i - 1]?.role === 'user')

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                {!isUser && (
                  <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#1668E0] ${showAvatar ? 'visible' : 'invisible'}`}>
                    <Image
                      src="/chaedyn-avatar.png"
                      alt=""
                      width={56}
                      height={56}
                      className="w-[200%] h-[200%] object-cover object-[82%_15%]"
                    />
                  </div>
                )}

                {/* Bubble */}
                <div className="max-w-[75%]">
                  <div className={`px-3.5 py-2.5 text-[13px] font-body leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#1668E0] text-white rounded-2xl rounded-br-md'
                      : isDark
                        ? 'bg-white/[0.08] text-white/85 rounded-2xl rounded-bl-md'
                        : 'bg-white text-[#1B2D50] rounded-2xl rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  }`}>
                    {msg.content || (
                      <span className="flex items-center gap-1 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                  <p className={`text-[9px] font-body mt-0.5 px-1 ${
                    isUser ? 'text-right' : ''
                  } ${isDark ? 'text-white/15' : 'text-[#64748B]/40'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`px-3 py-2.5 border-t shrink-0 ${
        isDark ? 'border-white/[0.06]' : 'border-[#1B2D50]/[0.06]'
      }`}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Chaedyn..."
            disabled={isStreaming}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-body focus:outline-none transition-colors duration-200 ${
              isDark
                ? 'bg-white/[0.06] text-white/70 placeholder:text-white/20 focus:bg-white/[0.08]'
                : 'bg-[#F5F6F8] text-[#1B2D50] placeholder:text-[#64748B]/50 focus:bg-[#ECEEF2]'
            }`}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="w-9 h-9 rounded-full bg-[#1668E0] flex items-center justify-center hover:bg-[#0F52C9] active:scale-95 transition-all duration-200 disabled:opacity-30 shrink-0"
          >
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
