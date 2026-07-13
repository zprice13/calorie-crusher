import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, latestWeightKg } from '../db'
import {
  DEFAULT_SETTINGS,
  kgToDisplay,
  metBurn,
  todayStr,
  weightUnitLabel,
  type PlannedExercise,
} from '../types'
import { useToast } from '../components/Toast'

/** Common activities with MET values (Compendium of Physical Activities). */
const ACTIVITIES: Array<{ name: string; met: number }> = [
  { name: 'Walking (brisk)', met: 4.3 },
  { name: 'Running (10 min/mile)', met: 9.8 },
  { name: 'Cycling (moderate)', met: 7.5 },
  { name: 'Swimming (laps)', met: 8.0 },
  { name: 'Weight lifting', met: 5.0 },
  { name: 'HIIT / circuit training', met: 8.0 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Rowing (moderate)', met: 7.0 },
  { name: 'Elliptical', met: 5.0 },
  { name: 'Hiking', met: 6.0 },
  { name: 'Basketball', met: 6.5 },
  { name: 'Soccer', met: 7.0 },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FALLBACK_WEIGHT_KG = 70

export default function ExercisePage() {
  const toast = useToast()
  const today = todayStr()
  const [weekday, setWeekday] = useState(new Date().getDay())
  const [activity, setActivity] = useState(ACTIVITIES[0].name)
  const [minutes, setMinutes] = useState('30')

  const plan = useLiveQuery(
    () => db.plannedExercises.where('weekday').equals(weekday).toArray(),
    [weekday],
  )
  const todaysLog = useLiveQuery(
    () => db.exerciseLogs.where('date').equals(today).toArray(),
    [today],
  )
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const unit = (settings ?? DEFAULT_SETTINGS).unit
  const burnedToday = (todaysLog ?? []).reduce((s, e) => s + e.kcalBurned, 0)

  async function weightForBurn(): Promise<number> {
    return (await latestWeightKg()) ?? FALLBACK_WEIGHT_KG
  }

  async function addToPlan() {
    const mins = parseInt(minutes, 10)
    const act = ACTIVITIES.find((a) => a.name === activity)
    if (!act || !mins || mins <= 0) return
    await db.plannedExercises.add({
      weekday,
      name: act.name,
      minutes: mins,
      met: act.met,
    })
    toast(`${WEEKDAYS[weekday]}'s destiny is written!`)
  }

  async function logNow(name: string, mins: number, met: number) {
    const kg = await weightForBurn()
    const kcal = metBurn(met, kg, mins)
    await db.exerciseLogs.add({
      date: today,
      name,
      minutes: mins,
      kcalBurned: kcal,
      createdAt: Date.now(),
    })
    toast(`${name} conquered: ~${kcal} kcal obliterated!`)
  }

  async function completePlanned(p: PlannedExercise) {
    await logNow(p.name, p.minutes, p.met)
  }

  return (
    <div>
      <h1>Training arc</h1>

      <div className="card">
        <div className="stat-value">{burnedToday}</div>
        <div className="stat-sub">
          kcal obliterated today — returned to your power budget
        </div>
      </div>

      {todaysLog && todaysLog.length > 0 && (
        <>
          <h2>Completed today</h2>
          <div className="card" style={{ padding: '2px 14px' }}>
            {todaysLog.map((e) => (
              <div className="entry" key={e.id}>
                <div className="info">
                  <div className="name">{e.name}</div>
                  <div className="detail">{e.minutes} min</div>
                </div>
                <span className="kcal">{e.kcalBurned} kcal</span>
                <button aria-label={`Delete ${e.name}`} onClick={() => db.exerciseLogs.delete(e.id!)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Weekly plan</h2>
      <div className="weekday-tabs">
        {WEEKDAYS.map((d, i) => (
          <button key={d} className={i === weekday ? 'active' : ''} onClick={() => setWeekday(i)}>
            {d}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '2px 14px' }}>
        {(plan ?? []).length === 0 && (
          <div className="muted" style={{ padding: '10px 0' }}>
            Rest day on {WEEKDAYS[weekday]}?! …Fine. Even legends must recover.
          </div>
        )}
        {(plan ?? []).map((p) => (
          <div className="entry" key={p.id}>
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="detail">{p.minutes} min · MET {p.met}</div>
            </div>
            {weekday === new Date().getDay() && (
              <button
                aria-label={`Mark ${p.name} done`}
                style={{ color: 'var(--status-good)', fontSize: '0.8rem' }}
                onClick={() => completePlanned(p)}
              >
                ✓ Done
              </button>
            )}
            <button aria-label={`Remove ${p.name} from plan`} onClick={() => db.plannedExercises.delete(p.id!)}>
              ×
            </button>
          </div>
        ))}
      </div>

      <h2>Add activity</h2>
      <div className="card">
        <label className="field" htmlFor="activity">
          Activity
        </label>
        <select id="activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
          {ACTIVITIES.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="field" htmlFor="minutes">
          Duration (minutes)
        </label>
        <input
          id="minutes"
          type="number"
          inputMode="numeric"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" onClick={addToPlan} disabled={!parseInt(minutes, 10)}>
            Add to {WEEKDAYS[weekday]} plan
          </button>
          <button
            className="primary"
            disabled={!parseInt(minutes, 10)}
            onClick={() => {
              const act = ACTIVITIES.find((a) => a.name === activity)!
              logNow(act.name, parseInt(minutes, 10), act.met)
            }}
          >
            It is done
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Burn estimates use MET values and your latest logged weight (default{' '}
          {Math.round(kgToDisplay(FALLBACK_WEIGHT_KG, unit))} {weightUnitLabel(unit)} if
          none logged).
        </p>
      </div>
    </div>
  )
}
