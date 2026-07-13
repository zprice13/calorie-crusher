import { useMemo, useRef, useState } from 'react'
import type { Settings, WeightEntry } from '../types'
import { kgToDisplay, weightUnitLabel } from '../types'

const W = 420
const H = 200
const PAD = { top: 14, right: 12, bottom: 24, left: 40 }

function dateToX(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/**
 * Single-series weight trend line (SVG). Follows the dataviz mark spec:
 * 2px line, ≥8px markers, hairline grid, hover crosshair + tooltip.
 * Single series, so the card title carries identity — no legend.
 */
export default function WeightChart({
  entries,
  unit,
  goalKg,
}: {
  entries: WeightEntry[]
  unit: Settings['unit']
  goalKg?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const { points, yTicks, goalY } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    const values = sorted.map((e) => kgToDisplay(e.kg, unit))
    const goal = goalKg != null ? kgToDisplay(goalKg, unit) : undefined
    const all = goal != null ? [...values, goal] : values
    let min = Math.min(...all)
    let max = Math.max(...all)
    if (max - min < 2) {
      min -= 1
      max += 1
    }
    const pad = (max - min) * 0.12
    min -= pad
    max += pad

    const xs = sorted.map((e) => dateToX(e.date))
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const xSpan = Math.max(1, xMax - xMin)

    const toX = (t: number) =>
      PAD.left + ((t - xMin) / xSpan) * (W - PAD.left - PAD.right)
    const toY = (v: number) =>
      H - PAD.bottom - ((v - min) / (max - min)) * (H - PAD.top - PAD.bottom)

    const points = sorted.map((e, i) => ({
      x: sorted.length === 1 ? W / 2 : toX(xs[i]),
      y: toY(values[i]),
      value: values[i],
      date: e.date,
    }))

    const tickCount = 4
    const yTicks = Array.from({ length: tickCount }, (_, i) => {
      const v = min + ((i + 0.5) / tickCount) * (max - min)
      return { y: toY(v), label: v.toFixed(1) }
    })

    return { points, yTicks, goalY: goal != null ? toY(goal) : null }
  }, [entries, unit, goalKg])

  if (entries.length === 0) return null

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const hovered = hover != null ? points[hover] : null

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Weight trend, ${entries.length} entries`}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="var(--gridline)" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
              {t.label}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--baseline)"
          strokeWidth="1"
        />

        {goalY != null && goalY > PAD.top && goalY < H - PAD.bottom && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={goalY} y2={goalY} stroke="var(--status-good)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W - PAD.right} y={goalY - 5} textAnchor="end" fontSize="10" fill="var(--status-good)">
              goal
            </text>
          </g>
        )}

        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--baseline)" strokeWidth="1" />
        )}

        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
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

      {hovered && wrapRef.current && (
        <div
          className="chart-tooltip"
          style={{
            // Clamp so the tooltip doesn't clip at the chart edges.
            left: `${Math.min(82, Math.max(18, (hovered.x / W) * 100))}%`,
            top: `${(hovered.y / H) * 100}%`,
          }}
        >
          {hovered.value.toFixed(1)} {weightUnitLabel(unit)} ·{' '}
          {new Date(dateToX(hovered.date)).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </div>
      )}
    </div>
  )
}
