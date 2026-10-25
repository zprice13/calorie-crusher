import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  epley1Rm,
  kgToDisplay,
  weightUnitLabel,
  type Settings,
  type WorkoutLog,
} from '../types'

const W = 420
const H = 190
const PAD = { top: 14, right: 12, bottom: 24, left: 42 }

function dateToX(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

interface SessionPoint {
  date: string
  /** Best estimated 1RM that day, in display units. */
  e1rm: number
  /** The set-group that produced it. */
  best: WorkoutLog
}

/**
 * Per-exercise progressive-overload view: estimated-1RM trend chart
 * (same mark spec as the weight chart: 2px line, markers, hover tooltip,
 * recessive grid — single series, so the heading carries identity) plus
 * the session history.
 */
export default function ProgressionSheet({
  exercise,
  unit,
  onClose,
}: {
  exercise: string
  unit: Settings['unit']
  onClose: () => void
}) {
  const unitLabel = weightUnitLabel(unit)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const logs = useLiveQuery(
    () =>
      db.workouts
        .where('exercise')
        .equals(exercise)
        .filter((w) => w.category === 'lift' && w.weightKg != null && w.reps != null)
        .sortBy('date'),
    [exercise],
  )

  // One point per training day: the best est-1RM set that day.
  const points: SessionPoint[] = useMemo(() => {
    const byDate = new Map<string, WorkoutLog>()
    for (const w of logs ?? []) {
      const current = byDate.get(w.date)
      if (!current || epley1Rm(w.weightKg!, w.reps!) > epley1Rm(current.weightKg!, current.reps!)) {
        byDate.set(w.date, w)
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, best]) => ({
        date,
        e1rm: kgToDisplay(epley1Rm(best.weightKg!, best.reps!), unit),
        best,
      }))
  }, [logs, unit])

  const allTimeBestDate = useMemo(() => {
    let best: SessionPoint | null = null
    for (const p of points) if (!best || p.e1rm > best.e1rm) best = p
    return best?.date
  }, [points])

  const chart = useMemo(() => {
    if (points.length < 2) return null
    const values = points.map((p) => p.e1rm)
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (max - min < 2) {
      min -= 1
      max += 1
    }
    const pad = (max - min) * 0.12
    min -= pad
    max += pad

    const xs = points.map((p) => dateToX(p.date))
    const xMin = Math.min(...xs)
    const xSpan = Math.max(1, Math.max(...xs) - xMin)
    const toX = (t: number) => PAD.left + ((t - xMin) / xSpan) * (W - PAD.left - PAD.right)
    const toY = (v: number) =>
      H - PAD.bottom - ((v - min) / (max - min)) * (H - PAD.top - PAD.bottom)

    const coords = points.map((p, i) => ({ x: toX(xs[i]), y: toY(p.e1rm), ...p }))
    const yTicks = Array.from({ length: 4 }, (_, i) => {
      const v = min + ((i + 0.5) / 4) * (max - min)
      return { y: toY(v), label: Math.round(v).toString() }
    })
    return { coords, yTicks }
  }, [points])

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!chart) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    chart.coords.forEach((p, i) => {
      const d = Math.abs(p.x - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }

  const hovered = hover != null && chart ? chart.coords[hover] : null
  const sessions = [...points].reverse().slice(0, 20)

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{exercise} — the overload</h3>
        <div className="muted" style={{ marginTop: 2 }}>
          Estimated 1RM per training day ({unitLabel}, Epley)
        </div>

        {chart ? (
          <div className="chart-wrap" ref={wrapRef} style={{ marginTop: 10 }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', display: 'block', touchAction: 'none' }}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              role="img"
              aria-label={`${exercise} estimated 1RM trend, ${points.length} sessions`}
            >
              {chart.yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="var(--gridline)" strokeWidth="1" />
                  <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                    {t.label}
                  </text>
                </g>
              ))}
              <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--baseline)" strokeWidth="1" />
              {hovered && (
                <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--baseline)" strokeWidth="1" />
              )}
              <path
                d={chart.coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="var(--series-1)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {chart.coords.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hover === i ? 5 : 4}
                  fill="var(--series-1)"
                  stroke="var(--surface-1)"
                  strokeWidth="2"
                />
              ))}
            </svg>
            {hovered && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${Math.min(80, Math.max(20, (hovered.x / W) * 100))}%`,
                  top: `${(hovered.y / H) * 100}%`,
                }}
              >
                {Math.round(kgToDisplay(hovered.best.weightKg!, unit))} {unitLabel} ×{' '}
                {hovered.best.reps} → {Math.round(hovered.e1rm)} {unitLabel} ·{' '}
                {new Date(dateToX(hovered.date)).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="muted" style={{ padding: '14px 0' }}>
            {points.length === 1
              ? 'One session logged — the chart appears at two. Go earn the second point.'
              : 'No lifts logged for this exercise yet.'}
          </div>
        )}

        {sessions.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {sessions.map((p) => (
              <div className="entry" key={p.date}>
                {p.date === allTimeBestDate && (
                  <span className="pr-trophy" aria-hidden="true">
                    🏆
                  </span>
                )}
                <div className="info">
                  <div className="name">
                    {p.best.sets}×{p.best.reps} @ {Math.round(kgToDisplay(p.best.weightKg!, unit))}{' '}
                    {unitLabel}
                  </div>
                  <div className="detail">{p.date}</div>
                </div>
                <span className="kcal">
                  e1RM {Math.round(p.e1rm)} {unitLabel}
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="secondary" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  )
}
