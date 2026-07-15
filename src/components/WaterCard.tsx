import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveSettings } from '../db'
import {
  DEFAULT_WATER_GOAL_ML,
  waterToDisplay,
  waterToMl,
  waterUnitLabel,
  type Settings,
} from '../types'
import { useToast } from './Toast'

const QUICK_ADDS: Record<Settings['unit'], number[]> = {
  imperial: [8, 16, 24], // fl oz — cup, bottle, big bottle
  metric: [250, 500, 750], // ml
}

/** Hydration tracker for one diary date: quick-adds, undo, wave meter. */
export default function WaterCard({ date, unit, goalMl }: {
  date: string
  unit: Settings['unit']
  goalMl?: number
}) {
  const toast = useToast()
  const logs = useLiveQuery(() => db.waterLogs.where('date').equals(date).toArray(), [date])
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalStr, setGoalStr] = useState('')

  const goal = goalMl ?? DEFAULT_WATER_GOAL_ML
  const totalMl = (logs ?? []).reduce((sum, l) => sum + l.ml, 0)
  const label = waterUnitLabel(unit)
  const total = waterToDisplay(totalMl, unit)
  const goalDisplay = waterToDisplay(goal, unit)
  const pct = Math.min(100, (totalMl / goal) * 100)
  // Compare in display units so 64/64 fl oz counts as met despite
  // sub-ml rounding differences between the total and the goal.
  const goalMet = total >= goalDisplay

  async function add(amount: number) {
    await db.waterLogs.add({ date, ml: waterToMl(amount, unit), createdAt: Date.now() })
    // Re-read from the DB: the component's total can be a render behind
    // when taps come in quickly.
    const fresh = await db.waterLogs.where('date').equals(date).toArray()
    const freshTotal = waterToDisplay(
      fresh.reduce((sum, l) => sum + l.ml, 0),
      unit,
    )
    toast(
      freshTotal >= goalDisplay
        ? 'Hydration maxed. Your cells sing!'
        : `Glug glug! +${amount} ${label} absorbed!`,
    )
  }

  async function undo() {
    const last = [...(logs ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0]
    if (last) await db.waterLogs.delete(last.id!)
  }

  async function saveGoal() {
    const v = parseFloat(goalStr)
    if (!v || v <= 0) {
      setEditingGoal(false)
      return
    }
    await saveSettings({ waterGoalMl: waterToMl(v, unit) })
    setEditingGoal(false)
    toast(`Hydration goal set: ${Math.round(v)} ${label}!`)
  }

  return (
    <div className="card water-card">
      <div className="meal-head" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Hydration protocol</h2>
        {editingGoal ? (
          <span className="water-goal-edit">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={1}
              value={goalStr}
              onChange={(e) => setGoalStr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
              aria-label={`Daily water goal (${label})`}
            />
            <button className="water-btn" onClick={saveGoal} aria-label="Save goal">
              ✓
            </button>
          </span>
        ) : (
          <button
            className="water-goal-btn"
            onClick={() => {
              setGoalStr(String(goalDisplay))
              setEditingGoal(true)
            }}
            aria-label={`Edit daily water goal (currently ${goalDisplay} ${label})`}
          >
            {total} / {goalDisplay} {label} ✎
          </button>
        )}
      </div>

      <div className="meter water-meter">
        <div style={{ width: `${pct}%` }} />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {QUICK_ADDS[unit].map((amt) => (
          <button key={amt} className="water-btn" onClick={() => add(amt)}>
            +{amt} {label}
          </button>
        ))}
        <button
          className="water-btn undo"
          onClick={undo}
          disabled={!logs || logs.length === 0}
          aria-label="Undo last water"
        >
          ↩
        </button>
      </div>

      <div className="stat-sub" style={{ marginTop: 8 }}>
        {goalMet
          ? 'Goal crushed — hydrated like a tidal wave.'
          : `${goalDisplay - total} ${label} until maximum moisture.`}
      </div>
    </div>
  )
}
