import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Post {
  id: string
  user_id: string
  category: string
  title: string
  body: string
  author_name: string | null
  pinned: boolean
  created_at: string
  commentCount?: number
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  author_name: string | null
  body: string
  created_at: string
}

export interface CommunityEvent {
  id: string
  title: string
  type: string | null
  starts_at: string
  description: string | null
}

export const POST_CATEGORIES = ['General', 'Wins', 'Nutrition', 'Form Check', 'Motivation']

export async function fetchPosts(): Promise<Post[]> {
  const [{ data: posts, error }, { data: comments }] = await Promise.all([
    db.from('posts').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    db.from('post_comments').select('post_id'),
  ])
  if (error) throw error
  const counts = new Map<string, number>()
  for (const c of (comments ?? []) as { post_id: string }[]) counts.set(c.post_id, (counts.get(c.post_id) ?? 0) + 1)
  return (posts ?? []).map((p: Post) => ({ ...p, commentCount: counts.get(p.id) ?? 0 }))
}

export async function createPost(userId: string, authorName: string, input: { category: string; title: string; body: string }) {
  const { error } = await db.from('posts').insert({ user_id: userId, author_name: authorName, ...input })
  if (error) throw error
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await db.from('post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Comment[]
}

export async function addComment(postId: string, userId: string, authorName: string, body: string) {
  const { error } = await db.from('post_comments').insert({ post_id: postId, user_id: userId, author_name: authorName, body })
  if (error) throw error
}

export async function fetchEvents(): Promise<CommunityEvent[]> {
  const { data, error } = await db
    .from('community_events')
    .select('*')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CommunityEvent[]
}

export interface LeaderRow {
  name: string
  workouts: number
}
export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  const res = await fetch('/api/community/leaderboard')
  if (!res.ok) return []
  const body = (await res.json()) as { leaders?: LeaderRow[] }
  return body.leaders ?? []
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
