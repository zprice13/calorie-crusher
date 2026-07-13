export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks']

/** Nutrition per 100 g (or per 100 ml for liquids). */
export interface NutritionPer100 {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
}

/** A food product, either scanned/looked up from Open Food Facts or user-created. */
export interface Food {
  /** Barcode for scanned products, `custom-<uuid>` for manual entries. */
  id: string
  name: string
  brand?: string
  per100: NutritionPer100
  /** Typical serving size in grams, if known. */
  servingGrams?: number
  servingLabel?: string
  source: 'openfoodfacts' | 'custom'
  imageUrl?: string
  lastUsed: number
}

/** One logged food in the diary. Macros are denormalized (computed at log time). */
export interface DiaryEntry {
  id?: number
  /** Local date, YYYY-MM-DD. */
  date: string
  meal: Meal
  foodId?: string
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
}

export interface WeightEntry {
  id?: number
  date: string
  /** Kilograms internally; UI converts for display. */
  kg: number
  createdAt: number
}

/** A completed workout that credits burned calories to a day. */
export interface ExerciseLog {
  id?: number
  date: string
  name: string
  minutes: number
  kcalBurned: number
  createdAt: number
}

/** A recurring planned workout on a weekday (0 = Sunday). */
export interface PlannedExercise {
  id?: number
  weekday: number
  name: string
  minutes: number
  /** Metabolic equivalent used to estimate burn from body weight. */
  met: number
}

export interface Settings {
  id: 'settings'
  kcalGoal: number
  /** Macro split as percent of calories; should sum to 100. */
  proteinPct: number
  carbsPct: number
  fatPct: number
  weightGoalKg?: number
  unit: 'metric' | 'imperial'
  /** Profile for TDEE estimation (optional). */
  sex?: 'male' | 'female'
  age?: number
  heightCm?: number
  activityFactor?: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  kcalGoal: 2000,
  proteinPct: 30,
  carbsPct: 40,
  fatPct: 30,
  unit: 'metric',
  activityFactor: 1.375,
}

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return todayStr(dt)
}

export function formatDateLabel(date: string): string {
  const today = todayStr()
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  if (date === addDays(today, 1)) return 'Tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export const KG_PER_LB = 0.45359237

export function kgToDisplay(kg: number, unit: Settings['unit']): number {
  return unit === 'imperial' ? kg / KG_PER_LB : kg
}

export function displayToKg(value: number, unit: Settings['unit']): number {
  return unit === 'imperial' ? value * KG_PER_LB : value
}

export function weightUnitLabel(unit: Settings['unit']): string {
  return unit === 'imperial' ? 'lb' : 'kg'
}

/** Calories burned via MET formula: MET × 3.5 × kg / 200 per minute. */
export function metBurn(met: number, weightKg: number, minutes: number): number {
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes)
}

/** Mifflin-St Jeor BMR × activity factor. */
export function estimateTdee(s: Settings, weightKg: number): number | null {
  if (!s.sex || !s.age || !s.heightCm || !weightKg) return null
  const bmr =
    10 * weightKg + 6.25 * s.heightCm - 5 * s.age + (s.sex === 'male' ? 5 : -161)
  return Math.round(bmr * (s.activityFactor ?? 1.375))
}
