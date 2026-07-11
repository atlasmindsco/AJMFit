import type { MetadataRoute } from 'next'
import { fetchIssues, SITE_URL } from '@/lib/blog'

// Regenerate alongside the blog cache so new posts enter the sitemap.
export const revalidate = 600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/work-with-me`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/apply`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Kit failure -> ship the static routes rather than failing the build/regen.
  let posts: MetadataRoute.Sitemap = []
  try {
    posts = (await fetchIssues()).map((i) => ({
      url: `${SITE_URL}/blog/${i.slug}`,
      lastModified: new Date(i.date),
      changeFrequency: 'monthly',
      priority: 0.8,
    }))
  } catch {
    posts = []
  }

  return [...staticRoutes, ...posts]
}
