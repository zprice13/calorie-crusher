import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  addDays,
  formatDateLabel,
  KCAL_PER_GRAM,
  MEALS,
  todayStr,
  DEFAULT_SETTINGS,
  type DiaryEntry,
  type Meal,
} from '../types'
import FoodSearchSheet from '../components/FoodSearchSheet'

const MACRO_COLORS = {
  protein: 'var(--series-1)',
  carbs: 'var(--series-2)',
  fat: 'var(--series-3)',
} as const

export default function DiaryPage() {
  const [date, setDate] = useState(todayStr())
  const [addTo, setAddTo] = useState<Meal | null>(null)

  const entries = useLiveQuery(
    () => db.diary.where('date').equals(date).sortBy('createdAt'),
    [date],
  )
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const exercise = useLiveQuery(
    () => db.exerciseLogs.where('date').equals(date).toArray(),
    [date],
  )

  const s = settings ?? DEFAULT_SETTINGS
  const burned = (exercise ?? []).reduce((sum, e) => sum + e.kcalBurned, 0)

  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    for (const e of entries ?? []) {
      t.kcal += e.kcal
      t.protein += e.protein
      t.carbs += e.carbs
      t.fat += e.fat
    }
    return t
  }, [entries])

  const goalWithExercise = s.kcalGoal + burned
  const remaining = Math.round(goalWithExercise - totals.kcal)

  const macroGoals = {
    protein: (s.kcalGoal * s.proteinPct) / 100 / KCAL_PER_GRAM.protein,
    carbs: (s.kcalGoal * s.carbsPct) / 100 / KCAL_PER_GRAM.carbs,
    fat: (s.kcalGoal * s.fatPct) / 100 / KCAL_PER_GRAM.fat,
  }

  const byMeal = useMemo(() => {
    const map = new Map<Meal, DiaryEntry[]>()
    for (const m of MEALS) map.set(m, [])
    for (const e of entries ?? []) map.get(e.meal)?.push(e)
    return map
  }, [entries])

  return (
    <div>
      <div className="date-nav">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <span className="label">{formatDateLabel(date)}</span>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          ›
        </button>
      </div>

      <div className="card">
        <div className="summary-grid">
          <div>
            <div
              className="stat-value"
              style={{ color: remaining < 0 ? 'var(--status-critical)' : 'inherit' }}
            >
              {remaining}
            </div>
            <div className="stat-sub">kcal remaining</div>
            <div className="stat-sub" style={{ marginTop: 4 }}>
              {s.kcalGoal} goal − {Math.round(totals.kcal)} food
              {burned > 0 ? ` + ${burned} exercise` : ''}
            </div>
          </div>
          <div className="macro-rows">
            {(['protein', 'carbs', 'fat'] as const).map((m) => {
              const eaten = totals[m]
              const goal = macroGoals[m]
              const pct = Math.min(100, (eaten / goal) * 100 || 0)
              return (
                <div className="macro-row" key={m}>
                  <div className="macro-head">
                    <span>{m[0].toUpperCase() + m.slice(1)}</span>
                    <span>
                      {Math.round(eaten)} / {Math.round(goal)} g
                    </span>
                  </div>
                  <div className="meter">
                    <div style={{ width: `${pct}%`, background: MACRO_COLORS[m] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {MEALS.map((meal) => {
        const list = byMeal.get(meal) ?? []
        const mealKcal = Math.round(list.reduce((sum, e) => sum + e.kcal, 0))
        return (
          <section className="meal-section" key={meal}>
            <div className="meal-head">
              <h2>{meal}</h2>
              {mealKcal > 0 && <span className="kcal">{mealKcal} kcal</span>}
            </div>
            <div className="card" style={{ padding: '2px 14px' }}>
              {list.length === 0 && (
                <div className="muted" style={{ padding: '10px 0' }}>
                  Nothing logged yet
                </div>
              )}
              {list.map((e) => (
                <div className="entry" key={e.id}>
                  <div className="info">
                    <div className="name">{e.name}</div>
                    <div className="detail">
                      {e.grams} g · P {Math.round(e.protein)} · C {Math.round(e.carbs)} · F{' '}
                      {Math.round(e.fat)}
                    </div>
                  </div>
                  <span className="kcal">{Math.round(e.kcal)}</span>
                  <button
                    aria-label={`Delete ${e.name}`}
                    onClick={() => db.diary.delete(e.id!)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button className="add-food-btn" onClick={() => setAddTo(meal)}>
              + Add food
            </button>
          </section>
        )
      })}

      {addTo && (
        <FoodSearchSheet date={date} meal={addTo} onClose={() => setAddTo(null)} />
      )}
    </div>
  )
}
