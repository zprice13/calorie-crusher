import { useCallback, useEffect, useRef, useState } from 'react'

/** UPC/EAN formats used on food packaging. */
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): NativeBarcodeDetector
      getSupportedFormats(): Promise<string[]>
    }
  }
}

export type ScannerState = 'idle' | 'starting' | 'scanning' | 'error'

export interface BarcodeScanner {
  videoRef: React.RefObject<HTMLVideoElement>
  state: ScannerState
  error: string | null
  /** Which decoding engine is active, for display/debugging. */
  engine: 'native' | 'zxing' | null
  start: () => void
  stop: () => void
}

/**
 * Streams the rear camera into the provided <video> and invokes onDetect with
 * each decoded UPC/EAN string. Prefers the platform BarcodeDetector API and
 * falls back to ZXing (pure JS) where it's unavailable (e.g. iOS Safari).
 */
export function useBarcodeScanner(onDetect: (barcode: string) => void): BarcodeScanner {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<ScannerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null)

  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const cleanupRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setState('idle')
    setEngine(null)
  }, [])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video || cleanupRef.current) return
    setState('starting')
    setError(null)

    let cancelled = false
    const disposers: Array<() => void> = []
    cleanupRef.current = () => {
      cancelled = true
      disposers.forEach((d) => d())
    }

    try {
      const useNative =
        window.BarcodeDetector != null &&
        (await window.BarcodeDetector.getSupportedFormats().catch(() => [])).some(
          (f) => NATIVE_FORMATS.includes(f),
        )

      if (useNative) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        })
        disposers.push(() => stream.getTracks().forEach((t) => t.stop()))
        if (cancelled) return
        video.srcObject = stream
        await video.play()

        const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS })
        let rafId = 0
        disposers.push(() => cancelAnimationFrame(rafId))
        const scanFrame = async () => {
          if (cancelled) return
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              const codes = await detector.detect(video)
              if (cancelled) return
              if (codes.length > 0) onDetectRef.current(codes[0].rawValue)
            } catch {
              // Detection errors on individual frames are non-fatal.
            }
          }
          rafId = requestAnimationFrame(scanFrame)
        }
        setEngine('native')
        setState('scanning')
        scanFrame()
      } else {
        // ZXing is ~500 kB, so it's split out and only fetched on platforms
        // without a native BarcodeDetector (e.g. iOS Safari, Firefox).
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType, NotFoundException }] =
          await Promise.all([import('@zxing/browser'), import('@zxing/library')])
        if (cancelled) return
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ])
        const reader = new BrowserMultiFormatReader(hints)
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false },
          video,
          (result, err) => {
            if (cancelled) return
            if (result) onDetectRef.current(result.getText())
            else if (err && !(err instanceof NotFoundException)) {
              console.warn('ZXing decode error', err)
            }
          },
        )
        disposers.push(() => controls.stop())
        if (cancelled) {
          controls.stop()
          return
        }
        setEngine('zxing')
        setState('scanning')
      }
    } catch (e) {
      cleanupRef.current?.()
      cleanupRef.current = null
      if (cancelled) return
      const name = e instanceof DOMException ? e.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Enable camera access for this site and try again.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : 'Could not start the camera. Note: the camera requires HTTPS (or localhost).',
      )
      setState('error')
    }
  }, [])

  useEffect(() => stop, [stop])

  return { videoRef, state, error, engine, start, stop }
}
