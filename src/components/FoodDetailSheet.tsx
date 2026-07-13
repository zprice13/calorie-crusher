import { useEffect, useMemo, useState } from 'react'
import { db } from '../db'
import { MEALS, todayStr, type Food, type Meal } from '../types'
import { useToast } from './Toast'

function defaultMeal(): Meal {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 20) return 'dinner'
  return 'snacks'
}

interface Props {
  food: Food
  date?: string
  initialMeal?: Meal
  onClose: () => void
  onLogged?: () => void
}

export default function FoodDetailSheet({
  food,
  date = todayStr(),
  initialMeal,
  onClose,
  onLogged,
}: Props) {
  const toast = useToast()
  const [meal, setMeal] = useState<Meal>(initialMeal ?? defaultMeal())
  const [grams, setGrams] = useState<number>(food.servingGrams ?? 100)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const scaled = useMemo(() => {
    const f = grams / 100
    return {
      kcal: Math.round(food.per100.kcal * f),
      protein: +(food.per100.protein * f).toFixed(1),
      carbs: +(food.per100.carbs * f).toFixed(1),
      fat: +(food.per100.fat * f).toFixed(1),
    }
  }, [food, grams])

  async function log() {
    if (!grams || grams <= 0) return
    setSaving(true)
    try {
      await db.transaction('rw', db.diary, db.foods, async () => {
        await db.diary.add({
          date,
          meal,
          foodId: food.id,
          name: food.brand ? `${food.name} (${food.brand})` : food.name,
          grams,
          ...scaled,
          createdAt: Date.now(),
        })
        // Cache the product so it appears in "recent" and works offline.
        await db.foods.put({ ...food, lastUsed: Date.now() })
      })
      toast(`Logged ${scaled.kcal} kcal to ${meal}`)
      onLogged?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{food.name}</h3>
        {food.brand && <div className="muted">{food.brand}</div>}
        <div className="muted" style={{ marginTop: 6 }}>
          Per 100 g: {food.per100.kcal} kcal · P {food.per100.protein} g · C{' '}
          {food.per100.carbs} g · F {food.per100.fat} g
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label className="field" htmlFor="grams">
              Amount (g)
            </label>
            <input
              id="grams"
              type="number"
              inputMode="decimal"
              min={1}
              value={Number.isNaN(grams) ? '' : grams}
              onChange={(e) => setGrams(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="field" htmlFor="meal">
              Meal
            </label>
            <select id="meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {food.servingGrams && (
          <button
            className="secondary"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => setGrams(food.servingGrams!)}
          >
            Use serving size{food.servingLabel ? ` (${food.servingLabel})` : ''}
          </button>
        )}

        <div className="card" style={{ marginTop: 14, background: 'var(--surface-2)' }}>
          <div className="stat-value">{Number.isNaN(scaled.kcal) ? '—' : scaled.kcal}</div>
          <div className="stat-sub">
            kcal · P {scaled.protein || 0} g · C {scaled.carbs || 0} g · F {scaled.fat || 0} g
          </div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={log} disabled={saving || !grams || grams <= 0}>
            Add to diary
          </button>
        </div>
      </div>
    </div>
  )
}
