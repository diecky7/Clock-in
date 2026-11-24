import { useMemo } from 'react'
import { periodLabel, periodStart, shiftPeriod, type PeriodKind } from '../domain/periods'
import { today } from '../domain/today'
import Dropdown from './Dropdown'

/**
 * The dates on screen. Tapping them lists every week, two weeks or month from the first one with data to now
 * (newest first) to jump straight to one.
 */
export default function DatePicker({
  kind,
  from,
  earliest,
  weekStartsOn,
  anchor,
  onChange,
}: {
  kind: PeriodKind
  from: string
  /** First day with data ('' when none). */
  earliest: string
  weekStartsOn: number
  anchor?: string
  onChange: (start: string) => void
}) {
  const options = useMemo(() => {
    const now = periodStart(kind, today(), weekStartsOn, anchor)
    const first = periodStart(kind, earliest && earliest < from ? earliest : from, weekStartsOn, anchor)
    const top = from > now ? from : now
    const year = today().slice(0, 4)
    const out: { value: string; label: string }[] = []
    // Capped so a typo'd year can't build a huge list.
    for (let s = top; s >= first && out.length < 400; s = shiftPeriod(kind, s, -1)) {
      const label = periodLabel(kind, s)
      out.push({ value: s, label: kind !== 'month' && s.slice(0, 4) !== year ? `${label}, ${s.slice(0, 4)}` : label })
    }
    return out
  }, [kind, from, earliest, weekStartsOn, anchor])

  const label = periodLabel(kind, from)
  return (
    <Dropdown
      value={from}
      options={options}
      onChange={onChange}
      buttonLabel={<span className="whitespace-nowrap">{label}</span>}
      ariaLabel={`${label}, choose dates`}
      menuLabel="Dates"
      className="mx-auto text-lg font-medium"
    />
  )
}
