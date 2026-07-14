import { db } from '../db'
import { todayStr, type ProgressPhoto } from '../types'
import { createZip, readZip, type ZipInput } from './zip'

const BACKUP_FORMAT = 1

interface PhotoMeta {
  date: string
  createdAt: number
  file: string
}

interface BackupData {
  format: number
  exportedAt: string
  settings: unknown[]
  foods: unknown[]
  diary: unknown[]
  weights: unknown[]
  waterLogs: unknown[]
  exerciseLogs: unknown[]
  plannedExercises: unknown[]
  photos: PhotoMeta[]
}

/** Bundle every table plus photo JPEGs into a ZIP blob. */
export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  const [settings, foods, diary, weights, waterLogs, exerciseLogs, plannedExercises, photos] =
    await Promise.all([
      db.settings.toArray(),
      db.foods.toArray(),
      db.diary.toArray(),
      db.weights.toArray(),
      db.waterLogs.toArray(),
      db.exerciseLogs.toArray(),
      db.plannedExercises.toArray(),
      db.photos.toArray(),
    ])

  const entries: ZipInput[] = []
  const photoMeta: PhotoMeta[] = []
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    const file = `photos/${String(i + 1).padStart(4, '0')}_${p.date}.jpg`
    entries.push({ name: file, data: new Uint8Array(await p.blob.arrayBuffer()) })
    photoMeta.push({ date: p.date, createdAt: p.createdAt, file })
  }

  const data: BackupData = {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    settings,
    foods,
    diary: diary.map(({ id: _id, ...rest }) => rest),
    weights: weights.map(({ id: _id, ...rest }) => rest),
    waterLogs: waterLogs.map(({ id: _id, ...rest }) => rest),
    exerciseLogs: exerciseLogs.map(({ id: _id, ...rest }) => rest),
    plannedExercises: plannedExercises.map(({ id: _id, ...rest }) => rest),
    photos: photoMeta,
  }
  entries.unshift({
    name: 'data.json',
    data: new TextEncoder().encode(JSON.stringify(data, null, 2)),
  })

  return {
    blob: createZip(entries),
    filename: `calorie-crusher-backup-${todayStr()}.zip`,
  }
}

export interface RestoreCounts {
  diary: number
  weights: number
  water: number
  exercise: number
  photos: number
}

/** Replace ALL current data with the contents of a backup ZIP. */
export async function importBackup(file: File): Promise<RestoreCounts> {
  const entries = await readZip(await file.arrayBuffer())
  const raw = entries.get('data.json')
  if (!raw) throw new Error('data.json missing — not a Calorie Crusher backup')
  const data = JSON.parse(new TextDecoder().decode(raw)) as BackupData
  if (data.format !== BACKUP_FORMAT || !Array.isArray(data.diary)) {
    throw new Error('Unrecognized backup format')
  }

  const photos: Omit<ProgressPhoto, 'id'>[] = []
  for (const meta of data.photos ?? []) {
    const bytes = entries.get(meta.file)
    if (!bytes) throw new Error(`Backup is missing ${meta.file}`)
    photos.push({
      date: meta.date,
      createdAt: meta.createdAt,
      blob: new Blob([bytes as BlobPart], { type: 'image/jpeg' }),
    })
  }

  await db.transaction(
    'rw',
    [db.settings, db.foods, db.diary, db.weights, db.waterLogs, db.exerciseLogs, db.plannedExercises, db.photos],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.foods.clear(),
        db.diary.clear(),
        db.weights.clear(),
        db.waterLogs.clear(),
        db.exerciseLogs.clear(),
        db.plannedExercises.clear(),
        db.photos.clear(),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.settings.bulkAdd(data.settings as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.foods.bulkAdd(data.foods as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.diary.bulkAdd(data.diary as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.weights.bulkAdd(data.weights as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.waterLogs.bulkAdd(data.waterLogs as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.exerciseLogs.bulkAdd(data.exerciseLogs as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.plannedExercises.bulkAdd(data.plannedExercises as any)
      await db.photos.bulkAdd(photos)
    },
  )

  return {
    diary: data.diary.length,
    weights: data.weights.length,
    water: data.waterLogs.length,
    exercise: data.exerciseLogs.length,
    photos: photos.length,
  }
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
