/** Exercise libraries for the two training categories. */

/** Free-weight and machine lifts, grouped for the picker. */
export const LIFTS: Record<'Free weights' | 'Machines', string[]> = {
  'Free weights': [
    'Bench press',
    'Incline bench press',
    'Squat',
    'Deadlift',
    'Romanian deadlift',
    'Overhead press',
    'Barbell row',
    'Dumbbell shoulder press',
    'Dumbbell curl',
    'Dumbbell fly',
    'Skull crusher',
    'Barbell shrug',
  ],
  Machines: [
    'Lat pulldown',
    'Cable row',
    'Leg press',
    'Hack squat',
    'Leg extension',
    'Leg curl',
    'Pec deck',
    'Cable fly',
    'Shoulder press machine',
    'Tricep pushdown',
    'Cable curl',
    'Calf raise',
  ],
}

export const ALL_LIFTS = [...LIFTS['Free weights'], ...LIFTS.Machines]

/** Lifting burn estimate: MET for vigorous resistance training, applied to
 * an assumed ~2.5 min per set (work + rest). Rough by design. */
export const LIFT_MET = 5.0
export const MINUTES_PER_SET = 2.5

export interface CardioExercise {
  name: string
  met: number
}

export const CARDIO: CardioExercise[] = [
  { name: 'Running', met: 9.8 },
  { name: 'Incline treadmill walk', met: 5.3 },
  { name: 'Cycling', met: 7.5 },
  { name: 'Swimming', met: 8.0 },
  { name: 'Rowing', met: 7.0 },
  { name: 'Elliptical', met: 5.0 },
  { name: 'Stair climber', met: 9.0 },
  { name: 'Jump rope', met: 11.0 },
  { name: 'HIIT circuit', met: 8.0 },
  { name: 'Hiking', met: 6.0 },
]

export interface CalisthenicsExercise {
  name: string
  met: number
}

export const CALISTHENICS: CalisthenicsExercise[] = [
  { name: 'Push-ups', met: 8.0 },
  { name: 'Pull-ups', met: 8.0 },
  { name: 'Chin-ups', met: 8.0 },
  { name: 'Dips', met: 8.0 },
  { name: 'Bodyweight squats', met: 5.0 },
  { name: 'Lunges', met: 4.0 },
  { name: 'Burpees', met: 8.0 },
  { name: 'Sit-ups', met: 8.0 },
  { name: 'Hanging leg raises', met: 8.0 },
]

/** Calisthenics burn estimate: ~3 seconds per rep. */
export const SECONDS_PER_REP = 3
