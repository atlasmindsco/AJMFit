import { timingSafeEqual } from 'node:crypto'

/**
 * Who is allowed to run a scheduled job.
 *
 * WHAT WAS WRONG, AND IT WAS LIVE. Each of the four cron routes carried its
 * own copy of this check, and each one ended the same way:
 *
 *     } else if (!request.headers.get('x-vercel-cron')) {
 *       return 401
 *     }
 *
 * `x-vercel-cron` is not a secret. It is a plain header, and anybody can
 * send one. So with CRON_SECRET unset — which is how production actually
 * stood — every job was reachable by anyone who knew the URL:
 *
 *     curl -H 'x-vercel-cron: 1' https://ajmfit.com/api/cron/reminders
 *     → 200, and the client reminder emails go out.
 *
 * Verified against production before this was written: all four returned
 * 200 to that header and 401 without it, which is the signature of a secret
 * that was never configured.
 *
 * The comments defending the fallback said "the worst an unauthorized caller
 * achieves is making the coach's own digest arrive early". That was true of
 * the digest and false of the other three: reminders mails clients,
 * nutrition-review rewrites their calorie targets, and close-workouts ends
 * sessions people are in the middle of.
 *
 * SO IT FAILS CLOSED. No secret, no run — and it says so with a 503 rather
 * than a 401, because "I am not configured" and "you are not allowed" are
 * different problems and the first one is the operator's to fix. A silent
 * cron is what let this sit unnoticed for five weeks; a loud one is the
 * whole point.
 *
 * Vercel sets `Authorization: Bearer $CRON_SECRET` on its own cron
 * invocations once the env var exists, so vercel.json's schedules and the
 * GitHub Actions workflow both authenticate the same way, through the same
 * door.
 */

export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: string }

/** Constant time, so a wrong token cannot be narrowed down a character at a time. */
function sameSecret(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length. Compare padded buffers and fold the length into the result.
  const len = Math.max(ab.length, bb.length)
  const pa = Buffer.alloc(len)
  const pb = Buffer.alloc(len)
  ab.copy(pa)
  bb.copy(pb)
  return timingSafeEqual(pa, pb) && ab.length === bb.length
}

export function authoriseCron(input: {
  secret: string | undefined | null
  authorization: string | undefined | null
}): CronAuth {
  const secret = (input.secret ?? '').trim()
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error:
        'CRON_SECRET is not configured. Scheduled jobs are disabled until it is set ' +
        'in the deployment environment. This endpoint will not run on an unauthenticated request.',
    }
  }

  const header = (input.authorization ?? '').trim()
  const expected = `Bearer ${secret}`
  if (!header || !sameSecret(header, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true }
}
