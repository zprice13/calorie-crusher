import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  kgToDisplay,
  todayStr,
  weightUnitLabel,
  type ProgressPhoto,
  type Settings,
  type WeightEntry,
} from '../types'
import { useToast } from './Toast'

const MAX_DIM = 1280
const JPEG_QUALITY = 0.82

/** Downscale a picked image to a reasonably-sized JPEG for IndexedDB. */
async function toStoredBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  )
}

/** Weight logged on (or nearest before) the photo's date, for captions. */
function weightForDate(weights: WeightEntry[], date: string): number | null {
  let best: WeightEntry | null = null
  for (const w of weights) {
    if (w.date <= date && (!best || w.date > best.date)) best = w
  }
  return best?.kg ?? null
}

function photoCaption(
  p: ProgressPhoto,
  weights: WeightEntry[],
  unit: Settings['unit'],
): string {
  const kg = weightForDate(weights, p.date)
  return kg != null
    ? `${p.date} · ${kgToDisplay(kg, unit).toFixed(1)} ${weightUnitLabel(unit)}`
    : p.date
}

export default function ProgressPhotos({ unit }: { unit: Settings['unit'] }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null)
  const [comparing, setComparing] = useState(false)
  const [saving, setSaving] = useState(false)

  const photos = useLiveQuery(() => db.photos.orderBy('date').toArray(), [])
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])

  // Object URLs for the stored blobs, revoked when the set changes.
  const urls = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of photos ?? []) map.set(p.id!, URL.createObjectURL(p.blob))
    return map
  }, [photos])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setSaving(true)
    try {
      const blob = await toStoredBlob(file)
      await db.photos.add({ date: todayStr(), blob, createdAt: Date.now() })
      toast('Physique documented. The legend grows!')
    } catch {
      toast('Could not read that image — try another one.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: ProgressPhoto) {
    if (!window.confirm('Delete this progress photo?')) return
    await db.photos.delete(p.id!)
    setViewing(null)
  }

  const list = photos ?? []
  const first = list[0]
  const latest = list[list.length - 1]

  return (
    <>
      <h2>Gains gallery</h2>
      <div className="card">
        {list.length === 0 && (
          <div className="muted" style={{ padding: '4px 0 10px' }}>
            No evidence of the transformation yet. Document the legend.
          </div>
        )}

        {list.length > 0 && (
          <div className="photo-grid">
            {[...list].reverse().map((p) => (
              <button key={p.id} className="photo-thumb" onClick={() => setViewing(p)}>
                <img src={urls.get(p.id!)} alt={`Progress photo ${p.date}`} />
                <span>{p.date}</span>
              </button>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: list.length > 0 ? 12 : 0 }}>
          <button
            className="primary"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
          >
            {saving ? 'Processing…' : '+ Document physique'}
          </button>
          {list.length >= 2 && (
            <button className="secondary" onClick={() => setComparing(true)}>
              First vs latest
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onPicked}
        />
        <p className="muted" style={{ marginBottom: 0, marginTop: 10, fontSize: '0.75rem' }}>
          Photos never leave this device — stored alongside your data in the app's
          local database.
        </p>
      </div>

      {viewing &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setViewing(null)}>
          <div className="sheet photo-viewer" onClick={(e) => e.stopPropagation()}>
            <h3>{photoCaption(viewing, weights ?? [], unit)}</h3>
            <img src={urls.get(viewing.id!)} alt={`Progress photo ${viewing.date}`} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="secondary" onClick={() => setViewing(null)}>
                Close
              </button>
              <button className="danger-ghost" onClick={() => remove(viewing)}>
                Delete
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}

      {comparing &&
        first &&
        latest &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setComparing(false)}>
          <div className="sheet photo-viewer" onClick={(e) => e.stopPropagation()}>
            <h3>The transformation</h3>
            <div className="compare-grid">
              <figure>
                <img src={urls.get(first.id!)} alt={`First photo ${first.date}`} />
                <figcaption>{photoCaption(first, weights ?? [], unit)}</figcaption>
              </figure>
              <figure>
                <img src={urls.get(latest.id!)} alt={`Latest photo ${latest.date}`} />
                <figcaption>{photoCaption(latest, weights ?? [], unit)}</figcaption>
              </figure>
            </div>
            <button
              className="secondary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => setComparing(false)}
            >
              Close
            </button>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
