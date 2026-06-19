import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Server-side route protection.
 *  - /studio/* : any authenticated user (a client). Else → /members.
 *  - /luffy/*  : authenticated AND app_metadata.role === 'trainer'. Else → /members
 *                (or studio if a signed-in non-trainer).
 * Also refreshes the Supabase session cookie on every matched request.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isStudio = pathname.startsWith('/studio')
  const isLuffy = pathname.startsWith('/luffy')

  if (!isStudio && !isLuffy) return response

  // Not signed in → send to login, remembering where they were headed.
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/members'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Trainer area: must carry the trainer role claim.
  if (isLuffy) {
    const role = (user.app_metadata as { role?: string } | undefined)?.role
    if (role !== 'trainer') {
      const url = request.nextUrl.clone()
      url.pathname = '/studio' // a signed-in client gets bounced to their studio
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // Run on the two portals only. Static assets and the public marketing site
  // are untouched.
  matcher: ['/studio/:path*', '/luffy/:path*'],
}
