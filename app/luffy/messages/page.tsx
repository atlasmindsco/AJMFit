'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import ChaedynChat from '@/components/chat/ChaedynChat'

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
}

type Conversation = {
  name: string
  initials: string
  tier: string
  lastMessage: string
  time: string
  unread: number
  online: boolean
  messages: { from: 'coach' | 'client'; text: string; time: string }[]
}

const conversations: Conversation[] = [
  {
    name: 'Marcus Johnson',
    initials: 'MJ',
    tier: 'The Full Experience',
    lastMessage: 'Just finished the bench session, felt great!',
    time: '2 min ago',
    unread: 2,
    online: true,
    messages: [
      { from: 'coach', text: 'How did the bench session go today?', time: '4:45 PM' },
      { from: 'client', text: 'Just finished the bench session, felt great!', time: '5:32 PM' },
      { from: 'client', text: 'Hit 185 for 8 clean reps. Ready for 190 next week.', time: '5:33 PM' },
    ],
  },
  {
    name: 'Sarah Kim',
    initials: 'SK',
    tier: 'The Accelerator',
    lastMessage: 'Can we move tomorrow\'s session to 10 AM?',
    time: '1 hour ago',
    unread: 1,
    online: true,
    messages: [
      { from: 'client', text: 'Hey coach! Can we move tomorrow\'s session to 10 AM?', time: '3:15 PM' },
      { from: 'client', text: 'I have a dentist appointment at 8:30.', time: '3:15 PM' },
    ],
  },
  {
    name: 'Tanya Bell',
    initials: 'TB',
    tier: 'The Accelerator',
    lastMessage: 'Thanks for the updated meal plan!',
    time: '3 hours ago',
    unread: 0,
    online: false,
    messages: [
      { from: 'coach', text: 'Updated your meal plan for Phase 2. Check the nutrition tab.', time: '11:00 AM' },
      { from: 'client', text: 'Thanks for the updated meal plan!', time: '12:30 PM' },
      { from: 'coach', text: 'You got it! Let me know if the calories feel right after a few days.', time: '12:45 PM' },
    ],
  },
  {
    name: 'David Reeves',
    initials: 'DR',
    tier: 'The Blueprint',
    lastMessage: 'Uploaded the form check video',
    time: '5 hours ago',
    unread: 1,
    online: false,
    messages: [
      { from: 'client', text: 'Uploaded the form check video for squats. Let me know what you think.', time: '10:00 AM' },
    ],
  },
  {
    name: 'Jasmine Torres',
    initials: 'JT',
    tier: 'The Full Experience',
    lastMessage: 'See you at 6 AM tomorrow!',
    time: '6 hours ago',
    unread: 0,
    online: false,
    messages: [
      { from: 'coach', text: 'Great work today. Tomorrow we\'re hitting plyometrics — bring your A-game.', time: '8:00 AM' },
      { from: 'client', text: 'See you at 6 AM tomorrow!', time: '9:15 AM' },
    ],
  },
  {
    name: 'Chris Okafor',
    initials: 'CO',
    tier: 'The Full Experience',
    lastMessage: 'I think I\'m ready to come back next week',
    time: '2 days ago',
    unread: 0,
    online: false,
    messages: [
      { from: 'coach', text: 'Hey Chris, just checking in. How are you feeling? Ready to get back at it?', time: 'Mar 24' },
      { from: 'client', text: 'I think I\'m ready to come back next week. Work stress has calmed down.', time: 'Mar 25' },
      { from: 'coach', text: 'Great to hear. I\'ll have a modified program ready for you. Let\'s ease back in.', time: 'Mar 25' },
    ],
  },
]

export default function MessagesPage() {
  const [selectedConvo, setSelectedConvo] = useState(0)
  const [messageInput, setMessageInput] = useState('')
  const [activeView, setActiveView] = useState<'clients' | 'chaedyn'>('clients')
  const active = conversations[selectedConvo]
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display font-extrabold text-3xl uppercase tracking-tight text-white"
        >
          Messages
        </motion.h1>
        <p className="text-white/40 font-body text-sm mt-1">
          {totalUnread} unread &middot; {conversations.length} conversations
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveView('clients')}
          className={`px-5 py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 ${
            activeView === 'clients' ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
          }`}
        >
          Client Messages
        </button>
        <button
          onClick={() => setActiveView('chaedyn')}
          className={`px-5 py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
            activeView === 'chaedyn' ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
          }`}
        >
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
          {/* Conversation List */}
          <div className="lg:col-span-4 border-r border-white/[0.06]">
            <div className="p-4 border-b border-white/[0.06]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white/70 font-body placeholder:text-white/20 focus:outline-none focus:border-[#F76B16]/30"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[540px]">
              {conversations.map((convo, i) => (
                <button
                  key={convo.name}
                  onClick={() => setSelectedConvo(i)}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors duration-200 border-b border-white/[0.03] ${
                    selectedConvo === i ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      convo.tier.includes('Full')
                        ? 'bg-gradient-to-br from-[#F76B16] to-[#D8590C]'
                        : convo.tier.includes('Accelerator')
                        ? 'bg-[#1A7BFF]'
                        : 'bg-white/[0.08]'
                    }`}>
                      <span className="text-white text-[10px] font-display font-bold">{convo.initials}</span>
                    </div>
                    {convo.online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111D27]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm font-body font-semibold truncate">{convo.name}</p>
                      <span className="text-white/20 text-[10px] font-body shrink-0 ml-2">{convo.time}</span>
                    </div>
                    <p className="text-white/30 text-xs font-body truncate mt-0.5">{convo.lastMessage}</p>
                  </div>
                  {convo.unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-[#F76B16] flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-display font-bold">{convo.unread}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Message Thread */}
          <div className="lg:col-span-8 flex flex-col">
            {/* Thread Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                active.tier.includes('Full')
                  ? 'bg-gradient-to-br from-[#F76B16] to-[#D8590C]'
                  : active.tier.includes('Accelerator')
                  ? 'bg-[#1A7BFF]'
                  : 'bg-white/[0.08]'
              }`}>
                <span className="text-white text-[10px] font-display font-bold">{active.initials}</span>
              </div>
              <div>
                <p className="text-white text-sm font-body font-semibold">{active.name}</p>
                <p className="text-white/30 text-[10px] font-body">
                  {active.tier} &middot; {active.online ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {active.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.from === 'coach' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                    msg.from === 'coach'
                      ? 'bg-[#1A7BFF] text-white rounded-br-md'
                      : 'bg-white/[0.06] text-white/80 rounded-bl-md'
                  }`}>
                    <p className="text-sm font-body leading-relaxed">{msg.text}</p>
                    <p className={`text-[10px] font-body mt-1 ${
                      msg.from === 'coach' ? 'text-white/40' : 'text-white/20'
                    }`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white/70 font-body placeholder:text-white/20 focus:outline-none focus:border-[#F76B16]/30"
                />
                <button className="w-10 h-10 rounded-lg bg-[#F76B16] flex items-center justify-center hover:bg-[#D8590C] active:scale-95 transition-all duration-200">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      )}
    </div>
  )
}
