/**
 * Read-only inspection of the Kit REST API so we know the exact shape the blog
 * should consume. Lists broadcasts + fetches one with content. Run:
 *   node scripts/inspect-kit.mjs
 */
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const KEY = env.KIT_API_KEY
const BASE = 'https://api.kit.com/v4'
const get = async (p) => {
  const r = await fetch(`${BASE}${p}`, { headers: { 'X-Kit-Api-Key': KEY, 'Content-Type': 'application/json' } })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const list = await get('/broadcasts?per_page=10')
console.log('GET /broadcasts ->', list.status)
const broadcasts = list.json?.broadcasts ?? []
for (const b of broadcasts) {
  console.log(`  #${b.id} | status=${b.status} | public=${b.public} | published_at=${b.published_at} | public_url=${b.public_url} | "${b.subject}"`)
}

if (broadcasts[0]) {
  const one = await get(`/broadcasts/${broadcasts[0].id}`)
  console.log(`\nGET /broadcasts/${broadcasts[0].id} ->`, one.status)
  const b = one.json?.broadcast ?? one.json
  console.log('  keys:', Object.keys(b || {}).join(', '))
  console.log('  public:', b?.public, '| public_url:', b?.public_url, '| published_at:', b?.published_at)
  const content = b?.content || ''
  console.log('  content length:', content.length)
  console.log('  content head:', content.slice(0, 300).replace(/\n/g, ' '))
}
process.exit(0)
