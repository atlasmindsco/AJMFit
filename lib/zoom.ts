// Server-only Zoom helper. Uses Server-to-Server OAuth (account_credentials grant).
// Never import this from a client component — it reads ZOOM_CLIENT_SECRET.

const ZOOM_OAUTH = 'https://zoom.us/oauth/token'
const ZOOM_API = 'https://api.zoom.us/v2'

interface TokenCache {
  token: string
  expiresAt: number // epoch ms
}

// Tokens last ~1h; cache in module scope to avoid re-minting on every request.
let cache: TokenCache | null = null

function requireEnv(): { accountId: string; clientId: string; clientSecret: string } {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom is not configured (missing ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET).')
  }
  return { accountId, clientId, clientSecret }
}

async function getAccessToken(now: number): Promise<string> {
  if (cache && cache.expiresAt > now + 60_000) return cache.token

  const { accountId, clientId, clientSecret } = requireEnv()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(
    `${ZOOM_OAUTH}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
    }
  )

  const body = (await res.json()) as { access_token?: string; expires_in?: number; reason?: string; error?: string }
  if (!res.ok || !body.access_token) {
    throw new Error(`Zoom auth failed (${res.status}): ${body.reason || body.error || 'unknown error'}`)
  }

  cache = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 }
  return body.access_token
}

export interface CreatedMeeting {
  id: string
  join_url: string
  start_url: string
}

/**
 * Creates a scheduled Zoom meeting on the account owner's calendar.
 * `startISO` must be an ISO 8601 timestamp; Zoom schedules in the given timezone.
 */
export async function createMeeting(input: {
  topic: string
  startISO: string
  durationMin: number
  timezone?: string
  agenda?: string
}): Promise<CreatedMeeting> {
  const token = await getAccessToken(Date.now())
  const res = await fetch(`${ZOOM_API}/users/me/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: input.topic,
      type: 2, // scheduled meeting
      start_time: input.startISO,
      duration: input.durationMin,
      timezone: input.timezone ?? 'America/New_York',
      agenda: input.agenda,
      settings: {
        join_before_host: true,
        waiting_room: true,
        approval_type: 2, // no registration required
      },
    }),
  })

  const body = (await res.json()) as { id?: number; join_url?: string; start_url?: string; message?: string }
  if (!res.ok || !body.join_url) {
    throw new Error(`Zoom meeting create failed (${res.status}): ${body.message || 'unknown error'}`)
  }
  return { id: String(body.id), join_url: body.join_url, start_url: body.start_url ?? '' }
}

/** Deletes a Zoom meeting by id. Best-effort; ignores 404 (already gone). */
export async function deleteMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken(Date.now())
  const res = await fetch(`${ZOOM_API}/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(`Zoom meeting delete failed (${res.status}): ${body.message || 'unknown error'}`)
  }
}
