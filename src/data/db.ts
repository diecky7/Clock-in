import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Employer, Expense, Settings, TimeEntry } from '../domain/types'

export const DB_NAME = 'clock-in'
export const DB_VERSION = 1

export const STORE_EMPLOYERS = 'employers'
export const STORE_ENTRIES = 'entries'
export const STORE_EXPENSES = 'expenses'
export const STORE_PHOTOS = 'photos'
export const STORE_SETTINGS = 'settings'
export const SETTINGS_KEY = 'main'

export const STORES = [
  STORE_EMPLOYERS,
  STORE_ENTRIES,
  STORE_EXPENSES,
  STORE_PHOTOS,
  STORE_SETTINGS,
] as const

export interface PhotoRecord {
  id: string
  type: string
  bytes: ArrayBuffer
}

export interface ClockDB extends DBSchema {
  employers: { key: string; value: Employer }
  entries: { key: string; value: TimeEntry; indexes: { start: string } }
  expenses: { key: string; value: Expense; indexes: { date: string } }
  photos: { key: string; value: PhotoRecord }
  settings: { key: string; value: Settings }
}

let dbPromise: Promise<IDBPDatabase<ClockDB>> | null = null

export function getDb(): Promise<IDBPDatabase<ClockDB>> {
  dbPromise ??= openDB<ClockDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_EMPLOYERS, { keyPath: 'id' })
      db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' }).createIndex('start', 'start')
      db.createObjectStore(STORE_EXPENSES, { keyPath: 'id' }).createIndex('date', 'date')
      db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' })
      db.createObjectStore(STORE_SETTINGS)
    },
    // iOS may kill the connection when the app is backgrounded; reopen on next use.
    terminated() {
      dbPromise = null
    },
    blocking() {
      dbPromise = null
    },
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

export async function resetDbForTests(): Promise<void> {
  if (dbPromise) {
    const p = dbPromise
    dbPromise = null
    try {
      ;(await p).close()
    } catch {
      /* ignore */
    }
  }
  await deleteDB(DB_NAME)
}
