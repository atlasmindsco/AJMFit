import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchIssues, fetchPostByParam, formatIssueDate, SITE_URL } from '@/lib/blog'
import NewsletterSignup from '@/components/newsletter/NewsletterSignup'

export const revalidate = 600

type Params = { params: { slug: string } }

const DEFAULT_OG = `${SITE_URL}/BandGnewsletter.png`

// Pre-render the known posts at build; new ones stream in via ISR.
// Swallow Kit failures here: a Kit hiccup during `next build` should not fail
// the deploy — pages simply render on demand instead.
export async function generateStaticParams() {
  try {
    const issues = await fetchIssues()
    return issues.map((i) => ({ slug: i.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await fetchPostByParam(params.slug)
  if (!post) return { title: 'Post' }
  const url = `${SITE_URL}/blog/${post.slug}`
  const image = post.thumbnailUrl || DEFAULT_OG
  return {
    title: post.title,
    description: post.excerpt || 'A Brains & Gains issue from AJM Fit.',
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url,
      siteName: 'AJM Fit',
      publishedTime: post.date,
      authors: ['Anthony Martin'],
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [image],
    },
  }
}

function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default async function BlogPostPage({ params }: Params) {
  const post = await fetchPostByParam(params.slug)
  if (!post) notFound()

  const mins = readingMinutes(post.bodyHtml)
  const url = `${SITE_URL}/blog/${post.slug}`
  const image = post.thumbnailUrl || DEFAULT_OG

  // Structured data — the AEO/rich-result signal for this article.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: [image],
    datePublished: post.date,
    dateModified: post.date,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: 'Anthony Martin', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'AJM Fit',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/AJMfit.png` },
    },
    isPartOf: { '@type': 'Blog', name: 'Brains & Gains', url: `${SITE_URL}/blog` },
  }

  return (
    <article className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <div className="relative overflow-hidden bg-brand-navy text-white pt-28 pb-16 grain-overlay">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-navy to-[#0e1b34]" />
        <div className="absolute -bottom-16 right-10 w-80 h-80 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="absolute top-10 -left-20 w-72 h-72 rounded-full bg-brand-blue/15 blur-3xl" />
        <div className="max-w-3xl mx-auto px-6 lg:px-8 relative">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white text-xs font-display uppercase tracking-[0.2em] mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            All posts
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display font-bold text-[11px] uppercase tracking-[0.2em] text-white bg-brand-orange px-2.5 py-1 rounded-sm">
              Brains &amp; Gains
            </span>
            <span className="text-white/50 text-xs">{formatIssueDate(post.date)} · {mins} min read</span>
          </div>
          <h1 className="font-display font-extrabold text-4xl md:text-6xl uppercase tracking-[-0.03em] leading-[0.95]">
            {post.title}
          </h1>
          {post.excerpt && <p className="mt-6 text-white/70 text-xl leading-relaxed max-w-2xl">{post.excerpt}</p>}
          <div className="mt-8 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-orange to-[#c2530a] flex items-center justify-center font-display font-bold text-white">AM</div>
            <div>
              <div className="font-display font-bold text-sm uppercase tracking-[0.1em]">Coach Anthony Martin</div>
              <div className="text-white/40 text-xs">Founder, AJM Fit</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        className="kit-content max-w-2xl mx-auto px-6 lg:px-8 pt-14"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
      />

      {/* Newsletter signup */}
      <div className="max-w-2xl mx-auto px-6 lg:px-8 mt-14">
        <NewsletterSignup variant="card" />
      </div>

      {/* Apply CTA */}
      <div className="max-w-2xl mx-auto px-6 lg:px-8 mt-8">
        <div className="relative overflow-hidden rounded-md bg-brand-navy text-white p-10 text-center grain-overlay">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-brand-orange/20 blur-2xl" />
          <div className="relative">
            <h3 className="font-display font-extrabold text-3xl uppercase tracking-tight">Ready to Start?</h3>
            <p className="text-white/60 mt-3 mb-7 max-w-md mx-auto">Applications are open. Let&rsquo;s build the plan that actually fits your life.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/apply" className="inline-flex items-center justify-center px-8 py-4 bg-brand-orange text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm shadow-[0_4px_24px_rgba(247,107,22,0.35)] hover:bg-orange-600 active:scale-95 transition">
                Apply Now
              </Link>
              <Link href="/work-with-me" className="inline-flex items-center justify-center px-8 py-4 bg-transparent border-2 border-white/25 text-white font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm hover:bg-white/5 active:scale-95 transition">
                Explore Programs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
