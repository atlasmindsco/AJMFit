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
  shareLayout,
  shareText,
  heroStartFont,
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

/** Cut a name to fit its column, with an ellipsis so the cut is visible. */
function ellipsize(c: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (maxW <= 0) return ''
  if (c.measureText(text).width <= maxW) return text
  let cut = text
  while (cut.length > 1 && c.measureText(cut + '…').width > maxW) cut = cut.slice(0, -1)
  return cut.trimEnd() + '…'
}

/**
 * The biggest this text can be drawn and still fit between the margins.
 *
 * The hero figure is a number nobody can predict the width of: "950 LBS" and
 * "142,500 LBS" differ by four characters, and at the size this is set the
 * difference is most of the card. Hard-coding one size means either a small
 * number looks timid or a big one runs off the edge, and the edge is the one
 * that ends up on somebody's story.
 */
function fitFont(c: CanvasRenderingContext2D, text: string, maxW: number, start: number): number {
  let size = start
  for (;;) {
    c.font = `800 ${size}px Arial, Helvetica, sans-serif`
    if (c.measureText(text).width <= maxW || size <= 48) return size
    size -= 4
  }
}

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
  const card = buildShareCard(input, format)
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
  const tall = format.key === 'story'

  /* WHERE THINGS GO IS NOT DECIDED HERE.
     It is shareLayout() in lib/share-card.ts, so that every combination of the
     two formats, the optional hero figure and the optional PR bar can be
     checked to fit before anybody posts one. The only measurement this file
     contributes is how wide the hero figure comes out, which needs a canvas. */
  const heroFont = card.hero
    ? fitFont(c, card.hero.value, W - pad * 2, heroStartFont(format))
    : heroStartFont(format)
  const L = shareLayout(format, {
    hasHero: Boolean(card.hero),
    hasAchievement: Boolean(card.achievement),
    heroFont,
    // The "+2 more" line takes a row of its own, reserved by buildShareCard,
    // so what is drawn is exactly what the layout was told to expect.
    rows: card.exercises.length + (card.more ? 1 : 0),
  })

  const logo = await loadLogo()
  if (logo && logo.width > 0) {
    const lh = (logo.height / logo.width) * L.logoW
    c.drawImage(logo, cx - L.logoW / 2, L.logoY, L.logoW, lh)
  } else {
    // A missing logo must not cost somebody their post.
    c.fillStyle = INK.white
    c.font = '800 64px Arial, Helvetica, sans-serif'
    c.textAlign = 'center'
    c.fillText('AJM FIT', cx, L.logoY + 60)
  }

  // The tick, scaled whole rather than redrawn per format.
  const r = L.tickR
  const k = r / 72
  const tickMid = L.tickY + r
  c.fillStyle = INK.blue
  c.beginPath()
  c.arc(cx, tickMid, r, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = INK.white
  c.lineWidth = 14 * k
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(cx - 32 * k, tickMid + 2 * k)
  c.lineTo(cx - 10 * k, tickMid + 26 * k)
  c.lineTo(cx + 34 * k, tickMid - 26 * k)
  c.stroke()

  /* "Workout Complete" is no longer the biggest thing on the card.
     It was, at 86px, which meant the card's largest words were the two the
     client already knows — they were there. The figure below says something
     they do not know by heart, so it takes the size and this takes a step
     back to being the caption it always was. */
  c.textAlign = 'center'
  c.fillStyle = INK.white
  c.font = `800 ${L.headingFont}px Arial, Helvetica, sans-serif`
  c.fillText(card.heading, cx, L.headingY)

  c.fillStyle = INK.grey
  c.font = `400 ${L.subFont}px Arial, Helvetica, sans-serif`
  c.fillText(card.subheading, cx, L.subY)

  /* THE HERO FIGURE.
     A client's words: the thing worth posting was how much they moved, not how
     many times they moved it. Reps and sets describe the shape of a session;
     volume describes the size of it, and it is the one number on here that
     goes up over months.
     Absent entirely on a bodyweight day — see buildShareCard. The block
     collapses rather than printing a zero, and the three tiles carry the card
     on their own. */
  if (card.hero && L.heroY !== null && L.heroLabelY !== null) {
    c.fillStyle = INK.white
    c.font = `800 ${heroFont}px Arial, Helvetica, sans-serif`
    c.fillText(card.hero.value, cx, L.heroY)
    c.fillStyle = INK.orange
    c.font = `700 ${tall ? 34 : 30}px Arial, Helvetica, sans-serif`
    c.fillText(card.hero.label.toUpperCase(), cx, L.heroLabelY)
  }

  // Three tiles, matching the screen.
  const gap = 24
  const tileW = (W - pad * 2 - gap * 2) / 3
  card.stats.forEach((s, i) => {
    const x = pad + i * (tileW + gap)
    c.fillStyle = INK.card
    roundRect(c, x, L.tilesY, tileW, L.tileH, 28)
    c.fill()
    c.strokeStyle = INK.cardLine
    c.lineWidth = 2
    roundRect(c, x, L.tilesY, tileW, L.tileH, 28)
    c.stroke()

    c.fillStyle = INK.white
    // The duration is the long one; shrink only that, rather than all three.
    c.font = `800 ${s.value.length > 5 ? 50 : 62}px Arial, Helvetica, sans-serif`
    c.fillText(s.value, x + tileW / 2, L.tilesY + L.tileH * 0.52)
    c.fillStyle = INK.grey
    c.font = `400 ${tall ? 30 : 28}px Arial, Helvetica, sans-serif`
    c.fillText(s.label, x + tileW / 2, L.tilesY + L.tileH * 0.78)
  })

  if (card.achievement) {
    c.fillStyle = INK.gold
    roundRect(c, pad, L.barY, W - pad * 2, L.barH, 30)
    c.fill()
    c.fillStyle = INK.bg
    c.font = `800 ${tall ? 50 : 46}px Arial, Helvetica, sans-serif`
    c.fillText(card.achievement, cx, L.barY + L.barH * 0.645)
  }

  /* THE WORK.
     Anthony asked for this: the volume figure is the size of a session and
     the exercise list is the evidence for it. Name left, top set right, a
     hairline between — the way a training log is written down everywhere
     else, so it needs no explaining to the people who will see it.
     Left- and right-aligned rather than centred, because a centred list of
     different-length names has no edge for the eye to follow, and the whole
     point of a list is that it can be scanned. */
  if (card.exercises.length > 0 && L.listY !== null && L.listHeadY !== null) {
    c.textAlign = 'center'
    c.fillStyle = INK.grey
    c.font = `700 ${tall ? 28 : 26}px Arial, Helvetica, sans-serif`
    c.fillText('THE WORK', cx, L.listHeadY)

    card.exercises.forEach((ex, i) => {
      const rowY = L.listY! + i * L.listRowH

      // The hairline sits above each row but the first.
      if (i > 0) {
        c.strokeStyle = INK.cardLine
        c.lineWidth = 2
        c.beginPath()
        c.moveTo(pad, rowY - L.listRowH * 0.62)
        c.lineTo(W - pad, rowY - L.listRowH * 0.62)
        c.stroke()
      }

      /* The detail is measured first and the name gets whatever is left.
         A long name must lose its tail rather than run into "225 lb × 5",
         because the figure is the part somebody is posting. */
      c.font = `700 ${tall ? 32 : 29}px Arial, Helvetica, sans-serif`
      const detailW = c.measureText(ex.detail).width
      c.textAlign = 'right'
      c.fillStyle = INK.white
      c.fillText(ex.detail, W - pad, rowY)

      c.textAlign = 'left'
      c.fillStyle = INK.grey
      c.font = `400 ${tall ? 32 : 29}px Arial, Helvetica, sans-serif`
      c.fillText(ellipsize(c, ex.name, W - pad * 2 - detailW - 28), pad, rowY)
    })

    if (card.more) {
      c.textAlign = 'center'
      c.fillStyle = INK.grey
      c.font = `400 ${tall ? 28 : 26}px Arial, Helvetica, sans-serif`
      c.fillText(card.more, cx, L.listY + card.exercises.length * L.listRowH - L.listRowH * 0.2)
    }
  }

  c.fillStyle = INK.grey
  c.font = '400 34px Arial, Helvetica, sans-serif'
  c.fillText(card.site, cx, L.siteY)
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
        await nav.share({ files: [file], text: shareText(buildShareCard(input, format)) })
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
          className="w-full mt-4 h-taplg rounded-card bg-brand-bluefill text-white text-heading font-display font-bold active:scale-[0.98] disabled:opacity-50 transition-all duration-200"
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
