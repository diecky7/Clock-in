import type { Place } from '../domain/types'

const EARTH_FT = 20_902_231 // mean Earth radius in feet
export const DEFAULT_NEARBY_FT = 500

/** Great-circle distance in feet. */
export function distanceFt(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_FT * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** "300 ft" under a fifth of a mile, otherwise "0.4 mi". */
export function formatDistance(ft: number): string {
  if (ft < 1056) return `${Math.max(10, Math.round(ft / 10) * 10)} ft`
  return `${(ft / 5280).toFixed(1)} mi`
}

/** The closest saved address within `limitFt` of the position, or null. 0 turns the check off. */
export function nearestWithin(pos: { lat: number; lon: number }, places: Place[], limitFt: number): { place: Place; ft: number } | null {
  if (limitFt <= 0) return null
  let best: { place: Place; ft: number } | null = null
  for (const place of places) {
    const ft = distanceFt(pos, place)
    if (ft <= limitFt && (!best || ft < best.ft)) best = { place, ft }
  }
  return best
}
