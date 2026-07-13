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
      <h1>Target acquisition</h1>

      <div className={`scanner-viewport ${scanner.state === 'scanning' ? 'thermal' : ''}`}>
        <video ref={scanner.videoRef} muted playsInline />
        {scanner.state === 'scanning' && (
          <>
            <div className="thermal-overlay" />
            <div className="scan-reticle" />
            <div className="scan-line" />
            <div className="tri-dot" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="scanner-hud">Thermal · lock-on armed</div>
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
                Aim at a UPC/EAN barcode. If it has a label, we can track it.
              </span>
            )}
            <button
              className="primary"
              onClick={scanner.start}
              disabled={scanner.state === 'starting'}
            >
              {scanner.state === 'starting'
                ? 'Powering up…'
                : scanner.state === 'error'
                  ? 'Re-engage'
                  : 'Engage thermal vision'}
            </button>
          </div>
        )}
      </div>

      <div className="scanner-status">
        {scanner.state === 'scanning' && lookup.phase === 'idle' && 'Hunting for prey (barcodes)…'}
        {lookup.phase === 'looking' && `Specimen ${lookup.barcode} acquired. Analyzing…`}
        {lookup.phase === 'not-found' && (
          <span>
            Specimen <strong>{lookup.barcode}</strong> is unknown to Open Food Facts. It
            escaped… this time.{' '}
            <button className="danger-ghost" style={{ color: 'var(--hype-2)', padding: 0 }} onClick={reset}>
              Hunt again
            </button>
          </span>
        )}
        {lookup.phase === 'lookup-error' && (
          <span>
            Lookup failed — are you online?{' '}
            <button className="danger-ghost" style={{ color: 'var(--hype-2)', padding: 0 }} onClick={() => handleBarcode(lookup.barcode)}>
              Retry
            </button>
          </span>
        )}
      </div>

      {scanner.state === 'scanning' && (
        <button className="secondary" style={{ width: '100%' }} onClick={scanner.stop}>
          Disengage
        </button>
      )}

      <h2>No camera? Type like a warrior</h2>
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
          Hunt
        </button>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Nutrition intel comes from the community-run{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" style={{ color: 'var(--hype-2)' }}>
          Open Food Facts
        </a>{' '}
        database. Captured specimens are cached on-device for offline re-hunting.
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
