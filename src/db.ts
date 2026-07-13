import Dexie, { type EntityTable } from 'dexie'
import type {
  DiaryEntry,
  ExerciseLog,
  Food,
  PlannedExercise,
  Settings,
  WeightEntry,
} from './types'
import { DEFAULT_SETTINGS } from './types'

class CrusherDB extends Dexie {
  foods!: EntityTable<Food, 'id'>
  diary!: EntityTable<DiaryEntry, 'id'>
  weights!: EntityTable<WeightEntry, 'id'>
  exerciseLogs!: EntityTable<ExerciseLog, 'id'>
  plannedExercises!: EntityTable<PlannedExercise, 'id'>
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
