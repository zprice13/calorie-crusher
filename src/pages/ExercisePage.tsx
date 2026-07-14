import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, latestWeightKg } from '../db'
import {
  DEFAULT_SETTINGS,
  displayToKg,
  epley1Rm,
  kgToDisplay,
  metBurn,
  todayStr,
  weightUnitLabel,
  type PlannedExercise,
  type Settings,
  type WorkoutLog,
} from '../types'
import {
  ALL_LIFTS,
  CALISTHENICS,
  CARDIO,
  LIFT_MET,
  LIFTS,
  MINUTES_PER_SET,
  SECONDS_PER_REP,
} from '../exercises'
import { useToast } from '../components/Toast'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FALLBACK_WEIGHT_KG = 70

async function bodyWeightKg(): Promise<number> {
  return (await latestWeightKg()) ?? FALLBACK_WEIGHT_KG
}

/** Best lift per exercise by estimated 1RM. */
function liftPRs(workouts: WorkoutLog[]): Map<string, WorkoutLog> {
  const best = new Map<string, WorkoutLog>()
  for (const w of workouts) {
    if (w.category !== 'lift' || !w.weightKg || !w.reps) continue
    const current = best.get(w.exercise)
    if (!current || epley1Rm(w.weightKg, w.reps) > epley1Rm(current.weightKg!, current.reps!)) {
      best.set(w.exercise, w)
    }
  }
  return best
}

/** Best reps-in-a-set per calisthenics exercise. */
function repPRs(workouts: WorkoutLog[]): Map<string, WorkoutLog> {
  const best = new Map<string, WorkoutLog>()
  for (const w of workouts) {
    if (w.category !== 'calisthenics' || !w.reps) continue
    const current = best.get(w.exercise)
    if (!current || w.reps > (current.reps ?? 0)) best.set(w.exercise, w)
  }
  return best
}

function describeWorkout(w: WorkoutLog, unit: Settings['unit']): string {
  if (w.category === 'lift' && w.weightKg != null) {
    return `${w.sets}×${w.reps} @ ${Math.round(kgToDisplay(w.weightKg, unit))} ${weightUnitLabel(unit)}`
  }
  if (w.category === 'calisthenics') return `${w.sets}×${w.reps} reps`
  return `${w.minutes} min`
}

const CATEGORY_BADGE: Record<WorkoutLog['category'], string> = {
  lift: 'IRON',
  cardio: 'CARDIO',
  calisthenics: 'CALI',
}

export default function ExercisePage() {
  const toast = useToast()
  const today = todayStr()

  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const unit = (settings ?? DEFAULT_SETTINGS).unit
  const unitLabel = weightUnitLabel(unit)

  const todays = useLiveQuery(
    () => db.workouts.where('date').equals(today).sortBy('createdAt'),
    [today],
  )
  const allWorkouts = useLiveQuery(() => db.workouts.toArray(), [])

  const burnedToday = (todays ?? []).reduce((s, w) => s + w.kcalBurned, 0)
  const prs = useMemo(() => liftPRs(allWorkouts ?? []), [allWorkouts])
  const calisthenicsPRs = useMemo(() => repPRs(allWorkouts ?? []), [allWorkouts])

  // ---- Iron works form ----
  const [lift, setLift] = useState(ALL_LIFTS[0])
  const [liftWeight, setLiftWeight] = useState('')
  const [liftReps, setLiftReps] = useState('8')
  const [liftSets, setLiftSets] = useState('3')

  async function logLift() {
    const weight = parseFloat(liftWeight)
    const reps = parseInt(liftReps, 10)
    const sets = parseInt(liftSets, 10)
    if (!weight || !reps || !sets) return
    const weightKg = displayToKg(weight, unit)
    const bw = await bodyWeightKg()
    const kcal = metBurn(LIFT_MET, bw, sets * MINUTES_PER_SET)

    const previous = prs.get(lift)
    const isPr = !previous || epley1Rm(weightKg, reps) > epley1Rm(previous.weightKg!, previous.reps!)

    await db.workouts.add({
      date: today,
      category: 'lift',
      exercise: lift,
      weightKg,
      reps,
      sets,
      kcalBurned: kcal,
      createdAt: Date.now(),
    })
    if (navigator.vibrate && isPr) navigator.vibrate([60, 40, 120])
    toast(
      isPr
        ? `🏆 NEW PR! ${lift} ${Math.round(weight)} ${unitLabel} × ${reps}!`
        : `${lift} logged: ${sets}×${reps} @ ${Math.round(weight)} ${unitLabel}`,
    )
  }

  // ---- Engine room form ----
  const [engineMode, setEngineMode] = useState<'cardio' | 'calisthenics'>('cardio')
  const [cardioName, setCardioName] = useState(CARDIO[0].name)
  const [cardioMinutes, setCardioMinutes] = useState('30')
  const [caliName, setCaliName] = useState(CALISTHENICS[0].name)
  const [caliReps, setCaliReps] = useState('10')
  const [caliSets, setCaliSets] = useState('3')

  async function logCardio() {
    const minutes = parseInt(cardioMinutes, 10)
    const ex = CARDIO.find((c) => c.name === cardioName)
    if (!ex || !minutes) return
    const kcal = metBurn(ex.met, await bodyWeightKg(), minutes)
    await db.workouts.add({
      date: today,
      category: 'cardio',
      exercise: ex.name,
      minutes,
      kcalBurned: kcal,
      createdAt: Date.now(),
    })
    toast(`${ex.name} conquered: ~${kcal} kcal obliterated!`)
  }

  async function logCalisthenics() {
    const reps = parseInt(caliReps, 10)
    const sets = parseInt(caliSets, 10)
    const ex = CALISTHENICS.find((c) => c.name === caliName)
    if (!ex || !reps || !sets) return
    const minutes = (sets * reps * SECONDS_PER_REP) / 60
    const kcal = metBurn(ex.met, await bodyWeightKg(), minutes)

    const previous = calisthenicsPRs.get(ex.name)
    const isPr = !previous || reps > (previous.reps ?? 0)

    await db.workouts.add({
      date: today,
      category: 'calisthenics',
      exercise: ex.name,
      reps,
      sets,
      kcalBurned: kcal,
      createdAt: Date.now(),
    })
    if (navigator.vibrate && isPr) navigator.vibrate([60, 40, 120])
    toast(isPr ? `🏆 NEW REP PR! ${ex.name} × ${reps}!` : `${ex.name} logged: ${sets}×${reps}`)
  }

  // ---- Weekly cardio plan (legacy feature, still cardio-based) ----
  const [weekday, setWeekday] = useState(new Date().getDay())
  const [planActivity, setPlanActivity] = useState(CARDIO[0].name)
  const [planMinutes, setPlanMinutes] = useState('30')
  const plan = useLiveQuery(
    () => db.plannedExercises.where('weekday').equals(weekday).toArray(),
    [weekday],
  )

  async function addToPlan() {
    const mins = parseInt(planMinutes, 10)
    const act = CARDIO.find((a) => a.name === planActivity)
    if (!act || !mins || mins <= 0) return
    await db.plannedExercises.add({ weekday, name: act.name, minutes: mins, met: act.met })
    toast(`${WEEKDAYS[weekday]}'s destiny is written!`)
  }

  async function completePlanned(p: PlannedExercise) {
    const kcal = metBurn(p.met, await bodyWeightKg(), p.minutes)
    await db.workouts.add({
      date: today,
      category: 'cardio',
      exercise: p.name,
      minutes: p.minutes,
      kcalBurned: kcal,
      createdAt: Date.now(),
    })
    toast(`${p.name} conquered: ~${kcal} kcal obliterated!`)
  }

  const prList = useMemo(() => {
    const lifts = [...prs.entries()].map(([name, w]) => ({
      name,
      kind: 'lift' as const,
      w,
    }))
    const cals = [...calisthenicsPRs.entries()].map(([name, w]) => ({
      name,
      kind: 'cali' as const,
      w,
    }))
    return [...lifts, ...cals]
  }, [prs, calisthenicsPRs])

  return (
    <div>
      <h1>Training arc</h1>

      <div className="card">
        <div className="stat-value">{burnedToday}</div>
        <div className="stat-sub">
          kcal obliterated today — returned to your power budget
        </div>
      </div>

      {todays && todays.length > 0 && (
        <>
          <h2>Conquered today</h2>
          <div className="card" style={{ padding: '2px 14px' }}>
            {todays.map((w) => (
              <div className="entry" key={w.id}>
                <span className={`cat-badge cat-${w.category}`}>
                  {CATEGORY_BADGE[w.category]}
                </span>
                <div className="info">
                  <div className="name">{w.exercise}</div>
                  <div className="detail">{describeWorkout(w, unit)}</div>
                </div>
                <span className="kcal">{w.kcalBurned} kcal</span>
                <button aria-label={`Delete ${w.exercise}`} onClick={() => db.workouts.delete(w.id!)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Iron works — free weights & machines</h2>
      <div className="card">
        <label className="field" htmlFor="lift">
          Exercise
        </label>
        <select id="lift" value={lift} onChange={(e) => setLift(e.target.value)}>
          {Object.entries(LIFTS).map(([group, names]) => (
            <optgroup key={group} label={group}>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {prs.get(lift) && (
          <div className="pr-hint">
            PR: {Math.round(kgToDisplay(prs.get(lift)!.weightKg!, unit))} {unitLabel} ×{' '}
            {prs.get(lift)!.reps} (est 1RM{' '}
            {Math.round(kgToDisplay(epley1Rm(prs.get(lift)!.weightKg!, prs.get(lift)!.reps!), unit))}{' '}
            {unitLabel})
          </div>
        )}
        <div className="row">
          <div>
            <label className="field" htmlFor="lift-weight">
              Weight ({unitLabel})
            </label>
            <input
              id="lift-weight"
              type="number"
              inputMode="decimal"
              min={0}
              value={liftWeight}
              onChange={(e) => setLiftWeight(e.target.value)}
            />
          </div>
          <div>
            <label className="field" htmlFor="lift-reps">
              Reps
            </label>
            <input
              id="lift-reps"
              type="number"
              inputMode="numeric"
              min={1}
              value={liftReps}
              onChange={(e) => setLiftReps(e.target.value)}
            />
          </div>
          <div>
            <label className="field" htmlFor="lift-sets">
              Sets
            </label>
            <input
              id="lift-sets"
              type="number"
              inputMode="numeric"
              min={1}
              value={liftSets}
              onChange={(e) => setLiftSets(e.target.value)}
            />
          </div>
        </div>
        <button
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          onClick={logLift}
          disabled={!parseFloat(liftWeight) || !parseInt(liftReps, 10) || !parseInt(liftSets, 10)}
        >
          Rack the iron
        </button>
      </div>

      <h2>Engine room — cardio & calisthenics</h2>
      <div className="card">
        <div className="weekday-tabs" style={{ marginBottom: 4 }}>
          <button
            className={engineMode === 'cardio' ? 'active' : ''}
            onClick={() => setEngineMode('cardio')}
          >
            Cardio
          </button>
          <button
            className={engineMode === 'calisthenics' ? 'active' : ''}
            onClick={() => setEngineMode('calisthenics')}
          >
            Calisthenics
          </button>
        </div>

        {engineMode === 'cardio' ? (
          <>
            <label className="field" htmlFor="cardio">
              Exercise
            </label>
            <select id="cardio" value={cardioName} onChange={(e) => setCardioName(e.target.value)}>
              {CARDIO.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="field" htmlFor="cardio-min">
              Duration (minutes)
            </label>
            <input
              id="cardio-min"
              type="number"
              inputMode="numeric"
              min={1}
              value={cardioMinutes}
              onChange={(e) => setCardioMinutes(e.target.value)}
            />
            <button
              className="primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={logCardio}
              disabled={!parseInt(cardioMinutes, 10)}
            >
              Feed the engine
            </button>
          </>
        ) : (
          <>
            <label className="field" htmlFor="cali">
              Exercise
            </label>
            <select id="cali" value={caliName} onChange={(e) => setCaliName(e.target.value)}>
              {CALISTHENICS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {calisthenicsPRs.get(caliName) && (
              <div className="pr-hint">Rep PR: {calisthenicsPRs.get(caliName)!.reps} in a set</div>
            )}
            <div className="row">
              <div>
                <label className="field" htmlFor="cali-sets">
                  Sets
                </label>
                <input
                  id="cali-sets"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={caliSets}
                  onChange={(e) => setCaliSets(e.target.value)}
                />
              </div>
              <div>
                <label className="field" htmlFor="cali-reps">
                  Reps per set
                </label>
                <input
                  id="cali-reps"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={caliReps}
                  onChange={(e) => setCaliReps(e.target.value)}
                />
              </div>
            </div>
            <button
              className="primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={logCalisthenics}
              disabled={!parseInt(caliReps, 10) || !parseInt(caliSets, 10)}
            >
              Defy gravity
            </button>
          </>
        )}
        <p className="muted" style={{ marginBottom: 0, marginTop: 10, fontSize: '0.75rem' }}>
          Burn estimates use MET values and your latest logged weight
          {` (default ${Math.round(kgToDisplay(FALLBACK_WEIGHT_KG, unit))} ${unitLabel} if none logged)`}
          . Lifting burn assumes ~{MINUTES_PER_SET} min per set.
        </p>
      </div>

      {prList.length > 0 && (
        <>
          <h2>Hall of records</h2>
          <div className="card" style={{ padding: '2px 14px' }}>
            {prList.map(({ name, kind, w }) => (
              <div className="entry" key={`${kind}-${name}`}>
                <span className="pr-trophy" aria-hidden="true">
                  🏆
                </span>
                <div className="info">
                  <div className="name">{name}</div>
                  <div className="detail">
                    {kind === 'lift'
                      ? `${Math.round(kgToDisplay(w.weightKg!, unit))} ${unitLabel} × ${w.reps} · est 1RM ${Math.round(kgToDisplay(epley1Rm(w.weightKg!, w.reps!), unit))} ${unitLabel}`
                      : `${w.reps} reps in a set`}
                    {` · ${w.date}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Weekly cardio plan</h2>
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

      <div className="card" style={{ marginTop: 10 }}>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label className="field" htmlFor="plan-activity">
              Activity
            </label>
            <select
              id="plan-activity"
              value={planActivity}
              onChange={(e) => setPlanActivity(e.target.value)}
            >
              {CARDIO.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field" htmlFor="plan-minutes">
              Minutes
            </label>
            <input
              id="plan-minutes"
              type="number"
              inputMode="numeric"
              min={1}
              value={planMinutes}
              onChange={(e) => setPlanMinutes(e.target.value)}
            />
          </div>
        </div>
        <button
          className="secondary"
          style={{ width: '100%', marginTop: 12 }}
          onClick={addToPlan}
          disabled={!parseInt(planMinutes, 10)}
        >
          Add to {WEEKDAYS[weekday]} plan
        </button>
      </div>
    </div>
  )
}
