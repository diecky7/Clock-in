// USPS-style short addresses: "1 City Hall Plz, Boston, MA 02201".

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}

const SUFFIX: Record<string, string> = {
  alley: 'Aly', avenue: 'Ave', boulevard: 'Blvd', circle: 'Cir', court: 'Ct', drive: 'Dr', expressway: 'Expy',
  extension: 'Ext', freeway: 'Fwy', highway: 'Hwy', lane: 'Ln', parkway: 'Pkwy', place: 'Pl', plaza: 'Plz',
  road: 'Rd', route: 'Rte', square: 'Sq', street: 'St', terrace: 'Ter', trail: 'Trl', turnpike: 'Tpke',
}

const DIRECTION: Record<string, string> = {
  north: 'N', south: 'S', east: 'E', west: 'W', northeast: 'NE', northwest: 'NW', southeast: 'SE', southwest: 'SW',
}

/** "North Main Street" → "N Main St". Only street words are shortened, never business names. */
export function abbreviateStreet(line: string): string {
  const words = line.split(/\s+/).filter(Boolean)
  const start = /^\d/.test(words[0] ?? '') ? 1 : 0
  return words
    .map((w, i) => {
      const key = w.toLowerCase().replace(/\.$/, '')
      const last = i === words.length - 1
      // A direction leads ("N Main St") or trails ("Park Ave S"); in the middle it is part of a name.
      if (DIRECTION[key] && (i === start || last) && words.length > start + 1) return DIRECTION[key]
      if (SUFFIX[key] && i > 0 && (last || (words[i + 1] && (DIRECTION[words[i + 1].toLowerCase()] || SUFFIX[words[i + 1].toLowerCase()])))) return SUFFIX[key]
      return w
    })
    .join(' ')
}

export function stateCode(state: string): string {
  return STATES[state.trim().toLowerCase()] ?? state.trim()
}

/** First five digits of a US ZIP / ZIP+4, or '' when it isn't one. */
export function zip5(postcode?: string): string {
  const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(postcode ?? '')
  return m ? m[1] : ''
}

export interface AddressParts {
  name?: string
  number?: string
  street?: string
  city?: string
  state?: string
  postcode?: string
}

export function formatParts(p: AddressParts): string {
  const line = p.street ? abbreviateStreet(p.number ? `${p.number} ${p.street}` : p.street) : p.name
  const stateZip = [p.state ? stateCode(p.state) : '', zip5(p.postcode)].filter(Boolean).join(' ')
  return [line, p.city, stateZip].filter(Boolean).join(', ')
}

/** Shortens a label saved before this format existed, for copying. */
export function shortAddress(label: string): string {
  const parts = label.split(',').map((s) => s.trim()).filter(Boolean)
  return parts
    .map((seg, i) => {
      if (i === 0 && /^\d/.test(seg)) return abbreviateStreet(seg)
      const m = /^(.*?)\s*\b(\d{5})(?:-\d{4})?$/.exec(seg)
      const text = (m ? m[1] : seg).trim()
      return [STATES[text.toLowerCase()] ?? text, m?.[2]].filter(Boolean).join(' ')
    })
    .join(', ')
}

/** Identity of an address, so two spellings of it ("Massachusetts" / "MA") count as one. */
export const placeKey = (label: string): string => shortAddress(label).toLowerCase()

/** Copies text to the clipboard; falls back to a hidden textarea where the async API is missing. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

function dms(value: number, pos: string, neg: string): string {
  const abs = Math.abs(value)
  const d = Math.floor(abs)
  const mFull = (abs - d) * 60
  const m = Math.floor(mFull)
  const s = Math.round((mFull - m) * 60)
  // Rounding can push seconds to 60; carry it.
  const [mm, ss] = s === 60 ? [m + 1, 0] : [m, s]
  return `${d}°${String(mm).padStart(2, '0')}′${String(ss).padStart(2, '0')}″ ${value >= 0 ? pos : neg}`
}

/** "42.36010, -71.05890" — the form every map app accepts. */
export function decimalCoords(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

/** `42°21′36″ N, 71°03′32″ W`. */
export function dmsCoords(lat: number, lon: number): string {
  return `${dms(lat, 'N', 'S')}, ${dms(lon, 'E', 'W')}`
}

const KIND: Record<string, string> = {
  house: 'House', residential: 'Residential street', apartments: 'Apartments', building: 'Building', commercial: 'Commercial',
  retail: 'Store', industrial: 'Industrial', yes: 'Building', street: 'Street', road: 'Road', city: 'City', town: 'Town',
  village: 'Village', hamlet: 'Hamlet', suburb: 'Neighborhood', neighbourhood: 'Neighborhood', hotel: 'Hotel', school: 'School',
  hospital: 'Hospital', office: 'Office', construction: 'Construction site', warehouse: 'Warehouse', church: 'Church',
}

/** Readable place type from the geocoder's raw value ("residential" → "Residential street"). */
export function kindLabel(kind?: string): string {
  if (!kind) return ''
  return KIND[kind] ?? kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
