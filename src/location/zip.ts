import type { Place } from '../domain/types'
import { stateCode, zip5 } from './address'
import { distanceFt } from './distance'

/**
 * Map data (OpenStreetMap, via Photon/Nominatim) sometimes carries a wrong ZIP — e.g. "01251" for
 * 54 Nell Rd, Revere (real: 02151, digits swapped). We check every ZIP against the USPS list
 * (public/zips/<ST>.json, built by scripts/build-zips.mjs) and fix or drop it.
 */
type Row = [zip: string, city: string, lat: number, lon: number]

const MI = 5280
const KEEP_WITHIN = 15 * MI // a real ZIP whose center is this close to the point is trusted
const NEAREST_WITHIN = 5 * MI // with no city match, borrow the nearest ZIP only if it's this close

const cache = new Map<string, Promise<Row[]>>()

export let loadState = (st: string): Promise<Row[]> => {
  let p = cache.get(st)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}zips/${st}.json`).then((r) => {
      if (!r.ok) throw new Error(`ZIP list ${st} ${r.status}`)
      return r.json() as Promise<Row[]>
    })
    p.catch(() => cache.delete(st))
    cache.set(st, p)
  }
  return p
}
/** Tests swap the loader. */
export function setZipLoader(fn: typeof loadState) {
  loadState = fn
}

const norm = (s: string) => s.trim().toLowerCase()
const near = (p: { lat: number; lon: number }, r: Row) => distanceFt(p, { lat: r[2], lon: r[3] })

/** The correct ZIP for a point, given the ZIP and city the map data claimed. '' when unknown. */
export async function checkZip(p: { lat: number; lon: number }, st: string, city: string | undefined, zip: string): Promise<string> {
  const rows = await loadState(st)
  const claimed = rows.find((r) => r[0] === zip)
  if (claimed && near(p, claimed) <= KEEP_WITHIN) return zip
  const nearest = (list: Row[]) => list.reduce<Row | null>((best, r) => (!best || near(p, r) < near(p, best) ? r : best), null)
  const inCity = city ? rows.filter((r) => norm(r[1]) === norm(city)) : []
  const pick = nearest(inCity)
  if (pick) return pick[0]
  const any = nearest(rows)
  return any && near(p, any) <= NEAREST_WITHIN ? any[0] : ''
}

/** Returns the place with its ZIP verified (label and details), or the same object if nothing changed. */
export async function fixPlaceZip(place: Place): Promise<Place> {
  const parts = place.label.split(',').map((s) => s.trim())
  const tail = parts.length >= 2 ? /^([A-Za-z]{2})(?:\s+(\d{5}))?$/.exec(parts[parts.length - 1]) : null
  const st = tail?.[1] ?? (place.detail?.state ? stateCode(place.detail.state) : '')
  if (!/^[A-Z]{2}$/.test(st)) return place
  const city = place.detail?.city ?? (tail ? parts[parts.length - 2] : undefined)
  const zip = zip5(place.detail?.zip) || tail?.[2] || ''
  const right = await checkZip(place, st, city, zip)
  if (right === zip) return place
  const label = tail ? [...parts.slice(0, -1), [st, right].filter(Boolean).join(' ')].join(', ') : place.label
  const detail = place.detail ? { ...place.detail, zip: right || undefined } : undefined
  if (detail && !detail.zip) delete detail.zip
  return { ...place, label, ...(detail ? { detail } : {}) }
}

/** Same as fixPlaceZip but never fails: offline or unknown state keeps the place as it was. */
export async function safeFixZip(place: Place): Promise<Place> {
  try {
    return await fixPlaceZip(place)
  } catch {
    return place
  }
}
