import { NextResponse } from 'next/server'
import { fetchIssues } from '@/lib/blog'

// Slim list of published issues for client surfaces (e.g. the newsletter page's
// "Recent Issues"). Cached on the same 10-min cadence as the blog.
export const revalidate = 600

export async function GET() {
  const issues = await fetchIssues()
  return NextResponse.json({ issues: issues.slice(0, 6) })
}
