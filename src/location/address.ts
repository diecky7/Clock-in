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
      return STATES[seg.toLowerCase()] ?? seg
    })
    .join(', ')
}

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
