import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/blog'

// Public marketing + blog are open to all crawlers (incl. AI answer engines
// like GPTBot, PerplexityBot, ClaudeBot — covered by the '*' allow). The
// gated app areas are kept out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/studio', '/luffy', '/members', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
