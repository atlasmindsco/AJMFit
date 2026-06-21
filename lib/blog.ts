/**
 * Blog data layer — pulls published issues from Kit (formerly ConvertKit).
 *
 * Source of truth is Kit broadcasts. An issue shows on the blog when it's
 * marked `public` in Kit (the "publish to web" flag), independent of whether
 * it was emailed — so a never-sent public draft is a web-only post, and an
 * emailed + public broadcast is a newsletter that also lands here.
 *
 * Server-only: uses KIT_API_KEY (no NEXT_PUBLIC_ prefix). Never import into a
 * client component.
 */

const KIT_BASE = 'https://api.kit.com/v4'
const REVALIDATE_SECONDS = 600 // refresh published issues every 10 min

export const SITE_URL = 'https://ajmfit.com'

export interface BlogIssue {
  id: number
  slug: string
  title: string
  excerpt: string
  date: string // ISO timestamp, best available
  thumbnailUrl: string | null
}

/** URL-safe slug from a title, e.g. "AJM Fit Is Live" -> "ajm-fit-is-live". */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post'
}

export interface BlogPost extends BlogIssue {
  bodyHtml: string
}

type KitBroadcast = {
  id: number
  subject: string
  preview_text: string | null
  description: string | null
  content: string | null
  public: boolean
  published_at: string | null
  send_at: string | null
  created_at: string
  thumbnail_url: string | null
}

function kitHeaders(): HeadersInit {
  return { 'X-Kit-Api-Key': process.env.KIT_API_KEY || '', 'Content-Type': 'application/json' }
}

/** Best available publish date for ordering/display. */
function issueDate(b: KitBroadcast): string {
  return b.published_at || b.send_at || b.created_at
}

/** Strip a leading bracket tag like "[TEST] " editors sometimes prefix. */
function cleanTitle(subject: string): string {
  return subject.replace(/^\s*\[[^\]]*\]\s*/, '').trim() || subject
}

/** Plain-text excerpt fallback when Kit has no preview text. */
function deriveExcerpt(b: KitBroadcast): string {
  if (b.preview_text) return b.preview_text
  if (b.description) return b.description
  const text = (b.content || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 160 ? text.slice(0, 157).trimEnd() + '…' : text
}

function toIssue(b: KitBroadcast): BlogIssue {
  const title = cleanTitle(b.subject)
  return {
    id: b.id,
    slug: slugify(title),
    title,
    excerpt: deriveExcerpt(b),
    date: issueDate(b),
    thumbnailUrl: b.thumbnail_url,
  }
}

/**
 * Extracts the renderable body from Kit content. Email issues arrive as full
 * HTML documents; we take the <body> inner HTML. Scripts are stripped.
 */
function extractBody(html: string): string {
  let out = html
  const bodyMatch = out.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) out = bodyMatch[1]
  return out
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .trim()
}

/** All issues currently published to the web, newest first. */
export async function fetchIssues(): Promise<BlogIssue[]> {
  const key = process.env.KIT_API_KEY
  if (!key) return []
  const res = await fetch(`${KIT_BASE}/broadcasts?per_page=100`, {
    headers: kitHeaders(),
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    console.error('[blog] Kit list failed:', res.status, await res.text().catch(() => ''))
    return []
  }
  const data = (await res.json()) as { broadcasts?: KitBroadcast[] }
  return (data.broadcasts ?? [])
    .filter((b) => b.public === true)
    .sort((a, b) => +new Date(issueDate(b)) - +new Date(issueDate(a)))
    .map(toIssue)
}

/** A single public issue with its rendered body, or null if not public/found. */
export async function fetchPost(id: number): Promise<BlogPost | null> {
  const key = process.env.KIT_API_KEY
  if (!key || !Number.isFinite(id)) return null
  const res = await fetch(`${KIT_BASE}/broadcasts/${id}`, {
    headers: kitHeaders(),
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { broadcast?: KitBroadcast }
  const b = data.broadcast
  if (!b || b.public !== true) return null // never expose non-public via direct URL
  return { ...toIssue(b), bodyHtml: extractBody(b.content || '') }
}

/**
 * Resolves a /blog/[param] segment to a post. Accepts a slug (preferred) or a
 * raw numeric Kit id (back-compat for any already-shared numeric links).
 */
export async function fetchPostByParam(param: string): Promise<BlogPost | null> {
  if (/^\d+$/.test(param)) return fetchPost(Number(param))
  const issue = (await fetchIssues()).find((i) => i.slug === param)
  return issue ? fetchPost(issue.id) : null
}

/** Formats an ISO date as "June 21, 2026". */
export function formatIssueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
