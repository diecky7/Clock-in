import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from './db'
import * as repo from './repo'
import type { Employer, Expense, TimeEntry } from '../domain/types'

const entry = (id: string, start: string): TimeEntry => ({
  id, employerId: 'e1', start, end: start.slice(0, 10) + 'T15:30', breakMin: 30, rateCents: 2500,
})
const expense = (id: string, date: string, photoIds: string[] = []): Expense => ({
  id, employerId: 'e1', date, description: 'x', amountCents: 100, photoIds,
})

beforeEach(async () => {
  await resetDbForTests()
})

describe('repo', () => {
  it('lists entries only within the inclusive start-date range', async () => {
    await repo.saveEntry(entry('a', '2026-10-04T07:00'))
    await repo.saveEntry(entry('b', '2026-10-05T07:00'))
    await repo.saveEntry(entry('c', '2026-10-07T23:30'))
    await repo.saveEntry(entry('e', '2026-10-07T23:59:30'))
    await repo.saveEntry(entry('d', '2026-10-08T00:00'))
    const ids = (await repo.listEntriesBetween('2026-10-05', '2026-10-07')).map((e) => e.id)
    expect(ids).toEqual(['b', 'c', 'e'])
  })

  it('upserts and deletes entries', async () => {
    await repo.saveEntry(entry('a', '2026-10-05T07:00'))
    await repo.saveEntry({ ...entry('a', '2026-10-05T07:00'), breakMin: 15 })
    expect((await repo.getEntry('a'))?.breakMin).toBe(15)
    await repo.deleteEntry('a')
    expect(await repo.getEntry('a')).toBeUndefined()
  })

  it('lists expenses inclusive by date', async () => {
    await repo.saveExpense(expense('a', '2026-10-04'))
    await repo.saveExpense(expense('b', '2026-10-05'))
    await repo.saveExpense(expense('c', '2026-10-07'))
    await repo.saveExpense(expense('d', '2026-10-08'))
    const ids = (await repo.listExpensesBetween('2026-10-05', '2026-10-07')).map((e) => e.id)
    expect(ids).toEqual(['b', 'c'])
  })

  it('deleteExpense removes its photo blobs', async () => {
    const p1 = await repo.putPhoto(new Blob(['hello'], { type: 'image/jpeg' }))
    const p2 = await repo.putPhoto(new Blob(['world'], { type: 'image/jpeg' }))
    const keep = await repo.putPhoto(new Blob(['keep'], { type: 'image/jpeg' }))
    await repo.saveExpense(expense('x', '2026-10-05', [p1, p2]))
    const got = await repo.getPhoto(p1)
    expect(got?.type).toBe('image/jpeg')
    expect(got?.size).toBe(5)
    await repo.deleteExpense('x')
    expect(await repo.getExpense('x')).toBeUndefined()
    expect(await repo.getPhoto(p1)).toBeUndefined()
    expect(await repo.getPhoto(p2)).toBeUndefined()
    expect(await repo.getPhoto(keep)).toBeDefined()
  })

  it('deletePhoto removes a photo', async () => {
    const id = await repo.putPhoto(new Blob(['a'], { type: 'image/jpeg' }))
    await repo.deletePhoto(id)
    expect(await repo.getPhoto(id)).toBeUndefined()
  })

  it('returns default settings on a fresh DB, as fresh copies', async () => {
    const s = await repo.getSettings()
    expect(s.weekStartsOn).toBe(0)
    expect(s.recentPlaces).toEqual([])
    expect(s.schedule).toHaveLength(7)
    expect(s.schedule[0]).toBeNull()
    expect(s.schedule[6]).toBeNull()
    for (let i = 1; i <= 5; i++) expect(s.schedule[i]).toEqual({ in: '07:00', out: '15:30', breakMin: 30 })
    s.recentPlaces.push({ lat: 1, lon: 2, label: 'mutated' })
    expect((await repo.getSettings()).recentPlaces).toEqual([])
  })

  it('saves settings', async () => {
    const s = await repo.getSettings()
    await repo.saveSettings({ ...s, weekStartsOn: 1 })
    expect((await repo.getSettings()).weekStartsOn).toBe(1)
  })

  it('addRecentPlace keeps max 8 and moves repeats to the front', async () => {
    for (let i = 0; i < 10; i++) await repo.addRecentPlace({ lat: i, lon: i, label: `p${i}` })
    let s = await repo.getSettings()
    expect(s.recentPlaces).toHaveLength(8)
    expect(s.recentPlaces[0].label).toBe('p9')
    expect(s.recentPlaces[7].label).toBe('p2')
    await repo.addRecentPlace({ lat: 99, lon: 99, label: 'p5' })
    s = await repo.getSettings()
    expect(s.recentPlaces).toHaveLength(8)
    expect(s.recentPlaces[0]).toEqual({ lat: 99, lon: 99, label: 'p5' })
    expect(s.recentPlaces.filter((p) => p.label === 'p5')).toHaveLength(1)
  })

  it('round-trips employer rates', async () => {
    const e: Employer = {
      id: 'e1', name: 'Acme', overtimeEnabled: true, archived: false,
      rates: [{ from: '2026-01-01', cents: 2500 }, { from: '2026-06-01', cents: 2700 }],
    }
    await repo.saveEmployer(e)
    expect(await repo.listEmployers()).toEqual([e])
  })
})
