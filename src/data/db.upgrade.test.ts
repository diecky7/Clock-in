import { openDB } from 'idb'
import { expect, it } from 'vitest'
import { DB_NAME, getDb, resetDbForTests } from './db'

it('upgrading an existing version-1 database keeps its data and adds payments', async () => {
  await resetDbForTests()
  const v1 = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('employers', { keyPath: 'id' })
      db.createObjectStore('entries', { keyPath: 'id' }).createIndex('start', 'start')
      db.createObjectStore('expenses', { keyPath: 'id' }).createIndex('date', 'date')
      db.createObjectStore('photos', { keyPath: 'id' })
      db.createObjectStore('settings')
    },
  })
  await v1.put('entries', { id: 't1', employerId: 'e', start: '2026-10-05T07:00', end: '2026-10-05T15:00', breakMin: 0, rateCents: 2000 })
  v1.close()
  const db = await getDb()
  expect(await db.get('entries', 't1')).toMatchObject({ id: 't1' })
  expect(await db.getAll('payments')).toEqual([])
})
