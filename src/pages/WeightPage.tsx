import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  DEFAULT_SETTINGS,
  displayToKg,
  kgToDisplay,
  todayStr,
  weightUnitLabel,
} from '../types'
import WeightChart from '../components/WeightChart'
import { useToast } from '../components/Toast'

export default function WeightPage() {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayStr())

  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const s = settings ?? DEFAULT_SETTINGS
  const unitLabel = weightUnitLabel(s.unit)

  const latest = weights?.length ? weights[weights.length - 1] : null
  const first = weights?.length ? weights[0] : null
  const delta =
    latest && first && latest.id !== first.id
      ? kgToDisplay(latest.kg - first.kg, s.unit)
      : null

  async function add() {
    const v = parseFloat(value)
    if (!v || v <= 0) return
    const kg = displayToKg(v, s.unit)
    // One entry per day: replace an existing entry for the same date.
    const existing = await db.weights.where('date').equals(date).first()
    if (existing) await db.weights.update(existing.id!, { kg })
    else await db.weights.add({ date, kg, createdAt: Date.now() })
    setValue('')
    toast(`Weight saved for ${date}`)
  }

  return (
    <div>
      <h1>Weight</h1>

      <div className="card">
        {latest ? (
          <>
            <div className="stat-value">
              {kgToDisplay(latest.kg, s.unit).toFixed(1)}{' '}
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{unitLabel}</span>
            </div>
            <div className="stat-sub">
              Latest ({latest.date})
              {delta != null &&
                ` · ${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${unitLabel} since ${first!.date}`}
              {s.weightGoalKg != null &&
                ` · goal ${kgToDisplay(s.weightGoalKg, s.unit).toFixed(1)} ${unitLabel}`}
            </div>
          </>
        ) : (
          <div className="muted">Log your first weigh-in to start the trend.</div>
        )}

        {weights && weights.length >= 2 && (
          <div style={{ marginTop: 12 }}>
            <WeightChart entries={weights} unit={s.unit} goalKg={s.weightGoalKg} />
          </div>
        )}
      </div>

      <h2>Log weigh-in</h2>
      <div className="card">
        <div className="row">
          <div>
            <label className="field" htmlFor="w-date">
              Date
            </label>
            <input id="w-date" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="field" htmlFor="w-val">
              Weight ({unitLabel})
            </label>
            <input
              id="w-val"
              type="number"
              inputMode="decimal"
              placeholder={s.unit === 'imperial' ? '165.0' : '75.0'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <button className="primary" style={{ width: '100%', marginTop: 12 }} onClick={add} disabled={!parseFloat(value)}>
          Save
        </button>
      </div>

      {weights && weights.length > 0 && (
        <>
          <h2>History</h2>
          <div className="card" style={{ padding: '2px 14px' }}>
            {[...weights].reverse().map((w) => (
              <div className="entry" key={w.id}>
                <div className="info">
                  <div className="name">
                    {kgToDisplay(w.kg, s.unit).toFixed(1)} {unitLabel}
                  </div>
                  <div className="detail">{w.date}</div>
                </div>
                <button aria-label={`Delete weigh-in ${w.date}`} onClick={() => db.weights.delete(w.id!)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
