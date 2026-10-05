import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, resetDbForTests, SETTINGS_KEY, STORES } from './db'
import { BackupError, exportBackup, importBackup } from './backup'
import type { Employer, Expense, Settings, TimeEntry } from '../domain/types'

const employer = (id: string): Employer => ({
  id, name: 'Emp ' + id, overtimeEnabled: true, archived: false, rates: [{ from: '2026-01-01', cents: 2500 }],
})
const entry = (id: string): TimeEntry => ({
  id, employerId: 'e1', start: '2026-10-05T07:00', end: '2026-10-05T15:30', breakMin: 30, rateCents: 2500,
})
const expense = (id: string, photoIds: string[] = []): Expense => ({
  id, employerId: 'e1', date: '2026-10-05', description: 'Paint', amountCents: 1234, photoIds,
})
const settings: Settings = {
  weekStartsOn: 1,
  schedule: [null, { in: '07:00', out: '15:30', breakMin: 30 }, null, null, null, null, null],
  recentPlaces: [{ lat: 42.1, lon: -71.2, label: 'Home' }],
}
const BYTES = [0, 255, 128, 1, 2, 250]

async function seed(photoBytes: Uint8Array = new Uint8Array(BYTES)) {
  const db = await getDb()
  const tx = db.transaction([...STORES], 'readwrite')
  await tx.objectStore('employers').put(employer('e1'))
  await tx.objectStore('entries').put(entry('t1'))
  await tx.objectStore('expenses').put(expense('x1', ['p1']))
  await tx.objectStore('photos').put({ id: 'p1', type: 'image/jpeg', bytes: photoBytes.buffer.slice(0) as ArrayBuffer })
  await tx.objectStore('settings').put(settings, SETTINGS_KEY)
  await tx.done
}

async function snapshot() {
  const db = await getDb()
  const photos = (await db.getAll('photos')).map((p) => ({ id: p.id, type: p.type, bytes: Array.from(new Uint8Array(p.bytes)) }))
  return {
    employers: await db.getAll('employers'),
    entries: await db.getAll('entries'),
    expenses: await db.getAll('expenses'),
    settings: await db.get('settings', SETTINGS_KEY),
    photos,
  }
}

const blob = (v: unknown) => new Blob([typeof v === 'string' ? v : JSON.stringify(v)])
const validDoc = () => ({
  version: 1, exportedAt: '2026-10-05T00:00:00.000Z',
  employers: [employer('n1')], entries: [], expenses: [], settings: null, photos: [],
})

async function expectRejectedUnchanged(file: Blob) {
  await seed()
  const before = await snapshot()
  await expect(importBackup(file)).rejects.toBeInstanceOf(BackupError)
  expect(await snapshot()).toEqual(before)
}

beforeEach(async () => {
  await resetDbForTests()
})

describe('backup', () => {
  it('round-trips all data with exact photo bytes', async () => {
    await seed()
    const before = await snapshot()
    const file = await exportBackup()
    const parsed = JSON.parse(await file.text())
    expect(parsed.version).toBe(1)
    expect(parsed.photos[0].data.startsWith('data:image/jpeg;base64,')).toBe(true)
    await resetDbForTests()
    expect(await snapshot()).not.toEqual(before)
    await importBackup(file)
    expect(await snapshot()).toEqual(before)
    expect((await snapshot()).photos[0].bytes).toEqual(BYTES)
  })

  it('replaces existing data', async () => {
    await seed()
    await importBackup(blob(validDoc()))
    const s = await snapshot()
    expect(s.employers.map((e) => e.id)).toEqual(['n1'])
    expect(s.entries).toEqual([])
    expect(s.expenses).toEqual([])
    expect(s.photos).toEqual([])
    expect(s.settings).toBeUndefined()
  })

  it('rejects invalid JSON', async () => {
    await expectRejectedUnchanged(blob('not json {'))
  })

  it('rejects a wrong version', async () => {
    await expectRejectedUnchanged(blob({ ...validDoc(), version: 2 }))
  })

  it('rejects a missing store', async () => {
    const { photos: _p, ...rest } = validDoc()
    void _p
    await expectRejectedUnchanged(blob(rest))
  })

  it('rejects malformed settings', async () => {
    const week = Array.from({ length: 7 }, () => null)
    for (const settings of [
      { weekStartsOn: 9, schedule: week, recentPlaces: [] },
      { weekStartsOn: 0, schedule: [1], recentPlaces: [] },
      { weekStartsOn: 0, schedule: week, recentPlaces: [{ lat: 'x' }] },
    ])
      await expectRejectedUnchanged(blob({ ...validDoc(), settings }))
  })

  it('rejects a record with a wrong field type', async () => {
    await expectRejectedUnchanged(blob({ ...validDoc(), entries: [{ ...entry('t9'), breakMin: '30' }] }))
  })

  it('rejects an entry with a date-only start', async () => {
    await expectRejectedUnchanged(blob({ ...validDoc(), entries: [{ ...entry('t9'), start: '2026-10-05' }] }))
  })

  it('rejects a negative expense amount', async () => {
    await expectRejectedUnchanged(blob({ ...validDoc(), expenses: [{ ...expense('x9'), amountCents: -1 }] }))
  })

  it('rejects an expense referencing a missing photo', async () => {
    await expectRejectedUnchanged(blob({ ...validDoc(), expenses: [expense('x9', ['nope'])] }))
  })

  it('rejects an employer rate with a bad from date', async () => {
    const bad = { ...employer('n2'), rates: [{ from: 'January', cents: 2500 }] }
    await expectRejectedUnchanged(blob({ ...validDoc(), employers: [bad] }))
  })

  it('rejects an undecodable photo', async () => {
    await expectRejectedUnchanged(blob({ ...validDoc(), photos: [{ id: 'p', type: 'image/png', data: 'garbage' }] }))
  })

  it('round-trips a 2 MB photo', async () => {
    const big = new Uint8Array(2 * 1024 * 1024)
    for (let i = 0; i < big.length; i++) big[i] = (i * 31) & 255
    await seed(big)
    const file = await exportBackup()
    await resetDbForTests()
    await importBackup(file)
    const db = await getDb()
    const p = await db.get('photos', 'p1')
    const got = new Uint8Array(p!.bytes)
    expect(got.length).toBe(big.length)
    expect(got.every((b, i) => b === big[i])).toBe(true)
  })
})
