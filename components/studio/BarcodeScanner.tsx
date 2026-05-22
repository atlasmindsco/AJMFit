'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onDetect: (barcode: string) => void
  onClose: () => void
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>
}

interface NativeBarcodeDetectorCtor {
  new (options: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats?: () => Promise<string[]>
}

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export default function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stoppedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'starting' | 'scanning'>('starting')

  useEffect(() => {
    let zxingControls: { stop: () => void } | null = null

    async function start() {
      if (typeof window === 'undefined') return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (stoppedRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('scanning')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const NativeDetector = (window as any).BarcodeDetector as NativeBarcodeDetectorCtor | undefined

        if (NativeDetector) {
          const detector = new NativeDetector({ formats: NATIVE_FORMATS })
          const scanLoop = async () => {
            if (stoppedRef.current || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) {
                const value = codes[0].rawValue
                if (value) {
                  stoppedRef.current = true
                  onDetect(value)
                  return
                }
              }
            } catch {
              // Ignore per-frame errors and keep scanning
            }
            requestAnimationFrame(scanLoop)
          }
          scanLoop()
        } else {
          // iOS Safari fallback via @zxing/browser
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          if (stoppedRef.current || !videoRef.current) return
          const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
            if (result && !stoppedRef.current) {
              stoppedRef.current = true
              const text = result.getText()
              controls.stop()
              onDetect(text)
            }
          })
          zxingControls = controls
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.name === 'NotAllowedError'
              ? 'Camera permission denied. Enable camera access to scan.'
              : err.message
            : 'Could not start camera'
        setError(message)
      }
    }

    start()

    return () => {
      stoppedRef.current = true
      zxingControls?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [onDetect])

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-[#0F1729] rounded-2xl overflow-hidden border border-white/10">
        <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
          <h3 className="font-display font-bold text-sm text-white tracking-tight">Scan Barcode</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors duration-150"
            aria-label="Close scanner"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Reticle overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-3/4 h-1/3 max-w-xs">
              <div className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-[#F76B16] rounded-tl-lg" />
              <div className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-[#F76B16] rounded-tr-lg" />
              <div className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-[#F76B16] rounded-bl-lg" />
              <div className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-[#F76B16] rounded-br-lg" />
              {/* Scanning line */}
              {status === 'scanning' && (
                <div className="absolute left-0 right-0 top-1/2 h-px bg-[#F76B16] shadow-[0_0_8px_#F76B16] animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 text-center">
          {error ? (
            <p className="text-red-300 text-xs font-body">{error}</p>
          ) : status === 'starting' ? (
            <p className="text-white/60 text-xs font-body">Starting camera...</p>
          ) : (
            <p className="text-white/60 text-xs font-body">Point the camera at a product barcode</p>
          )}
        </div>
      </div>
    </div>
  )
}
