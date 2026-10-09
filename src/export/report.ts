import type { Employer, TimeEntry } from '../domain/types'
import { shortAddress } from '../location/address'
import type { EmployerWeek } from '../domain/pay'
import { formatDuration, shiftMinutes } from '../domain/time'
import { formatUSD } from '../domain/money'
import { rateOn } from '../domain/rates'
import { weekLabel } from '../domain/weeks'
import type { ReportOptions } from './options'

export interface ReportDay { label: string; times?: string; hours: string; detail?: string }
export interface ReportReceipt {
  description: string
  employerName: string
  dateLabel: string
  amountCents: number
  photoId: string
  index: number
  count: number
}
export interface ReportModel {
  employerName: string
  weekLabel: string
  rateLabel?: string
  hoursTotal: string
  valueLines: { label: string; detail?: string; cents: number }[]
  totalCents: number | null
  days: ReportDay[]
  expenseItems: { description: string; cents: number }[]
  receipts: ReportReceipt[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[dow]}, ${MONTHS[m - 1]} ${d}`
}

function timeLabel(s: string): string {
  const [h, min] = s.split('T')[1].split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function rateLabelFor(entries: TimeEntry[], employer: Employer, weekStart: string): string {
  const rates = entries.length ? entries.map(e => e.rateCents) : [rateOn(employer, weekStart)]
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  return min === max ? `${formatUSD(min)}/h` : `${formatUSD(min)}–${formatUSD(max)}/h`
}

export function buildReportModel(
  week: EmployerWeek,
  employer: Employer,
  weekStart: string,
  o: ReportOptions,
): ReportModel {
  const valueLines: ReportModel['valueLines'] = []
  if (o.regularPay) {
    valueLines.push({ label: 'Regular pay', detail: formatDuration(week.regularMinutes), cents: week.regularCents })
  }
  if (o.overtimePay && week.overtimeMinutes > 0) {
    valueLines.push({ label: 'Overtime pay', detail: formatDuration(week.overtimeMinutes), cents: week.overtimeCents })
  }
  const n = week.expenses.length
  if (o.expenses && n > 0) {
    valueLines.push({ label: 'Expenses', detail: `${n} ${n === 1 ? 'item' : 'items'}`, cents: week.expensesCents })
  }

  const sorted = [...week.entries].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  const days: ReportDay[] = sorted.map(e => {
    const parts: string[] = []
    if (o.timesAndBreak && e.breakMin > 0) parts.push(`${e.breakMin} min break`)
    if (o.addresses && e.place?.label) parts.push(shortAddress(e.place.label))
    const day: ReportDay = { label: dateLabel(e.start.split('T')[0]), hours: formatDuration(shiftMinutes(e)) }
    if (o.timesAndBreak) day.times = `${timeLabel(e.start)} – ${timeLabel(e.end)}`
    if (parts.length) day.detail = parts.join(' · ')
    return day
  })

  const exps = o.expenses
    ? [...week.expenses].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    : []
  const photos = exps.flatMap(x => x.photoIds.map(photoId => ({ x, photoId })))
  const receipts: ReportReceipt[] = photos.map(({ x, photoId }, i) => ({
    description: x.description.trim() || 'Expense',
    employerName: employer.name,
    dateLabel: dateLabel(x.date),
    amountCents: x.amountCents,
    photoId,
    index: i + 1,
    count: photos.length,
  }))

  const model: ReportModel = {
    employerName: employer.name,
    weekLabel: weekLabel(weekStart),
    hoursTotal: formatDuration(week.minutes),
    valueLines,
    totalCents: valueLines.length ? valueLines.reduce((s, l) => s + l.cents, 0) : null,
    days,
    expenseItems: exps.map(x => ({ description: x.description.trim() || 'Expense', cents: x.amountCents })),
    receipts,
  }
  if (o.hourlyRate) model.rateLabel = rateLabelFor(sorted, employer, weekStart)
  return model
}
