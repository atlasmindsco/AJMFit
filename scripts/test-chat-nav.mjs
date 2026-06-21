/**
 * Sanity-checks Chea's app-navigation behavior against the live model:
 * navigation questions should yield a [[go:/route|Label]] tag; a general
 * fitness question should NOT. Run: node scripts/test-chat-nav.mjs
 */
import { readFileSync } from 'node:fs'
import OpenAI from 'openai'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

// Mirrors lib/app-map.ts clientAppMapPrompt() + the base persona rules.
const SYSTEM = `You are Chea, the AJM Fit AI fitness assistant. Keep responses SHORT (2-4 sentences).

APP NAVIGATION — you know how the AJM Fit member studio is organized:
- Dashboard (/studio): training snapshot, PRs, your assigned program.
- Programs & Training (/studio/programs): your assigned program + exercise library; log workouts.
- Nutrition (/studio/nutrition): log meals, macros, water, scan barcode, search foods.
- Messages (/studio/messages): message Coach Anthony directly.
- Community (/studio/community): feed, events, leaderboard.

When the client asks where/how to do something in the app, give a one-sentence answer, then on a NEW line add a tag EXACTLY like:
[[go:/studio/nutrition|Nutrition]]
Use ONLY those exact routes. Max 1-2 tags. Do NOT add a tag for general fitness questions.`

const tests = [
  { q: 'where do I log my meals?', expectTag: true },
  { q: 'how do I message my coach?', expectTag: true },
  { q: 'where can I see my workout program?', expectTag: true },
  { q: 'how much protein should I eat to build muscle?', expectTag: false },
]

const tagRe = /\[\[go:(\/[^|\]]+)\|([^\]]+)\]\]/g
for (const t of tests) {
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: t.q }],
    max_tokens: 200,
    temperature: 0.4,
  })
  const out = r.choices[0].message.content
  const tags = [...out.matchAll(tagRe)].map((m) => `${m[1]}|${m[2]}`)
  const hasTag = tags.length > 0
  const pass = hasTag === t.expectTag
  console.log(`\n[${pass ? 'PASS' : 'FAIL'}] Q: ${t.q}`)
  console.log(`  expected tag: ${t.expectTag} | got: ${hasTag} ${tags.length ? '-> ' + tags.join(', ') : ''}`)
  console.log(`  reply: ${out.replace(/\n/g, ' ⏎ ')}`)
}
process.exit(0)
