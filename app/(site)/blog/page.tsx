import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { fetchIssues, formatIssueDate } from '@/lib/blog'
import NewsletterSignup from '@/components/newsletter/NewsletterSignup'

export const metadata: Metadata = {
  title: 'Blog — Brains & Gains | AJM Fit',
  description: 'Training insight, mindset, and updates from Coach Anthony Martin. Every issue of the Brains & Gains newsletter, archived and readable.',
}

// Pull fresh published issues from Kit on a 10-min cadence.
export const revalidate = 600

const ArrowRight = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
)

// Carried over from the old newsletter page (now merged here).
const benefits = [
  'Weekly training insights & programming tips',
  'Mindset strategies for long-term discipline',
  'Supplement recommendations backed by science',
  'Early access to program openings',
  'Real talk — no fluff, no gimmicks',
]

export default async function BlogIndex() {
  const issues = await fetchIssues()
  const featured = issues[0]
  const rest = issues.slice(1)

  return (
    <div className="pt-28 pb-20">
      {/* Hero */}
      <header className="relative overflow-hidden mb-14">
        <div className="absolute -top-24 -right-24 w-[460px] h-[460px] rounded-full bg-brand-blue/[0.06] blur-3xl" />
        <div className="absolute top-32 -left-32 w-[380px] h-[380px] rounded-full bg-brand-orange/[0.05] blur-3xl" />
        <div className="max-w-5xl mx-auto px-6 lg:px-8 relative">
          <span className="font-display font-semibold text-sm uppercase tracking-[0.3em] text-brand-blue">The Blog</span>
          <h1 className="font-display font-extrabold text-6xl md:text-8xl uppercase tracking-[-0.03em] mt-4 leading-[0.92] text-brand-navy">
            Brains &amp;<br /><span className="text-brand-orange">Gains</span>
          </h1>
          <p className="mt-6 text-brand-slate text-lg max-w-2xl leading-relaxed">
            Training insight, mindset, and updates from Coach Anthony — every issue of the newsletter, archived and readable right here.
          </p>
        </div>
      </header>

      {issues.length === 0 ? (
        /* Empty state */
        <section className="max-w-2xl mx-auto px-6 lg:px-8">
          <div className="rounded-md border border-brand-navy/[0.08] bg-white p-12 text-center mb-12">
            <h2 className="font-display font-extrabold text-2xl uppercase tracking-tight text-brand-navy">Posts Coming Soon</h2>
            <p className="text-brand-slate mt-3">The first issue lands shortly. Subscribe below and you&rsquo;ll be the first to read it.</p>
          </div>
          <NewsletterSignup variant="band" />
        </section>
      ) : (
        <>
          {/* Featured (latest) */}
          <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-16">
            <Link href={`/blog/${featured.id}`} className="group block">
              <div className="grid md:grid-cols-2 gap-0 rounded-md overflow-hidden border border-brand-navy/[0.07] bg-white shadow-[0_10px_40px_rgba(27,45,80,0.06)] hover:shadow-[0_18px_60px_rgba(247,107,22,0.12)] transition-all duration-300">
                <div className="relative bg-brand-navy overflow-hidden min-h-[280px] flex items-center justify-center p-10 grain-overlay">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-navy to-[#0f1d38]" />
                  <div className="absolute -bottom-10 -right-6 w-56 h-56 rounded-full bg-brand-orange/20 blur-2xl" />
                  {featured.thumbnailUrl ? (
                    // Kit thumbnails are remote URLs; plain img avoids next/image domain config.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.thumbnailUrl} alt="" className="relative rounded-sm object-cover max-w-full" />
                  ) : (
                    <div className="relative text-center">
                      <Image src="/AJMfit.png" alt="" width={80} height={80} className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-[0_6px_20px_rgba(0,0,0,0.4)]" />
                      <div className="font-display font-bold text-xl uppercase tracking-[0.2em] text-white/90">Brains &amp; Gains</div>
                    </div>
                  )}
                </div>
                <div className="p-9 lg:p-10 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-display font-bold text-[11px] uppercase tracking-[0.2em] text-brand-orange bg-brand-orange/10 px-2.5 py-1 rounded-sm">Latest</span>
                    <span className="text-brand-slate text-xs">{formatIssueDate(featured.date)}</span>
                  </div>
                  <h2 className="font-display font-extrabold text-4xl uppercase tracking-[-0.02em] leading-[0.95] text-brand-navy group-hover:text-brand-orange transition-colors duration-200">
                    {featured.title}
                  </h2>
                  {featured.excerpt && <p className="mt-4 text-brand-slate leading-[1.7]">{featured.excerpt}</p>}
                  <span className="mt-6 inline-flex items-center gap-2 font-display font-bold text-sm uppercase tracking-[0.15em] text-brand-navy group-hover:gap-3 transition-all">
                    Read the post <span className="text-brand-orange">{ArrowRight}</span>
                  </span>
                </div>
              </div>
            </Link>
          </section>

          {/* Join Brains & Gains — identity + benefits + signup (merged from /newsletter) */}
          <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-16">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-10 items-center mb-8">
              <Image
                src="/BandGnewsletter.png"
                alt="Brains & Gains Newsletter"
                width={400}
                height={225}
                className="rounded-sm w-full max-w-sm mx-auto lg:mx-0 shadow-[0_10px_40px_rgba(27,45,80,0.10)]"
              />
              <div>
                <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-brand-navy">
                  What You <span className="text-brand-orange">Get</span>
                </h2>
                <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <span className="mt-1.5 shrink-0 text-[10px] text-brand-orange">◆</span>
                      <span className="text-brand-slate font-body text-sm leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <NewsletterSignup variant="band" />
          </section>

          {/* Remaining issues */}
          {rest.length > 0 && (
            <section className="max-w-5xl mx-auto px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8 border-b border-brand-navy/10 pb-4">
                <h3 className="font-display font-extrabold text-2xl uppercase tracking-tight text-brand-navy">More Issues</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/blog/${issue.id}`}
                    className="group bg-white border border-brand-navy/[0.06] rounded-md p-7 hover:border-brand-orange/30 hover:shadow-[0_10px_36px_rgba(247,107,22,0.08)] transition-all duration-300 flex flex-col"
                  >
                    <span className="text-brand-slate/70 text-xs font-display uppercase tracking-[0.15em]">{formatIssueDate(issue.date)}</span>
                    <h4 className="font-display font-bold text-xl uppercase tracking-tight mt-2 leading-tight text-brand-navy group-hover:text-brand-orange transition-colors">
                      {issue.title}
                    </h4>
                    {issue.excerpt && <p className="text-brand-slate text-sm leading-[1.7] mt-3 flex-1">{issue.excerpt}</p>}
                    <span className="mt-5 inline-flex items-center gap-1.5 font-display font-bold text-xs uppercase tracking-[0.15em] text-brand-navy group-hover:gap-2.5 transition-all">
                      Read <span className="text-brand-orange">{ArrowRight}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
