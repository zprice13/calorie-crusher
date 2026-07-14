import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, latestWeightKg, saveSettings } from '../db'
import {
  DEFAULT_SETTINGS,
  DEFAULT_WATER_GOAL_ML,
  displayToKg,
  estimateTdee,
  ftInToHeightCm,
  heightCmToFtIn,
  kgToDisplay,
  waterToDisplay,
  waterToMl,
  waterUnitLabel,
  weightUnitLabel,
  type Settings,
} from '../types'
import { useToast } from '../components/Toast'

function HeightFtIn({
  heightCm,
  onChange,
}: {
  heightCm?: number
  onChange: (cm: number | undefined) => void
}) {
  const current = heightCm != null ? heightCmToFtIn(heightCm) : null

  function update(ftStr: string, inStr: string) {
    const ft = parseInt(ftStr, 10)
    const inches = parseInt(inStr, 10)
    if (!ft && !inches) {
      onChange(undefined)
      return
    }
    onChange(ftInToHeightCm(ft || 0, inches || 0))
  }

  return (
    <>
      <div>
        <label className="field">Height (ft)</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={current?.ft ?? ''}
          onChange={(e) => update(e.target.value, String(current?.inches ?? ''))}
        />
      </div>
      <div>
        <label className="field">(in)</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={11}
          value={current?.inches ?? ''}
          onChange={(e) => update(String(current?.ft ?? ''), e.target.value)}
        />
      </div>
    </>
  )
}

export default function SettingsPage() {
  const toast = useToast()
  const stored = useLiveQuery(() => db.settings.get('settings'), [])
  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS)
  const [tdee, setTdee] = useState<number | null>(null)

  useEffect(() => {
    if (stored) setForm(stored)
  }, [stored])

  const unitLabel = weightUnitLabel(form.unit)
  const macroSum = form.proteinPct + form.carbsPct + form.fatPct

  function patch(p: Partial<Settings>) {
    setForm((f) => ({ ...f, ...p }))
  }

  async function computeTdee() {
    const kg = await latestWeightKg()
    if (!kg) {
      toast('Log a weight first — TDEE needs your current weight')
      return
    }
    const est = estimateTdee(form, kg)
    if (!est) {
      toast('Fill in sex, age, and height first')
      return
    }
    setTdee(est)
  }

  async function save() {
    if (macroSum !== 100) return
    await saveSettings(form)
    toast('The pact is sealed. Your destiny is set!')
  }

  return (
    <div>
      <h1>Forge your destiny</h1>

      <h2>Daily targets</h2>
      <div className="card">
        <label className="field" htmlFor="kcal-goal">
          Calorie goal (kcal/day)
        </label>
        <input
          id="kcal-goal"
          type="number"
          inputMode="numeric"
          value={form.kcalGoal || ''}
          onChange={(e) => patch({ kcalGoal: parseInt(e.target.value, 10) || 0 })}
        />

        <div className="row" style={{ marginTop: 6 }}>
          {(
            [
              ['proteinPct', 'Protein %'],
              ['carbsPct', 'Carbs %'],
              ['fatPct', 'Fat %'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="field">{label}</label>
              <input
                type="number"
                inputMode="numeric"
                value={form[key] || ''}
                onChange={(e) => patch({ [key]: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          ))}
        </div>
        {macroSum !== 100 && (
          <p className="muted" style={{ color: 'var(--status-warning)', marginBottom: 0 }}>
            Macro split adds to {macroSum}% — it must total 100%.
          </p>
        )}

        <label className="field" htmlFor="water-goal">
          Water goal ({waterUnitLabel(form.unit)})
        </label>
        <input
          id="water-goal"
          type="number"
          inputMode="numeric"
          value={waterToDisplay(form.waterGoalMl ?? DEFAULT_WATER_GOAL_ML, form.unit)}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            patch({ waterGoalMl: v > 0 ? waterToMl(v, form.unit) : undefined })
          }}
        />
      </div>

      <h2>Body & units</h2>
      <div className="card">
        <label className="field" htmlFor="unit">
          Units
        </label>
        <select
          id="unit"
          value={form.unit}
          onChange={(e) => patch({ unit: e.target.value as Settings['unit'] })}
        >
          <option value="imperial">Imperial (lb, ft/in, oz)</option>
          <option value="metric">Metric (kg, cm, g)</option>
        </select>

        <label className="field" htmlFor="weight-goal">
          Weight goal ({unitLabel})
        </label>
        <input
          id="weight-goal"
          type="number"
          inputMode="decimal"
          value={
            form.weightGoalKg != null
              ? +kgToDisplay(form.weightGoalKg, form.unit).toFixed(1)
              : ''
          }
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            patch({ weightGoalKg: v > 0 ? displayToKg(v, form.unit) : undefined })
          }}
        />
      </div>

      <h2>Consult the oracle (TDEE)</h2>
      <div className="card">
        <div className="row">
          <div>
            <label className="field">Sex</label>
            <select
              value={form.sex ?? ''}
              onChange={(e) => patch({ sex: (e.target.value || undefined) as Settings['sex'] })}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="field">Age</label>
            <input
              type="number"
              inputMode="numeric"
              value={form.age ?? ''}
              onChange={(e) => patch({ age: parseInt(e.target.value, 10) || undefined })}
            />
          </div>
          {form.unit === 'imperial' ? (
            <HeightFtIn heightCm={form.heightCm} onChange={(cm) => patch({ heightCm: cm })} />
          ) : (
            <div>
              <label className="field">Height (cm)</label>
              <input
                type="number"
                inputMode="numeric"
                value={form.heightCm ?? ''}
                onChange={(e) => patch({ heightCm: parseInt(e.target.value, 10) || undefined })}
              />
            </div>
          )}
        </div>
        <label className="field">Activity level</label>
        <select
          value={form.activityFactor ?? 1.375}
          onChange={(e) => patch({ activityFactor: parseFloat(e.target.value) })}
        >
          <option value={1.2}>Sedentary (desk job)</option>
          <option value={1.375}>Lightly active (1–3 workouts/wk)</option>
          <option value={1.55}>Moderately active (3–5 workouts/wk)</option>
          <option value={1.725}>Very active (6–7 workouts/wk)</option>
        </select>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" onClick={computeTdee}>
            Estimate TDEE
          </button>
          {tdee && (
            <button className="primary" onClick={() => patch({ kcalGoal: tdee })}>
              Use {tdee} kcal
            </button>
          )}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Mifflin-St Jeor BMR × activity, using your latest logged weight. Subtract
          ~500 kcal/day for ≈0.5 kg/week of loss.
        </p>
      </div>

      <button
        className="primary"
        style={{ width: '100%', marginTop: 16 }}
        onClick={save}
        disabled={macroSum !== 100 || !form.kcalGoal}
      >
        Seal the pact
      </button>
    </div>
  )
}
