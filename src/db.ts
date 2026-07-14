import Dexie, { type EntityTable } from 'dexie'
import type {
  DiaryEntry,
  ExerciseLog,
  Food,
  PlannedExercise,
  ProgressPhoto,
  Settings,
  WaterLog,
  WeightEntry,
  WorkoutLog,
} from './types'
import { DEFAULT_SETTINGS } from './types'

class CrusherDB extends Dexie {
  foods!: EntityTable<Food, 'id'>
  diary!: EntityTable<DiaryEntry, 'id'>
  weights!: EntityTable<WeightEntry, 'id'>
  exerciseLogs!: EntityTable<ExerciseLog, 'id'>
  plannedExercises!: EntityTable<PlannedExercise, 'id'>
  waterLogs!: EntityTable<WaterLog, 'id'>
  photos!: EntityTable<ProgressPhoto, 'id'>
  workouts!: EntityTable<WorkoutLog, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('calorie-crusher')
    this.version(1).stores({
      foods: 'id, name, lastUsed',
      diary: '++id, date, [date+meal]',
      weights: '++id, date',
      exerciseLogs: '++id, date',
      plannedExercises: '++id, weekday',
      settings: 'id',
    })
    // v2: imperial became the app default; migrate previously saved settings
    // once. Users can still switch back to metric in Goals.
    this.version(2).upgrade((tx) =>
      tx
        .table('settings')
        .toCollection()
        .modify((s: Settings) => {
          s.unit = 'imperial'
        }),
    )
    // v3: hydration tracking.
    this.version(3).stores({
      waterLogs: '++id, date',
    })
    // v4: progress photos.
    this.version(4).stores({
      photos: '++id, date',
    })
    // v5: bodybuilder workout logs (lifts / cardio / calisthenics) replace
    // the flat exerciseLogs; legacy rows migrate as cardio sessions.
    this.version(5)
      .stores({
        workouts: '++id, date, exercise, [category+exercise]',
      })
      .upgrade(async (tx) => {
        const legacy: ExerciseLog[] = await tx.table('exerciseLogs').toArray()
        if (legacy.length > 0) {
          await tx.table('workouts').bulkAdd(
            legacy.map((e) => ({
              date: e.date,
              category: 'cardio' as const,
              exercise: e.name,
              minutes: e.minutes,
              kcalBurned: e.kcalBurned,
              createdAt: e.createdAt,
            })),
          )
          await tx.table('exerciseLogs').clear()
        }
      })
  }
}

export const db = new CrusherDB()

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'settings' })
}

/** Latest logged weight, or null. */
export async function latestWeightKg(): Promise<number | null> {
  const last = await db.weights.orderBy('date').last()
  return last?.kg ?? null
}
