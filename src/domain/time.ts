function toDate(s: string): Date {
  const [d, t] = s.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, min] = t.split(':').map(Number)
  return new Date(y, m - 1, day, h, min)
}

type Shift = { start: string; end: string; breakMin: number }

function grossMinutes(e: Shift): number {
  return Math.round((toDate(e.end).getTime() - toDate(e.start).getTime()) / 60000)
}

export function shiftMinutes(e: Shift): number {
  return grossMinutes(e) - e.breakMin
}

export function validateShift(e: Shift): 'OUT_BEFORE_IN' | 'BREAK_TOO_LONG' | null {
  const gross = grossMinutes(e)
  if (gross <= 0) return 'OUT_BEFORE_IN'
  if (e.breakMin >= gross) return 'BREAK_TOO_LONG'
  return null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDateTime(s: string): string {
  const d = toDate(s)
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60
  const one = Math.round(hours * 10) / 10
  if (Math.abs(one - hours) < 1e-9) return one.toFixed(1)
  return hours.toFixed(2).replace(/(\.\d)0$/, '$1')
}
