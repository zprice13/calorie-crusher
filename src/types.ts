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
  /** True when the user has corrected the nutrition facts locally. */
  edited?: boolean
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

/** One water intake event; ml internally, fl oz in the imperial UI. */
export interface WaterLog {
  id?: number
  date: string
  ml: number
  createdAt: number
}

/** A progress photo, stored on-device as a downscaled JPEG blob. */
export interface ProgressPhoto {
  id?: number
  date: string
  blob: Blob
  createdAt: number
}

/** Legacy pre-v5 workout record; migrated into WorkoutLog. */
export interface ExerciseLog {
  id?: number
  date: string
  name: string
  minutes: number
  kcalBurned: number
  createdAt: number
}

export type WorkoutCategory = 'lift' | 'cardio' | 'calisthenics'

/** One logged workout: a lift set-group, a cardio session, or a calisthenics set-group. */
export interface WorkoutLog {
  id?: number
  date: string
  category: WorkoutCategory
  exercise: string
  /** Lifts: load in kg (displayed per unit setting). */
  weightKg?: number
  /** Lifts & calisthenics: reps per set. */
  reps?: number
  /** Lifts & calisthenics: number of sets. */
  sets?: number
  /** Cardio: duration. */
  minutes?: number
  kcalBurned: number
  createdAt: number
}

/** Epley estimated one-rep max. */
export function epley1Rm(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30)
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
  /** Daily water goal in ml. */
  waterGoalMl?: number
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
  unit: 'imperial',
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
export const GRAMS_PER_OZ = 28.349523125
export const CM_PER_IN = 2.54
export const ML_PER_FLOZ = 29.5735295625

/** 64 fl oz — the classic "eight 8-oz glasses". */
export const DEFAULT_WATER_GOAL_ML = Math.round(64 * ML_PER_FLOZ)

export function waterToDisplay(ml: number, unit: Settings['unit']): number {
  return unit === 'imperial' ? Math.round(ml / ML_PER_FLOZ) : Math.round(ml)
}

export function waterToMl(value: number, unit: Settings['unit']): number {
  return unit === 'imperial' ? value * ML_PER_FLOZ : value
}

export function waterUnitLabel(unit: Settings['unit']): string {
  return unit === 'imperial' ? 'fl oz' : 'ml'
}

/** Food amounts are stored in grams; imperial users see/enter ounces. */
export function foodAmountToGrams(value: number, unit: Settings['unit']): number {
  return unit === 'imperial' ? value * GRAMS_PER_OZ : value
}

export function gramsToFoodAmount(grams: number, unit: Settings['unit']): number {
  return unit === 'imperial' ? grams / GRAMS_PER_OZ : grams
}

export function foodAmountLabel(unit: Settings['unit']): string {
  return unit === 'imperial' ? 'oz' : 'g'
}

/** e.g. 15 g → "0.5 oz" (imperial) or "15 g" (metric). */
export function formatFoodAmount(grams: number, unit: Settings['unit']): string {
  if (unit === 'imperial') {
    const oz = grams / GRAMS_PER_OZ
    return `${oz >= 10 ? Math.round(oz) : +oz.toFixed(1)} oz`
  }
  return `${grams >= 10 ? Math.round(grams) : +grams.toFixed(1)} g`
}

export function heightCmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / CM_PER_IN
  const ft = Math.floor(totalIn / 12)
  return { ft, inches: Math.round(totalIn - ft * 12) }
}

export function ftInToHeightCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_IN
}

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
