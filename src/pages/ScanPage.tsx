import { useCallback, useRef, useState } from 'react'
import { useBarcodeScanner } from '../scanner/useBarcodeScanner'
import { lookupBarcode, ProductNotFoundError } from '../api/openFoodFacts'
import { db } from '../db'
import type { Food } from '../types'
import FoodDetailSheet from '../components/FoodDetailSheet'

type LookupState =
  | { phase: 'idle' }
  | { phase: 'looking'; barcode: string }
  | { phase: 'found'; food: Food }
  | { phase: 'not-found'; barcode: string }
  | { phase: 'lookup-error'; barcode: string }

export default function ScanPage({ onLogged }: { onLogged: () => void }) {
  const [lookup, setLookup] = useState<LookupState>({ phase: 'idle' })
  const [manualCode, setManualCode] = useState('')
  // Debounce repeated detections of the same code while the camera runs.
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null)
  const busyRef = useRef(false)

  const handleBarcode = useCallback(async (barcode: string) => {
    const now = Date.now()
    const last = lastCodeRef.current
    if (busyRef.current) return
    if (last && last.code === barcode && now - last.at < 4000) return
    lastCodeRef.current = { code: barcode, at: now }
    busyRef.current = true

    if (navigator.vibrate) navigator.vibrate(60)
    setLookup({ phase: 'looking', barcode })
    try {
      // Serve from the local cache first so re-scans work offline.
      const cached = await db.foods.get(barcode)
      const food = cached ?? (await lookupBarcode(barcode))
      setLookup({ phase: 'found', food })
    } catch (e) {
      setLookup(
        e instanceof ProductNotFoundError
          ? { phase: 'not-found', barcode }
          : { phase: 'lookup-error', barcode },
      )
    } finally {
      busyRef.current = false
    }
  }, [])

  const scanner = useBarcodeScanner(handleBarcode)

  const reset = () => {
    setLookup({ phase: 'idle' })
    lastCodeRef.current = null
  }

  return (
    <div>
      <h1>Scan a barcode</h1>

      <div className="scanner-viewport">
        <video ref={scanner.videoRef} muted playsInline />
        {scanner.state === 'scanning' && (
          <>
            <div className="scan-reticle" />
            <div className="scan-line" />
          </>
        )}
        {scanner.state !== 'scanning' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 24,
              textAlign: 'center',
            }}
          >
            {scanner.state === 'error' ? (
              <span className="muted">{scanner.error}</span>
            ) : (
              <span className="muted">
                Point your camera at a UPC/EAN barcode to look up nutrition facts.
              </span>
            )}
            <button
              className="primary"
              onClick={scanner.start}
              disabled={scanner.state === 'starting'}
            >
              {scanner.state === 'starting'
                ? 'Starting camera…'
                : scanner.state === 'error'
                  ? 'Try again'
                  : 'Start camera'}
            </button>
          </div>
        )}
      </div>

      <div className="scanner-status">
        {scanner.state === 'scanning' && lookup.phase === 'idle' && 'Looking for a barcode…'}
        {lookup.phase === 'looking' && `Looking up ${lookup.barcode}…`}
        {lookup.phase === 'not-found' && (
          <span>
            Barcode <strong>{lookup.barcode}</strong> isn’t in Open Food Facts.{' '}
            <button className="danger-ghost" style={{ color: 'var(--series-1)', padding: 0 }} onClick={reset}>
              Scan again
            </button>
          </span>
        )}
        {lookup.phase === 'lookup-error' && (
          <span>
            Lookup failed — are you online?{' '}
            <button className="danger-ghost" style={{ color: 'var(--series-1)', padding: 0 }} onClick={() => handleBarcode(lookup.barcode)}>
              Retry
            </button>
          </span>
        )}
      </div>

      {scanner.state === 'scanning' && (
        <button className="secondary" style={{ width: '100%' }} onClick={scanner.stop}>
          Stop camera
        </button>
      )}

      <h2>No camera handy?</h2>
      <div className="row">
        <input
          placeholder="Enter barcode digits"
          inputMode="numeric"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
        />
        <button
          className="secondary"
          style={{ flex: '0 0 auto' }}
          disabled={manualCode.length < 8}
          onClick={() => handleBarcode(manualCode)}
        >
          Look up
        </button>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Nutrition data comes from the community-run{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" style={{ color: 'var(--series-1)' }}>
          Open Food Facts
        </a>{' '}
        database. Scanned products are cached on-device for offline re-use.
      </p>

      {lookup.phase === 'found' && (
        <FoodDetailSheet
          food={lookup.food}
          onClose={reset}
          onLogged={onLogged}
        />
      )}
    </div>
  )
}
