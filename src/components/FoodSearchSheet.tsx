import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { searchProducts } from '../api/openFoodFacts'
import {
  DEFAULT_SETTINGS,
  foodAmountToGrams,
  GRAMS_PER_OZ,
  type Food,
  type Meal,
  type Settings,
} from '../types'
import FoodDetailSheet from './FoodDetailSheet'

interface Props {
  date: string
  meal: Meal
  onClose: () => void
}

/** Full-screen food search: pinned search field, scrolling results,
 * recents, and a custom-food entry point. */
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
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const unit = (settings ?? DEFAULT_SETTINGS).unit

  // Escape closes this view, unless a child sheet is open (it handles its own).
  const hasChild = selected !== null || showCustom
  useEffect(() => {
    if (hasChild) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasChild, onClose])

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

  function pick(food: Food) {
    // Dismiss the keyboard before the portion sheet slides up.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    setSelected(food)
  }

  const list = results ?? recents ?? []

  // Portaled to <body> so it always paints above the app shell (iOS
  // composited scrollers can invert in-tree stacking order).
  return createPortal(
    <>
      <div className="search-overlay">
        <div className="search-head">
          <button className="search-back" onClick={onClose} aria-label="Back">
            ‹
          </button>
          <input
            autoFocus
            type="search"
            placeholder="Search foods (e.g. greek yogurt)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="muted" style={{ margin: '8px 2px' }}>
          {searching
            ? 'Searching Open Food Facts…'
            : (searchError ?? (results ? `${results.length} results` : 'Recent foods'))}
          {` · adding to ${meal}`}
        </div>

        <div className="search-results">
          {list.map((f) => (
            <button key={f.id} className="result-item" onClick={() => pick(f)}>
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
                    flex: '0 0 40px',
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
                  {unit === 'imperial'
                    ? `${Math.round((f.per100.kcal * GRAMS_PER_OZ) / 100)} kcal / oz`
                    : `${f.per100.kcal} kcal / 100 g`}
                </div>
              </div>
            </button>
          ))}
          {list.length === 0 && !searching && (
            <div className="muted" style={{ padding: '16px 2px' }}>
              {results
                ? 'Nothing found. It escaped… this time.'
                : 'Scan or search a food and it will show up here.'}
            </div>
          )}

          <button
            className="add-food-btn"
            style={{ marginTop: 12 }}
            onClick={() => {
              ;(document.activeElement as HTMLElement | null)?.blur?.()
              setShowCustom(true)
            }}
          >
            + Forge a custom food
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
        <CustomFoodView
          unit={unit}
          onCreated={(f) => {
            setShowCustom(false)
            setSelected(f)
          }}
          onClose={() => setShowCustom(false)}
        />
      )}
    </>,
    document.body,
  )
}

function CustomFoodView({
  unit,
  onCreated,
  onClose,
}: {
  unit: Settings['unit']
  onCreated: (f: Food) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function create() {
    // Values are entered per reference amount (1 oz imperial / 100 g metric)
    // but stored normalized to per-100 g.
    const refGrams = foodAmountToGrams(unit === 'imperial' ? 1 : 100, unit)
    const norm = (v: string) => ((parseFloat(v) || 0) * 100) / refGrams
    const food: Food = {
      id: `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      per100: {
        kcal: norm(kcal),
        protein: norm(protein),
        carbs: norm(carbs),
        fat: norm(fat),
      },
      source: 'custom',
      lastUsed: Date.now(),
    }
    onCreated(food)
  }

  const refLabel = unit === 'imperial' ? 'per oz' : 'per 100 g'

  return (
    <div className="search-overlay" style={{ zIndex: 26 }}>
      <div className="search-head">
        <button className="search-back" onClick={onClose} aria-label="Back">
          ‹
        </button>
        <h3 style={{ margin: 0, flex: 1 }}>Forge custom food</h3>
      </div>
      <div className="search-results">
        <div className="muted" style={{ margin: '8px 2px' }}>
          Enter nutrition {refLabel}.
        </div>
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
        <button
          className="primary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={create}
          disabled={!name.trim() || !kcal}
        >
          Continue
        </button>
      </div>
    </div>
  )
}