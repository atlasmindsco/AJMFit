import Link from 'next/link'

/**
 * Empty states in the studio were bare grey text — "No posts yet", "No
 * personal records yet" — which is most of what a brand-new client sees on
 * day one. This gives every one of them the same shape: say what goes here,
 * then offer the one action that fills it.
 */
export default function EmptyState({
  title,
  line,
  actionLabel,
  actionHref,
}: {
  title: string
  line?: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="text-center py-2">
      <p className="font-display font-bold text-sm text-white/80">{title}</p>
      {line && <p className="text-white/40 text-xs font-body mt-1 max-w-[34ch] mx-auto leading-relaxed">{line}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-control bg-brand-blue text-white text-xs font-display font-bold uppercase tracking-[0.12em] hover:bg-brand-bluedark active:scale-[0.98] transition-all duration-200"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
