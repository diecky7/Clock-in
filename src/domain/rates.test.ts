import { describe, it, expect } from 'vitest'
import { rateOn, addRateChange } from './rates'
import type { Employer } from './types'
const emp: Employer = { id: 'e', name: 'A', overtimeEnabled: false, archived: false,
  rates: [{ from: '2026-01-01', cents: 2000 }, { from: '2026-06-01', cents: 2500 }] }
describe('rates', () => {
  it('rateOn', () => {
    expect(rateOn(emp, '2026-06-01')).toBe(2500)
    expect(rateOn(emp, '2026-05-31')).toBe(2000)
    expect(rateOn(emp, '2027-01-01')).toBe(2500)
    expect(rateOn(emp, '2025-01-01')).toBe(2000)
  })
  it('addRateChange', () => {
    const a = addRateChange(emp, { from: '2026-03-01', cents: 2200 })
    expect(a.rates.map(r => r.from)).toEqual(['2026-01-01', '2026-03-01', '2026-06-01'])
    const b = addRateChange(emp, { from: '2026-06-01', cents: 3000 })
    expect(b.rates).toEqual([{ from: '2026-01-01', cents: 2000 }, { from: '2026-06-01', cents: 3000 }])
    expect(emp.rates).toHaveLength(2)
  })
})
