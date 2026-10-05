const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fmt(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date: string, n: number): string {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

export function weekStartOf(date: string, weekStartsOn: number): string {
  const dow = parse(date).getUTCDay()
  return addDays(date, -((dow - weekStartsOn + 7) % 7))
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function weekLabel(weekStart: string): string {
  const s = parse(weekStart)
  const e = parse(addDays(weekStart, 6))
  const sm = MONTHS[s.getUTCMonth()]
  const em = MONTHS[e.getUTCMonth()]
  const end = s.getUTCMonth() === e.getUTCMonth() ? `${e.getUTCDate()}` : `${em} ${e.getUTCDate()}`
  return `${sm} ${s.getUTCDate()} – ${end}`
}
