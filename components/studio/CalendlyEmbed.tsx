'use client'

import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://assets.calendly.com/assets/external/widget.js'

interface CalendlyApi {
  initInlineWidget: (opts: { url: string; parentElement: HTMLElement }) => void
}

/**
 * Inline Calendly scheduler. Prefills the client's name + email so the booking's
 * invitee email matches our users table, that's how /api/calendly/webhook links
 * the session back to the right client.
 */
export default function CalendlyEmbed({
  url,
  prefill,
  height = 660,
}: {
  url: string
  prefill?: { name?: string; email?: string }
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const params = new URLSearchParams({
      hide_gdpr_banner: '1',
      // Brand orange for the widget accents (no leading #).
      primary_color: 'f76b16',
    })
    if (prefill?.name) params.set('name', prefill.name)
    if (prefill?.email) params.set('email', prefill.email)
    const dataUrl = `${url}?${params.toString()}`

    const init = () => {
      const w = window as unknown as { Calendly?: CalendlyApi }
      if (w.Calendly && ref.current) {
        ref.current.innerHTML = ''
        w.Calendly.initInlineWidget({ url: dataUrl, parentElement: ref.current })
      }
    }

    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`) as HTMLScriptElement | null
    if (existing && (window as unknown as { Calendly?: CalendlyApi }).Calendly) {
      init()
    } else if (existing) {
      existing.addEventListener('load', init)
    } else {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.addEventListener('load', init)
      document.body.appendChild(s)
    }

    const node = ref.current
    return () => {
      if (node) node.innerHTML = ''
      existing?.removeEventListener('load', init)
    }
  }, [url, prefill?.name, prefill?.email])

  return (
    <div
      ref={ref}
      className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06]"
      style={{ minWidth: 320, height }}
    />
  )
}
