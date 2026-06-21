/**
 * Registers (or lists / deletes) the Calendly webhook subscription.
 * Reads CALENDLY_API_TOKEN from .env.local.
 *
 *   node scripts/calendly-register-webhook.mjs                 # register against prod
 *   node scripts/calendly-register-webhook.mjs <callback-url>  # register against a custom URL
 *   node scripts/calendly-register-webhook.mjs --list          # show existing subscriptions
 *   node scripts/calendly-register-webhook.mjs --delete <uri>  # remove one
 *
 * This Calendly plan doesn't issue signing keys, so the callback URL carries a
 * shared secret (?token=CALENDLY_WEBHOOK_TOKEN from .env.local). Make sure that
 * same token is set in Vercel. If a signing key ever becomes available, the
 * webhook route will prefer HMAC verification automatically.
 */
import { readFileSync } from 'node:fs'

const API = 'https://api.calendly.com'
const BASE_CALLBACK = 'https://ajmfit.com/api/calendly/webhook'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const token = env.CALENDLY_API_TOKEN
if (!token) {
  console.error('CALENDLY_API_TOKEN missing from .env.local')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

async function api(path, init) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`ERROR ${path} (${res.status}):`, body.message || body.title || JSON.stringify(body))
    process.exit(2)
  }
  return body
}

const me = (await api('/users/me')).resource
const userUri = me.uri
const orgUri = me.current_organization

const arg = process.argv[2]

if (arg === '--list') {
  const qs = new URLSearchParams({ organization: orgUri, user: userUri, scope: 'user' })
  const { collection } = await api(`/webhook_subscriptions?${qs}`)
  if (!collection.length) console.log('No webhook subscriptions.')
  for (const w of collection) console.log(`${w.state}  ${w.uri}\n   -> ${w.callback_url}  [${w.events.join(', ')}]`)
  process.exit(0)
}

if (arg === '--delete') {
  const uri = process.argv[3]
  if (!uri) { console.error('Usage: --delete <subscription-uri>'); process.exit(1) }
  await api(uri.replace(API, ''), { method: 'DELETE' })
  console.log('Deleted:', uri)
  process.exit(0)
}

const secret = env.CALENDLY_WEBHOOK_TOKEN
if (!secret) {
  console.error('CALENDLY_WEBHOOK_TOKEN missing from .env.local — set it first (a long random string).')
  process.exit(1)
}
const base = arg || BASE_CALLBACK
const callbackUrl = `${base}?token=${encodeURIComponent(secret)}`

const { resource } = await api('/webhook_subscriptions', {
  method: 'POST',
  body: JSON.stringify({
    url: callbackUrl,
    events: ['invitee.created', 'invitee.canceled'],
    organization: orgUri,
    user: userUri,
    scope: 'user',
  }),
})

console.log('Webhook registered:', resource.uri)
console.log('Callback URL:      ', resource.callback_url)
console.log('')
console.log('Make sure CALENDLY_WEBHOOK_TOKEN is set in Vercel to the same value as .env.local.')
if (resource.signing_key) {
  console.log('Signing key was issued — also set CALENDLY_WEBHOOK_SIGNING_KEY=' + resource.signing_key)
}
