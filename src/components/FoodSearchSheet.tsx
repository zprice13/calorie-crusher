import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { searchProducts } from '../api/openFoodFacts'
import type { Food, Meal } from '../types'
import FoodDetailSheet from './FoodDetailSheet'

interface Props {
  date: string
  meal: Meal
  onClose: () => void
}

/** Search sheet: recents, Open Food Facts text search, and a custom-food form. */
export default function FoodSearchSheet({ date, meal, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Food | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const recents = useLiveQuery(
    () => db.foods.orderBy('lastUsed').reverse().limit(8).toArray(),
    [],
  )

  useEffect(() => {
    abortRef.current?.abort()
    setSearchError(null)
    if (query.trim().length < 3) {
      setResults(null)
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const found = await searchProducts(query.trim(), ctrl.signal)
        setResults(found)
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setResults([])
          setSearchError('Search failed — check your connection.')
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false)
      }
    }, 450)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const list = results ?? recents ?? []

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <h3>Add food · {meal[0].toUpperCase() + meal.slice(1)}</h3>
          <input
            autoFocus
            placeholder="Search foods (e.g. greek yogurt)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginTop: 10 }}
          />
          <div className="muted" style={{ marginTop: 8 }}>
            {searching
              ? 'Searching Open Food Facts…'
              : searchError ??
                (results ? `${results.length} results` : 'Recent foods')}
          </div>

          <div>
            {list.map((f) => (
              <button key={f.id} className="result-item" onClick={() => setSelected(f)}>
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt="" />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    🍽
                  </div>
                )}
                <div className="info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="name" style={{ fontSize: '0.9rem' }}>
                    {f.name}
                  </div>
                  <div className="detail muted" style={{ fontSize: '0.75rem' }}>
                    {f.brand ? `${f.brand} · ` : ''}
                    {f.per100.kcal} kcal / 100 g
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            className="add-food-btn"
            style={{ marginTop: 12 }}
            onClick={() => setShowCustom(true)}
          >
            + Create custom food
          </button>
        </div>
      </div>

      {selected && (
        <FoodDetailSheet
          food={selected}
          date={date}
          initialMeal={meal}
          onClose={() => setSelected(null)}
          onLogged={onClose}
        />
      )}
      {showCustom && (
        <CustomFoodSheet
          onCreated={(f) => {
            setShowCustom(false)
            setSelected(f)
          }}
          onClose={() => setShowCustom(false)}
        />
      )}
    </>
  )
}

function CustomFoodSheet({
  onCreated,
  onClose,
}: {
  onCreated: (f: Food) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  function create() {
    const food: Food = {
      id: `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      per100: {
        kcal: parseFloat(kcal) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
      },
      source: 'custom',
      lastUsed: Date.now(),
    }
    onCreated(food)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Custom food</h3>
        <div className="muted">Enter nutrition per 100 g.</div>
        <label className="field">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Homemade granola" />
        <div className="row">
          <div>
            <label className="field">Calories (kcal)</label>
            <input type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </div>
          <div>
            <label className="field">Protein (g)</label>
            <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="field">Carbs (g)</label>
            <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </div>
          <div>
            <label className="field">Fat (g)</label>
            <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={create} disabled={!name.trim() || !kcal}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
