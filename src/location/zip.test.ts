import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import { fixPlaceZip, setZipLoader } from './zip'

beforeAll(() => {
  setZipLoader(async (st) => JSON.parse(readFileSync(`public/zips/${st}.json`, 'utf8')))
})
afterAll(() => {
  setZipLoader(() => Promise.reject(new Error('no ZIP list in tests')))
})
beforeEach(async () => {
  await resetDbForTests()
})

describe('ZIP check', () => {
  it('fixes a wrong ZIP from map data (54 Nell Rd, Revere: 01251 → 02151)', async () => {
    const fixed = await fixPlaceZip({
      lat: 42.4206,
      lon: -71.0115,
      label: '54 Nell Rd, Revere, MA 01251',
      detail: { number: '54', street: 'Nell Road', city: 'Revere', state: 'Massachusetts', zip: '01251' },
    })
    expect(fixed.label).toBe('54 Nell Rd, Revere, MA 02151')
    expect(fixed.detail?.zip).toBe('02151')
  })

  it('replaces a PO-box-only ZIP on a street address (12 Shady Lane Dr, Burlington: 01805 → 01803)', async () => {
    const fixed = await fixPlaceZip({ lat: 42.4955, lon: -71.2028, label: '12 Shady Ln Dr, Burlington, MA 01805' })
    expect(fixed.label).toBe('12 Shady Ln Dr, Burlington, MA 01803')
  })

  it('keeps a correct ZIP, including a Boston neighborhood ZIP, as the same object', async () => {
    const fram = { lat: 42.2793, lon: -71.4162, label: '12 Main St, Framingham, MA 01702' }
    expect(await fixPlaceZip(fram)).toBe(fram)
    const dorchester = { lat: 42.2876, lon: -71.0699, label: '5 Adams St, Boston, MA 02124' }
    expect(await fixPlaceZip(dorchester)).toBe(dorchester)
  })

  it('fills a missing ZIP from the city', async () => {
    const fixed = await fixPlaceZip({ lat: 42.4955, lon: -71.2028, label: '12 Shady Ln Dr, Burlington, MA' })
    expect(fixed.label).toBe('12 Shady Ln Dr, Burlington, MA 01803')
  })

  it('drops a ZIP that does not exist when nothing nearby can replace it', async () => {
    const fixed = await fixPlaceZip({ lat: 41.0, lon: -69.0, label: '1 Sea St, Nowhere, MA 99999' })
    expect(fixed.label).toBe('1 Sea St, Nowhere, MA')
  })

  it('leaves places without a US state alone', async () => {
    const p = { lat: 1, lon: 2, label: '1.00000, 2.00000' }
    expect(await fixPlaceZip(p)).toBe(p)
  })

  it('repairZips fixes saved addresses and past entries the same way', async () => {
    const bad = { lat: 42.4206, lon: -71.0115, label: '54 Nell Rd, Revere, MA 01251' }
    await repo.addRecentPlace(bad)
    await repo.saveEmployer({ id: 'e', name: 'A', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] })
    await repo.saveEntry({ id: 't', employerId: 'e', start: '2026-10-06T07:00', end: '2026-10-06T15:00', breakMin: 0, rateCents: 3000, place: bad })
    expect(await repo.repairZips()).toBe(2)
    expect((await repo.getSettings()).recentPlaces[0].label).toBe('54 Nell Rd, Revere, MA 02151')
    expect((await repo.getEntry('t'))?.place?.label).toBe('54 Nell Rd, Revere, MA 02151')
    expect(await repo.repairZips()).toBe(0) // idempotent
  })
})
