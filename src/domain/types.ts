export interface Place { lat: number; lon: number; label: string }
export interface RateChange { from: string; cents: number }
export interface Employer {
  id: string
  name: string
  overtimeEnabled: boolean
  archived: boolean
  rates: RateChange[]
}
export interface TimeEntry {
  id: string
  employerId: string
  start: string
  end: string
  breakMin: number
  rateCents: number
  place?: Place
}
export interface Expense {
  id: string
  employerId: string
  date: string
  description: string
  amountCents: number
  photoIds: string[]
}
export type DaySchedule = { in: string; out: string; breakMin: number } | null
export interface Settings {
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
  schedule: DaySchedule[]
  recentPlaces: Place[]
  /** Ask which address to use when a new entry starts this close to a saved one. 0 = off, default 500. */
  nearbyFeet?: number
}
