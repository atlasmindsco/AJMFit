'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

/* ── Animation ── */
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

/* ── Forum Categories ── */
const categories = [
  { name: 'All', count: 24 },
  { name: 'Training', count: 8 },
  { name: 'Nutrition', count: 6 },
  { name: 'Motivation', count: 5 },
  { name: 'Form Checks', count: 3 },
  { name: 'Wins', count: 2 },
]

/* ── Forum Posts ── */
const forumPosts = [
  {
    id: 1,
    title: 'Tips for Meal Prepping on a Budget',
    author: 'Sarah W.',
    avatar: 'SW',
    category: 'Nutrition',
    time: '15 min ago',
    replies: 12,
    likes: 8,
    pinned: true,
    preview: 'I\'ve been batch cooking on Sundays and it\'s been a game changer. Here\'s what I do...',
  },
  {
    id: 2,
    title: 'Motivation Monday — Share Your Wins!',
    author: 'Anthony M.',
    avatar: 'AM',
    category: 'Motivation',
    time: '1 hour ago',
    replies: 18,
    likes: 24,
    pinned: true,
    preview: 'Drop your wins from last week below. No win is too small. Let\'s celebrate the grind.',
    isCoach: true,
  },
  {
    id: 3,
    title: 'Form Check: Barbell Squat',
    author: 'Marcus J.',
    avatar: 'MJ',
    category: 'Form Checks',
    time: '3 hours ago',
    replies: 5,
    likes: 3,
    pinned: false,
    preview: 'Can someone check my squat form? I feel like I\'m leaning too far forward at the bottom.',
  },
  {
    id: 4,
    title: 'Best Pre-Workout Snacks?',
    author: 'David R.',
    avatar: 'DR',
    category: 'Nutrition',
    time: '5 hours ago',
    replies: 9,
    likes: 6,
    pinned: false,
    preview: 'What do y\'all eat before training? I need something quick that won\'t sit heavy.',
  },
  {
    id: 5,
    title: 'Hit my first 225 bench!',
    author: 'Tanya B.',
    avatar: 'TB',
    category: 'Wins',
    time: '8 hours ago',
    replies: 14,
    likes: 31,
    pinned: false,
    preview: 'Been working toward this for months. Finally got 225 for a clean single. Coach Anthony\'s programming is legit.',
  },
  {
    id: 6,
    title: 'How to Stay Consistent When Motivation Drops',
    author: 'Chris O.',
    avatar: 'CO',
    category: 'Motivation',
    time: '1 day ago',
    replies: 7,
    likes: 11,
    pinned: false,
    preview: 'I\'ve been struggling to stay on track lately. Anyone else go through phases like this?',
  },
  {
    id: 7,
    title: 'Programming Update: Phase 2 Starts Next Week',
    author: 'Anthony M.',
    avatar: 'AM',
    category: 'Training',
    time: '2 days ago',
    replies: 6,
    likes: 15,
    pinned: false,
    preview: 'For those on the Muscle Builder program, Phase 2 (Hypertrophy) kicks off Monday. Here\'s what to expect...',
    isCoach: true,
  },
]

/* ── Member Spotlights ── */
const spotlights = [
  { name: 'Sarah W.', avatar: 'SW', achievement: 'Lost 25 lbs in 3 months', stat: '-25 lbs' },
  { name: 'Marcus J.', avatar: 'MJ', achievement: 'Bench PR: 225 lbs', stat: '225 lb PR' },
  { name: 'Tanya B.', avatar: 'TB', achievement: 'Perfect attendance — 12 weeks', stat: '12 weeks' },
]

/* ── Leaderboard ── */
const leaderboard = [
  { name: 'Tanya B.', points: 1240, streak: 15 },
  { name: 'Sarah W.', points: 1180, streak: 12 },
  { name: 'Marcus J.', points: 1050, streak: 10 },
  { name: 'David R.', points: 890, streak: 7 },
  { name: 'Chris O.', points: 720, streak: 4 },
]

/* ── Upcoming Events ── */
const events = [
  { name: 'Live Q&A with Coach Anthony', date: 'Sat, Mar 29', time: '10:00 AM EST', type: 'Live' },
  { name: 'Group Accountability Check-in', date: 'Mon, Mar 31', time: '7:00 PM EST', type: 'Zoom' },
  { name: 'Monthly Challenge: 10K Steps/Day', date: 'Apr 1 - Apr 30', time: 'All Month', type: 'Challenge' },
]

export default function CommunityPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filteredPosts = activeCategory === 'All'
    ? forumPosts
    : forumPosts.filter(p => p.category === activeCategory)

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Forum Posts */}
        <div className="lg:col-span-8 space-y-4">
          {/* Category Filter */}
          <motion.div
            custom={0}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06] px-5 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-display font-extrabold text-xl text-[#1B2D50] tracking-tight">
                Community
              </h1>
              <button className="px-4 py-2 bg-[#1A7BFF] text-white text-xs font-display font-bold uppercase tracking-[0.1em] rounded-lg hover:bg-[#0F5FE0] active:scale-[0.98] transition-all duration-200">
                New Post
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-body font-medium whitespace-nowrap transition-all duration-200 ${
                    activeCategory === cat.name
                      ? 'bg-[#1A7BFF] text-white'
                      : 'bg-[#FAFBFD] text-[#64748B] hover:text-[#1B2D50] border border-[#1B2D50]/[0.06]'
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>
          </motion.div>

          {/* Posts */}
          <div className="space-y-3">
            {filteredPosts.map((post, i) => (
              <motion.div
                key={post.id}
                custom={i + 1}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-xl border border-[#1B2D50]/[0.06] p-5 hover:border-[#1A7BFF]/20 transition-colors duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    post.isCoach
                      ? 'bg-gradient-to-br from-[#F76B16] to-[#D8590C]'
                      : 'bg-[#1A7BFF]/10'
                  }`}>
                    <span className={`text-xs font-display font-bold ${
                      post.isCoach ? 'text-white' : 'text-[#1A7BFF]'
                    }`}>{post.avatar}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {post.pinned && (
                        <span className="text-[#F76B16] text-[10px] font-display font-bold bg-[#F76B16]/10 px-2 py-0.5 rounded">
                          PINNED
                        </span>
                      )}
                      <span className="text-[#1A7BFF] text-[10px] font-display font-bold bg-[#1A7BFF]/10 px-2 py-0.5 rounded">
                        {post.category}
                      </span>
                      {post.isCoach && (
                        <span className="text-[#F76B16] text-[10px] font-display font-bold">
                          COACH
                        </span>
                      )}
                    </div>
                    <h3 className="font-body font-semibold text-[#1B2D50] text-sm mb-1">
                      {post.title}
                    </h3>
                    <p className="text-[#64748B] text-xs font-body line-clamp-2 mb-2">
                      {post.preview}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-body text-[#64748B]">
                      <span>{post.author}</span>
                      <span>{post.time}</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                        </svg>
                        {post.replies}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                        {post.likes}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT: Spotlights, Leaderboard, Events */}
        <div className="lg:col-span-4 space-y-4">
          {/* Member Spotlight */}
          <motion.div
            custom={1}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Member Spotlight</h2>
            </div>
            <div className="p-5 space-y-4">
              {spotlights.map((member) => (
                <div key={member.name} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F76B16] to-[#D8590C] flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-display font-bold">{member.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-[#1B2D50] text-sm">{member.name}</p>
                    <p className="text-[#64748B] text-xs font-body truncate">{member.achievement}</p>
                  </div>
                  <span className="bg-[#F76B16]/10 text-[#F76B16] text-[10px] font-display font-bold px-2 py-1 rounded shrink-0">
                    {member.stat}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            custom={2}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Leaderboard</h2>
            </div>
            <div className="p-5 space-y-3">
              {leaderboard.map((member, i) => (
                <div key={member.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-display font-bold ${
                    i === 0 ? 'bg-[#F76B16] text-white' :
                    i === 1 ? 'bg-[#94A3B8] text-white' :
                    i === 2 ? 'bg-[#B87333] text-white' :
                    'bg-[#FAFBFD] text-[#64748B] border border-[#1B2D50]/[0.06]'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-body font-semibold text-[#1B2D50] text-sm">{member.name}</p>
                    <p className="text-[#64748B] text-[10px] font-body">{member.streak} day streak</p>
                  </div>
                  <span className="font-display font-bold text-[#1B2D50] text-sm">{member.points.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Events */}
          <motion.div
            custom={3}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Upcoming Events</h2>
            </div>
            <div className="p-5 space-y-4">
              {events.map((event) => (
                <div key={event.name} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-display font-bold ${
                    event.type === 'Live' ? 'bg-red-500/10 text-red-500' :
                    event.type === 'Zoom' ? 'bg-[#1A7BFF]/10 text-[#1A7BFF]' :
                    'bg-[#F76B16]/10 text-[#F76B16]'
                  }`}>
                    {event.type === 'Live' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    ) : event.type === 'Zoom' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.996.462-1.688 1.422-1.897 2.53l-.016.085a.737.737 0 0 0 .543.838 3.72 3.72 0 0 0 2.073.047.738.738 0 0 0 .519-.67 2.098 2.098 0 0 1 .417-1.078" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-body font-semibold text-[#1B2D50] text-sm">{event.name}</p>
                    <p className="text-[#64748B] text-xs font-body">{event.date} &middot; {event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            custom={4}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-xl border border-[#1B2D50]/[0.06]"
          >
            <div className="px-5 py-4 border-b border-[#1B2D50]/[0.06]">
              <h2 className="font-display font-bold text-sm text-[#1B2D50]">Quick Links</h2>
            </div>
            <div className="p-5 space-y-2">
              {[
                { label: 'Community Guidelines', icon: '📋' },
                { label: 'Submit a Form Check', icon: '📹' },
                { label: 'Recipe Database', icon: '🍽️' },
                { label: 'Progress Photo Gallery', icon: '📸' },
              ].map((link) => (
                <button
                  key={link.label}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body text-[#1B2D50] hover:bg-[#FAFBFD] transition-colors duration-200 text-left"
                >
                  <span>{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                  <svg className="w-3.5 h-3.5 text-[#64748B] ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
