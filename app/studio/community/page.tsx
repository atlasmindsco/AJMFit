'use client'

import { motion } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'
import { getCurrentUserId } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'
import {
  fetchPosts, createPost, fetchComments, addComment, fetchEvents, fetchLeaderboard,
  POST_CATEGORIES, timeAgo,
  type Post, type Comment, type CommunityEvent, type LeaderRow,
} from '@/lib/community'

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export default function CommunityPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [leaders, setLeaders] = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)

  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ category: POST_CATEGORIES[0], title: '', body: '' })
  const [posting, setPosting] = useState(false)

  const [openPost, setOpenPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')

  const loadPosts = useCallback(async () => setPosts(await fetchPosts()), [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: u } = await supabase.from('users').select('id, name').eq('auth_id', data.user.id).maybeSingle<{ id: string; name: string }>()
        if (u) { setUserId(u.id); setName(u.name) }
      }
    })
    Promise.all([loadPosts(), fetchEvents().then(setEvents), fetchLeaderboard().then(setLeaders)]).finally(() => setLoading(false))
  }, [loadPosts])

  const submitPost = async () => {
    if (!userId || !draft.title.trim()) return
    setPosting(true)
    try {
      await createPost(userId, name || 'Member', { category: draft.category, title: draft.title.trim(), body: draft.body.trim() })
      setDraft({ category: POST_CATEGORIES[0], title: '', body: '' })
      setShowNew(false)
      await loadPosts()
    } catch (e) { console.error(e) } finally { setPosting(false) }
  }

  const toggleComments = async (postId: string) => {
    if (openPost === postId) { setOpenPost(null); return }
    setOpenPost(postId)
    setComments(await fetchComments(postId))
  }

  const submitComment = async (postId: string) => {
    if (!userId || !commentText.trim()) return
    await addComment(postId, userId, name || 'Member', commentText.trim())
    setCommentText('')
    setComments(await fetchComments(postId))
    await loadPosts()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">Community</h1>
          <p className="text-white/40 text-sm font-body mt-1">Share wins, ask questions, stay accountable.</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="px-5 py-2.5 bg-[#F76B16] text-white text-xs font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#D8590C] active:scale-[0.98] transition-all duration-200">
          {showNew ? 'Close' : 'New Post'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-4">
          {showNew && (
            <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-5">
              <div className="flex gap-2 mb-3 flex-wrap">
                {POST_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setDraft({ ...draft, category: c })} className={`px-3 py-1.5 rounded-md text-[11px] font-display font-bold uppercase tracking-wide ${draft.category === c ? 'bg-[#F76B16] text-white' : 'bg-white/[0.04] text-white/40'}`}>{c}</button>
                ))}
              </div>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white font-body mb-2 focus:outline-none focus:border-[#F76B16]/40" />
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} placeholder="Share something…" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white font-body resize-none focus:outline-none focus:border-[#F76B16]/40" />
              <div className="flex justify-end mt-3">
                <button onClick={submitPost} disabled={posting || !draft.title.trim()} className="px-5 py-2 bg-[#F76B16] text-white text-xs font-display font-bold uppercase tracking-wide rounded-lg disabled:opacity-40">{posting ? 'Posting…' : 'Post'}</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-8 text-center">
              <p className="text-white font-display font-bold text-sm">No posts yet</p>
              <p className="text-white/40 text-sm font-body mt-1">Be the first to share a win or ask a question.</p>
            </div>
          ) : (
            posts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-[#1C1C1C] rounded-xl border border-white/[0.10] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F76B16] to-[#D8590C] flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-display font-bold">{initials(p.author_name ?? 'Member')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-body font-semibold">{p.author_name ?? 'Member'}</p>
                    <p className="text-white/30 text-[11px] font-body">{p.category} · {timeAgo(p.created_at)}</p>
                  </div>
                  {p.pinned && <span className="text-[#F76B16] text-[10px] font-display font-bold uppercase">Pinned</span>}
                </div>
                <h3 className="text-white font-display font-bold text-sm">{p.title}</h3>
                {p.body && <p className="text-white/60 text-sm font-body mt-1 leading-relaxed whitespace-pre-wrap">{p.body}</p>}
                <button onClick={() => toggleComments(p.id)} className="mt-3 text-white/40 text-xs font-body hover:text-white/70">
                  {p.commentCount ? `${p.commentCount} comment${p.commentCount === 1 ? '' : 's'}` : 'Comment'} {openPost === p.id ? '▲' : '▼'}
                </button>
                {openPost === p.id && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0"><span className="text-white text-[9px] font-display font-bold">{initials(c.author_name ?? 'M')}</span></div>
                        <div className="flex-1"><p className="text-white/80 text-xs font-body"><span className="font-semibold text-white">{c.author_name ?? 'Member'}</span> · {timeAgo(c.created_at)}</p><p className="text-white/60 text-sm font-body">{c.body}</p></div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitComment(p.id) }} placeholder="Write a comment…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-body focus:outline-none focus:border-[#F76B16]/40" />
                      <button onClick={() => submitComment(p.id)} disabled={!commentText.trim()} className="px-3 py-2 bg-[#1A7BFF] text-white text-xs font-display font-bold uppercase rounded-lg disabled:opacity-40">Send</button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className="px-5 py-4 border-b border-white/[0.10]"><h2 className="font-display font-bold text-sm text-white">Upcoming Events</h2></div>
            <div className="p-4 space-y-3">
              {events.length === 0 ? <p className="text-white/40 text-sm font-body">No events scheduled.</p>
                : events.map((e) => (
                  <div key={e.id}>
                    <p className="text-white text-sm font-body font-semibold">{e.title}</p>
                    <p className="text-white/40 text-xs font-body">{e.type ? `${e.type} · ` : ''}{new Date(e.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.10]">
            <div className="px-5 py-4 border-b border-white/[0.10]"><h2 className="font-display font-bold text-sm text-white">Leaderboard</h2><p className="text-white/30 text-[10px] font-body">Workouts this month</p></div>
            <div className="p-4 space-y-2">
              {leaders.length === 0 ? <p className="text-white/40 text-sm font-body">No workouts logged yet this month.</p>
                : leaders.map((l, i) => (
                  <div key={l.name + i} className="flex items-center gap-3">
                    <span className={`w-5 text-center text-xs font-display font-bold ${i === 0 ? 'text-[#F76B16]' : 'text-white/30'}`}>{i + 1}</span>
                    <span className="flex-1 text-white/80 text-sm font-body truncate">{l.name}</span>
                    <span className="text-white/50 text-xs font-body">{l.workouts}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
