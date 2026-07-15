import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  DEFAULT_SETTINGS,
  formatFoodAmount,
  GRAMS_PER_OZ,
  MEALS,
  todayStr,
  type Food,
  type Meal,
} from '../types'
import { useToast } from './Toast'

type AmountMode = 'serving' | 'oz' | 'g'

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
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const unit = (settings ?? DEFAULT_SETTINGS).unit

  const hasServing = food.servingGrams != null && food.servingGrams > 0
  const defaultMode: AmountMode = hasServing ? 'serving' : unit === 'imperial' ? 'oz' : 'g'

  const [meal, setMeal] = useState<Meal>(initialMeal ?? defaultMeal())
  // null = untouched defaults; they follow the unit setting until the user types.
  const [modeState, setModeState] = useState<AmountMode | null>(null)
  const [amountStr, setAmountStr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const mode = modeState ?? defaultMode

  const gramsPerUnit = (m: AmountMode): number =>
    m === 'serving' ? food.servingGrams! : m === 'oz' ? GRAMS_PER_OZ : 1

  const defaultAmount = mode === 'serving' ? 1 : mode === 'oz' ? 3.5 : 100
  const amount = amountStr !== null ? parseFloat(amountStr) : defaultAmount
  const grams = amount * gramsPerUnit(mode)

  /** Switch units, converting the current amount so the quantity is preserved. */
  function switchMode(next: AmountMode) {
    if (next === mode) return
    const g = Number.isNaN(grams) ? 0 : grams
    const converted = g / gramsPerUnit(next)
    const rounded =
      next === 'g' ? Math.round(converted) : +converted.toFixed(2)
    setModeState(next)
    setAmountStr(String(rounded))
  }

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

  // Reference nutrition line: per oz for imperial, per 100 g for metric.
  const ref = useMemo(() => {
    const f = unit === 'imperial' ? GRAMS_PER_OZ / 100 : 1
    return {
      label: unit === 'imperial' ? 'Per oz' : 'Per 100 g',
      kcal: Math.round(food.per100.kcal * f),
      protein: +(food.per100.protein * f).toFixed(1),
      carbs: +(food.per100.carbs * f).toFixed(1),
      fat: +(food.per100.fat * f).toFixed(1),
    }
  }, [food, unit])

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
      toast(`ORAAA! ${scaled.kcal} kcal crushed into ${meal}!`)
      onLogged?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Portaled to <body>: guarantees the modal paints above the app shell on
  // iOS, where composited scrollers can invert in-tree stacking order.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{food.name}</h3>
        {food.brand && <div className="muted">{food.brand}</div>}
        <div className="muted" style={{ marginTop: 6 }}>
          {ref.label}: {ref.kcal} kcal · P {ref.protein} g · C {ref.carbs} g · F {ref.fat} g
        </div>
        {hasServing && (
          <div className="muted" style={{ marginTop: 2 }}>
            1 serving = {food.servingLabel ?? formatFoodAmount(food.servingGrams!, unit)}
            {food.servingLabel && unit === 'imperial'
              ? ` ≈ ${formatFoodAmount(food.servingGrams!, unit)}`
              : ''}
          </div>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label className="field" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step={mode === 'serving' ? 0.5 : mode === 'oz' ? 0.1 : 1}
              value={amountStr ?? defaultAmount}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </div>
          <div>
            <label className="field" htmlFor="amount-unit">
              Unit
            </label>
            <select
              id="amount-unit"
              value={mode}
              onChange={(e) => switchMode(e.target.value as AmountMode)}
            >
              {hasServing && <option value="serving">servings</option>}
              <option value="oz">oz</option>
              <option value="g">g</option>
            </select>
          </div>
        </div>
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

        <div className="card" style={{ marginTop: 14, background: 'var(--surface-2)' }}>
          <div className="stat-value">{Number.isNaN(scaled.kcal) ? '—' : scaled.kcal}</div>
          <div className="stat-sub">
            kcal · P {scaled.protein || 0} g · C {scaled.carbs || 0} g · F {scaled.fat || 0} g
            {!Number.isNaN(grams) && grams > 0 && ` · ${formatFoodAmount(grams, unit)}`}
          </div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={log} disabled={saving || !grams || grams <= 0}>
            Consume!
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
