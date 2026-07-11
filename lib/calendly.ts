// Server-only Calendly helper. Uses a Personal Access Token (single account:
// Anthony's). Never import this from a client component, it reads CALENDLY_API_TOKEN.

import crypto from 'node:crypto'

const CALENDLY_API = 'https://api.calendly.com'

function requireToken(): string {
  const token = process.env.CALENDLY_API_TOKEN
  if (!token) throw new Error('Calendly is not configured (missing CALENDLY_API_TOKEN).')
  return token
}

async function calendly<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CALENDLY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const message = (body.message as string) || (body.title as string) || 'unknown error'
    throw new Error(`Calendly ${path} failed (${res.status}): ${message}`)
  }
  return body as T
}

export interface CalendlyUser {
  uri: string
  current_organization: string
  scheduling_url: string
  email: string
  name: string
  timezone: string
}

/** GET /users/me, returns the token owner, including the user + organization URIs. */
export async function getCurrentUser(): Promise<CalendlyUser> {
  const { resource } = await calendly<{ resource: CalendlyUser }>('/users/me')
  return resource
}

export interface WebhookSubscription {
  uri: string
  callback_url: string
  state: string
  events: string[]
}

/**
 * POST /webhook_subscriptions, registers a webhook. The response (and only the
 * response) contains nothing secret, but the SIGNING KEY is returned separately
 * and must be saved to CALENDLY_WEBHOOK_SIGNING_KEY to verify incoming events.
 */
export async function createWebhookSubscription(input: {
  callbackUrl: string
  organizationUri: string
  userUri: string
  events?: string[]
}): Promise<{ subscription: WebhookSubscription; signingKey: string }> {
  const body = await calendly<{
    resource: WebhookSubscription & { signing_key?: string }
  }>('/webhook_subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      url: input.callbackUrl,
      events: input.events ?? ['invitee.created', 'invitee.canceled'],
      organization: input.organizationUri,
      user: input.userUri,
      scope: 'user',
    }),
  })
  return {
    subscription: body.resource,
    signingKey: body.resource.signing_key ?? '',
  }
}

/** GET /webhook_subscriptions, list existing subscriptions for an org/user. */
export async function listWebhookSubscriptions(input: {
  organizationUri: string
  userUri: string
}): Promise<WebhookSubscription[]> {
  const qs = new URLSearchParams({
    organization: input.organizationUri,
    user: input.userUri,
    scope: 'user',
  })
  const { collection } = await calendly<{ collection: WebhookSubscription[] }>(
    `/webhook_subscriptions?${qs}`
  )
  return collection
}

/** DELETE a webhook subscription by its URI. */
export async function deleteWebhookSubscription(uri: string): Promise<void> {
  // The URI is already absolute; strip the base so calendly() can prepend it.
  const path = uri.replace(CALENDLY_API, '')
  await calendly(path, { method: 'DELETE' })
}

/**
 * Verifies the `Calendly-Webhook-Signature` header.
 * Format: "t=<unix>,v1=<hex hmac>" where the HMAC is SHA-256 over `${t}.${rawBody}`
 * keyed by the signing key. Returns false on any parse/mismatch (fail closed).
 */
export function verifyWebhookSignature(input: {
  rawBody: string
  signatureHeader: string | null
  signingKey: string
  toleranceSec?: number
}): boolean {
  const { rawBody, signatureHeader, signingKey } = input
  if (!signatureHeader || !signingKey) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string])
  )
  const timestamp = parts['t']
  const provided = parts['v1']
  if (!timestamp || !provided) return false

  // Reject stale signatures (default 3 min) to blunt replay attacks.
  const tolerance = input.toleranceSec ?? 180
  const age = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (!Number.isFinite(age) || age > tolerance) return false

  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ---- Webhook payload shapes (only the fields we consume) --------------------

export interface CalendlyInviteePayload {
  uri: string // invitee URI
  email: string
  name: string
  scheduled_event: {
    uri: string
    start_time: string // ISO 8601
    end_time: string // ISO 8601
    name: string | null
    location?: { type?: string; join_url?: string; location?: string } | null
  }
}

export interface CalendlyWebhookEvent {
  event: 'invitee.created' | 'invitee.canceled' | string
  payload: CalendlyInviteePayload
}
