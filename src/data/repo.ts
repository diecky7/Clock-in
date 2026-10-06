import { shiftMinutes } from '../domain/time'
import { placeKey, shortAddress } from '../location/address'
import type { Employer, Expense, Place, Settings, TimeEntry } from '../domain/types'
import {
  getDb,
  SETTINGS_KEY,
  STORE_EMPLOYERS,
  STORE_ENTRIES,
  STORE_EXPENSES,
  STORE_PHOTOS,
  STORE_SETTINGS,
} from './db'

export const DEFAULT_DAY = { in: '07:00', out: '15:30', breakMin: 30 }

export function defaultSettings(): Settings {
  const day = () => ({ ...DEFAULT_DAY })
  return {
    weekStartsOn: 0,
    schedule: [null, day(), day(), day(), day(), day(), null],
    recentPlaces: [],
  }
}

export async function listEmployers(): Promise<Employer[]> {
  return (await getDb()).getAll(STORE_EMPLOYERS)
}
export async function saveEmployer(e: Employer): Promise<void> {
  await (await getDb()).put(STORE_EMPLOYERS, e)
}

export async function listEntriesBetween(fromDate: string, toDate: string): Promise<TimeEntry[]> {
  if (fromDate > toDate) return []
  // Upper bound sorts after any `${toDate}T…` string, even with seconds.
  const range = IDBKeyRange.bound(`${fromDate}T00:00`, `${toDate}T\uffff`)
  return (await getDb()).getAllFromIndex(STORE_ENTRIES, 'start', range)
}
export async function getEntry(id: string): Promise<TimeEntry | undefined> {
  return (await getDb()).get(STORE_ENTRIES, id)
}
export async function saveEntry(e: TimeEntry): Promise<void> {
  await (await getDb()).put(STORE_ENTRIES, e)
}
export async function deleteEntry(id: string): Promise<void> {
  await (await getDb()).delete(STORE_ENTRIES, id)
}

export async function listExpensesBetween(fromDate: string, toDate: string): Promise<Expense[]> {
  if (fromDate > toDate) return []
  const range = IDBKeyRange.bound(fromDate, toDate)
  return (await getDb()).getAllFromIndex(STORE_EXPENSES, 'date', range)
}
export async function getExpense(id: string): Promise<Expense | undefined> {
  return (await getDb()).get(STORE_EXPENSES, id)
}
export async function saveExpense(e: Expense): Promise<void> {
  await (await getDb()).put(STORE_EXPENSES, e)
}
export async function deleteExpense(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction([STORE_EXPENSES, STORE_PHOTOS], 'readwrite')
  const expense = await tx.objectStore(STORE_EXPENSES).get(id)
  if (expense) {
    for (const photoId of expense.photoIds) await tx.objectStore(STORE_PHOTOS).delete(photoId)
  }
  await tx.objectStore(STORE_EXPENSES).delete(id)
  await tx.done
}

// Photos are stored as raw bytes + MIME type (robust across IndexedDB implementations).
export async function putPhoto(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  const bytes = await blobToArrayBuffer(blob)
  await (await getDb()).put(STORE_PHOTOS, { id, type: blob.type, bytes })
  return id
}
export async function getPhoto(id: string): Promise<Blob | undefined> {
  const rec = await (await getDb()).get(STORE_PHOTOS, id)
  return rec ? new Blob([rec.bytes], { type: rec.type }) : undefined
}
export async function deletePhoto(id: string): Promise<void> {
  await (await getDb()).delete(STORE_PHOTOS, id)
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
}

export async function getSettings(): Promise<Settings> {
  const s = await (await getDb()).get(STORE_SETTINGS, SETTINGS_KEY)
  return s ?? defaultSettings()
}
export async function saveSettings(s: Settings): Promise<void> {
  await (await getDb()).put(STORE_SETTINGS, s, SETTINGS_KEY)
}
export async function addRecentPlace(p: Place): Promise<void> {
  const s = await getSettings()
  const rest = s.recentPlaces.filter((x) => placeKey(x.label) !== placeKey(p.label))
  await saveSettings({ ...s, recentPlaces: [{ ...p, label: shortAddress(p.label) }, ...rest] })
}

/**
 * Every address ever worked, most recently used first, without duplicates.
 * Merges the saved address book with the places stored on past entries.
 */
export async function listAllPlaces(): Promise<Place[]> {
  const [settings, entries] = await Promise.all([getSettings(), (await getDb()).getAll(STORE_ENTRIES)])
  const seen = new Set<string>()
  const all: Place[] = []
  const add = (p: Place | undefined) => {
    if (p && !seen.has(placeKey(p.label))) {
      seen.add(placeKey(p.label))
      all.push({ ...p, label: shortAddress(p.label) })
    }
  }
  settings.recentPlaces.forEach(add)
  entries.sort((a, b) => b.start.localeCompare(a.start)).forEach((e) => add(e.place))
  return all
}

export interface PlaceHistory {
  times: number
  first: string | null
  last: string | null
  minutes: number
  employerIds: string[]
}

/** How often, when and for whom you worked at an address (matched by its label). */
export async function placeHistory(label: string): Promise<PlaceHistory> {
  const entries = (await (await getDb()).getAll(STORE_ENTRIES)).filter((e) => e.place && placeKey(e.place.label) === placeKey(label))
  const dates = entries.map((e) => e.start.slice(0, 10)).sort()
  return {
    times: entries.length,
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
    minutes: entries.reduce((sum, e) => sum + shiftMinutes(e), 0),
    employerIds: [...new Set(entries.map((e) => e.employerId))],
  }
}
