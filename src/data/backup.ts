import { getDb, SETTINGS_KEY, STORES, type PhotoRecord } from './db'
import type { Employer, Expense, Settings, TimeEntry } from '../domain/types'

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

const INVALID = "This isn't a valid backup file."
const NEWER = 'This backup was made by a newer version of the app.'
const RESTORE_FAILED = "Couldn't restore the backup. Your existing data was not changed."
const CHUNK = 0x8000

interface PhotoJson { id: string; type: string; data: string }

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[])
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function exportBackup(): Promise<Blob> {
  const db = await getDb()
  const tx = db.transaction([...STORES], 'readonly')
  const [employers, entries, expenses, photoRecords, settings] = await Promise.all([
    tx.objectStore('employers').getAll(),
    tx.objectStore('entries').getAll(),
    tx.objectStore('expenses').getAll(),
    tx.objectStore('photos').getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
  ])
  await tx.done
  const photos: PhotoJson[] = photoRecords.map((p) => ({
    id: p.id,
    type: p.type,
    data: `data:${p.type};base64,${bytesToBase64(new Uint8Array(p.bytes))}`,
  }))
  const doc = { version: 1, exportedAt: new Date().toISOString(), employers, entries, expenses, settings: settings ?? null, photos }
  return new Blob([JSON.stringify(doc)], { type: 'application/json' })
}

type Rec = Record<string, unknown>
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isArr = (v: unknown): v is unknown[] => Array.isArray(v)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const isCents = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0
const isDate = (v: unknown): v is string => isStr(v) && DATE_RE.test(v)
const isDateTime = (v: unknown): v is string => isStr(v) && DATETIME_RE.test(v)

const validEmployer = (r: unknown): r is Employer =>
  isObj(r) && isStr(r.id) && isStr(r.name) && isBool(r.overtimeEnabled) && isBool(r.archived) &&
  isArr(r.rates) && r.rates.every((x) => isObj(x) && isDate(x.from) && isCents(x.cents))
const validEntry = (r: unknown): r is TimeEntry =>
  isObj(r) && isStr(r.id) && isStr(r.employerId) && r.employerId !== '' &&
  isDateTime(r.start) && isDateTime(r.end) && isCents(r.breakMin) && isCents(r.rateCents)
const validExpense = (r: unknown): r is Expense =>
  isObj(r) && isStr(r.id) && isStr(r.employerId) && isDate(r.date) && isStr(r.description) &&
  isCents(r.amountCents) && isArr(r.photoIds) && r.photoIds.every(isStr)
const validDay = (d: unknown): boolean =>
  d === null || (isObj(d) && isStr(d.in) && isStr(d.out) && isNum(d.breakMin))
const validPlace = (p: unknown): boolean => isObj(p) && isNum(p.lat) && isNum(p.lon) && isStr(p.label)
const validSettings = (r: unknown): r is Settings =>
  isObj(r) &&
  isNum(r.weekStartsOn) && Number.isInteger(r.weekStartsOn) && r.weekStartsOn >= 0 && r.weekStartsOn <= 6 &&
  isArr(r.schedule) && r.schedule.length === 7 && r.schedule.every(validDay) &&
  isArr(r.recentPlaces) && r.recentPlaces.every(validPlace)
const validPhoto = (r: unknown): r is PhotoJson =>
  isObj(r) && isStr(r.id) && isStr(r.type) && isStr(r.data)

function decodePhoto(p: PhotoJson): PhotoRecord {
  const m = /^data:[^,;]*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(p.data)
  if (!m) throw new BackupError(INVALID)
  try {
    const bytes = base64ToBytes(m[1])
    return { id: p.id, type: p.type, bytes: bytes.buffer as ArrayBuffer }
  } catch {
    throw new BackupError(INVALID)
  }
}

interface Parsed {
  employers: Employer[]
  entries: TimeEntry[]
  expenses: Expense[]
  settings: Settings | null
  photos: PhotoRecord[]
}

async function parseBackup(file: Blob): Promise<Parsed> {
  let doc: unknown
  try {
    doc = JSON.parse(await file.text())
  } catch {
    throw new BackupError(INVALID)
  }
  if (!isObj(doc) || !isNum(doc.version)) throw new BackupError(INVALID)
  if (doc.version > 1) throw new BackupError(NEWER)
  if (doc.version !== 1) throw new BackupError(INVALID)
  const { employers, entries, expenses, photos, settings } = doc
  if (!isArr(employers) || !isArr(entries) || !isArr(expenses) || !isArr(photos)) throw new BackupError(INVALID)
  if (!employers.every(validEmployer) || !entries.every(validEntry) || !expenses.every(validExpense) ||
      !photos.every(validPhoto)) throw new BackupError(INVALID)
  if (settings !== null && !validSettings(settings)) throw new BackupError(INVALID)
  const photoIds = new Set((photos as PhotoJson[]).map((p) => p.id))
  if (!(expenses as Expense[]).every((x) => x.photoIds.every((id) => photoIds.has(id)))) {
    throw new BackupError(`${INVALID} An expense refers to a photo that is missing from the file.`)
  }
  return {
    employers, entries, expenses, settings: settings ?? null,
    photos: (photos as PhotoJson[]).map(decodePhoto),
  }
}

export async function importBackup(file: Blob): Promise<void> {
  const data = await parseBackup(file)
  try {
    const db = await getDb()
    const tx = db.transaction([...STORES], 'readwrite')
    // Surface any request failure through tx.done; an abort rolls everything back.
    try {
      await Promise.all(STORES.map((s) => tx.objectStore(s).clear()))
      await Promise.all([
        ...data.employers.map((r) => tx.objectStore('employers').put(r)),
        ...data.entries.map((r) => tx.objectStore('entries').put(r)),
        ...data.expenses.map((r) => tx.objectStore('expenses').put(r)),
        ...data.photos.map((r) => tx.objectStore('photos').put(r)),
        ...(data.settings ? [tx.objectStore('settings').put(data.settings, SETTINGS_KEY)] : []),
      ])
    } catch (e) {
      try { tx.abort() } catch { /* already finished */ }
      tx.done.catch(() => {})
      throw e
    }
    await tx.done
  } catch {
    throw new BackupError(RESTORE_FAILED)
  }
}
