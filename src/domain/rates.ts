import type { Employer, RateChange } from './types'

export function rateOn(e: Employer, date: string): number {
  const sorted = [...e.rates].sort((a, b) => a.from.localeCompare(b.from))
  let result = sorted[0]?.cents ?? 0
  for (const r of sorted) if (r.from <= date) result = r.cents
  return result
}

export function addRateChange(e: Employer, c: RateChange): Employer {
  const rates = e.rates.filter(r => r.from !== c.from).concat(c)
  rates.sort((a, b) => a.from.localeCompare(b.from))
  return { ...e, rates }
}
