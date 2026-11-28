'use client'

/**
 * The one thing in this product that leaves it.
 *
 * Drawn on a canvas rather than screenshotted, because a screenshot carries
 * whatever notification happened to be on the client's status bar and is
 * whatever size their phone is. 1080 wide, the two shapes Instagram wants,
 * and the same figures the screen behind it is showing.
 *
 * Preview first, always. Nobody should find out what they posted by posting
 * it — and the file is handed to the device's own share sheet, so the app
 * never learns where it went.
 *
 * WHAT TO EXPECT ON EACH PLATFORM, honestly:
 *   iOS Safari and Android Chrome implement `navigator.share` with files, so
 *   the native sheet opens and Instagram is in it.
 *   Desktop browsers mostly do not. There, the button saves the PNG instead,
 *   which is the useful thing a desktop can do with it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  SHARE_FORMATS,
  buildShareCard,
  shareFilename,
  shareText,
  type ShareFormat,
  type ShareInput,
} from '@/lib/share-card'

/** Brand colours, repeated here because a canvas cannot read a CSS token. */
const INK = {
  bg: '#0C0F14',
  card: 'rgba(255,255,255,0.05)',
  cardLine: 'rgba(255,255,255,0.08)',
  white: '#FFFFFF',
  grey: '#9AA6B8',
  blue: '#1A7BFF',
  orange: '#F76B16',
  // Achievement gold, matching the app's PR surfaces. The card's one
  // coloured bar is a record, and a record is gold everywhere else now.
  gold: '#D4AF37',
}

const loadLogo = (): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    // A missing logo must not cost somebody their post. The card simply
    // carries the wordmark instead.
    img.onerror = () => resolve(null)
    img.src = '/AJMfit-logo.png'
  })

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

async function draw(canvas: HTMLCanvasElement, format: ShareFormat, input: ShareInput) {
  const card = buildShareCard(input)
  const { width: W, height: H } = format
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')
  if (!c) return

  c.fillStyle = INK.bg
  c.fillRect(0, 0, W, H)

  /* One soft light from the top left, which is the only decoration on the
     card. The mockup's glows around the tick and the PR bar are left off
     deliberately — see the note in the sheet below. */
  const glow = c.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, W * 0.9)
  glow.addColorStop(0, 'rgba(26,123,255,0.16)')
  glow.addColorStop(1, 'rgba(26,123,255,0)')
  c.fillStyle = glow
  c.fillRect(0, 0, W, H)

  const cx = W / 2
  const pad = 90
  // The post is shorter, so everything sits a little tighter in it.
  const tall = format.key === 'story'
  let y = tall ? 300 : 180

  const logo = await loadLogo()
  if (logo && logo.width > 0) {
    const lw = 300
    const lh = (logo.height / logo.width) * lw
    c.drawImage(logo, cx - lw / 2, y, lw, lh)
    y += lh + (tall ? 150 : 110)
  } else {
    c.fillStyle = INK.white
    c.font = '800 64px Arial, Helvetica, sans-serif'
    c.textAlign = 'center'
    c.fillText('AJM FIT', cx, y + 60)
    y += 60 + (tall ? 150 : 110)
  }

  // The tick.
  const r = 72
  c.fillStyle = INK.blue
  c.beginPath()
  c.arc(cx, y + r, r, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = INK.white
  c.lineWidth = 14
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(cx - 32, y + r + 2)
  c.lineTo(cx - 10, y + r + 26)
  c.lineTo(cx + 34, y + r - 26)
  c.stroke()
  y += r * 2 + (tall ? 96 : 72)

  c.textAlign = 'center'
  c.fillStyle = INK.white
  c.font = '800 86px Arial, Helvetica, sans-serif'
  c.fillText(card.heading, cx, y)
  y += 62

  c.fillStyle = INK.grey
  c.font = '400 46px Arial, Helvetica, sans-serif'
  c.fillText(card.subheading, cx, y)
  y += tall ? 110 : 88

  // Three tiles, matching the screen.
  const gap = 24
  const tileW = (W - pad * 2 - gap * 2) / 3
  const tileH = 190
  card.stats.forEach((s, i) => {
    const x = pad + i * (tileW + gap)
    c.fillStyle = INK.card
    roundRect(c, x, y, tileW, tileH, 28)
    c.fill()
    c.strokeStyle = INK.cardLine
    c.lineWidth = 2
    roundRect(c, x, y, tileW, tileH, 28)
    c.stroke()

    c.fillStyle = INK.white
    // The duration is the long one; shrink only that, rather than all three.
    c.font = `800 ${s.value.length > 5 ? 50 : 66}px Arial, Helvetica, sans-serif`
    c.fillText(s.value, x + tileW / 2, y + 100)
    c.fillStyle = INK.grey
    c.font = '400 30px Arial, Helvetica, sans-serif'
    c.fillText(s.label, x + tileW / 2, y + 148)
  })
  y += tileH + (tall ? 70 : 56)

  if (card.achievement) {
    const barH = 118
    c.fillStyle = INK.gold
    roundRect(c, pad, y, W - pad * 2, barH, 30)
    c.fill()
    c.fillStyle = INK.bg
    c.font = '800 50px Arial, Helvetica, sans-serif'
    c.fillText(card.achievement, cx, y + 76)
    y += barH + 56
  }

  c.fillStyle = INK.grey
  c.font = '400 34px Arial, Helvetica, sans-serif'
  c.fillText(card.site, cx, H - (tall ? 140 : 90))
}

export default function ShareSheet({
  input,
  onClose,
}: {
  input: ShareInput
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [format, setFormat] = useState<ShareFormat>(SHARE_FORMATS[0])
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    await draw(canvas, format, input)
    setPreview(canvas.toDataURL('image/png'))
  }, [format, input])

  useEffect(() => {
    void render()
  }, [render])

  const blob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current
      if (!canvas) return resolve(null)
      canvas.toBlob((b) => resolve(b), 'image/png')
    })

  const share = async () => {
    if (busy) return
    setBusy(true)
    setNote(null)
    try {
      const b = await blob()
      if (!b) throw new Error('no image')
      const file = new File([b], shareFilename(input.dayName, format.key), { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }

      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: shareText(buildShareCard(input)) })
      } else {
        // Desktop, mostly. Saving the PNG is the useful thing it can do.
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        setNote('Saved to your downloads.')
      }
    } catch (e) {
      // A cancelled share is not an error and must not look like one.
      if ((e as Error)?.name !== 'AbortError') {
        setNote('Could not share that. Press and hold the image to save it instead.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[72] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full sm:max-w-sm max-h-[92vh] overflow-y-auto bg-surface-raised border-t sm:border border-white/[0.12] rounded-t-card sm:rounded-card px-card"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-label="Share your workout"
      >
        <div className="sticky top-0 -mx-card px-card pt-3 pb-2 bg-surface-raised z-10">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" aria-hidden="true" />
        </div>

        <div className="flex gap-1.5 mt-3">
          {SHARE_FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f)}
              aria-pressed={format.key === f.key}
              className={`flex-1 h-tap rounded-control text-label font-display font-bold uppercase tracking-wide transition-colors duration-150 ${
                format.key === f.key ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-ink-3'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* The preview is the point: nobody should find out what they posted
            by posting it. On a phone it is also long-pressable, which is the
            fallback when a browser refuses the share sheet. */}
        <div className="mt-3 rounded-card overflow-hidden border border-white/[0.08] bg-black">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your workout card" className="w-full h-auto block" />
          ) : (
            <div className="aspect-[9/16] flex items-center justify-center">
              <p className="text-ink-4 text-label font-body">Drawing…</p>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {note && <p className="mt-3 text-ink-3 text-label font-body text-center">{note}</p>}

        <button
          onClick={() => void share()}
          disabled={busy || !preview}
          className="w-full mt-4 h-taplg rounded-card bg-brand-blue text-white text-heading font-display font-bold active:scale-[0.98] disabled:opacity-50 transition-all duration-200"
        >
          {busy ? 'Preparing…' : 'Share'}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 h-taplg rounded-card border border-white/[0.14] text-white text-label font-display font-bold uppercase tracking-wide active:scale-[0.98] transition-transform duration-150"
        >
          Close
        </button>
      </motion.div>
    </div>
  )
}
