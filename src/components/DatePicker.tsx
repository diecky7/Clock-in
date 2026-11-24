import { PERIOD_WORDS, periodLabel, shiftPeriod, type PeriodKind } from '../domain/periods'

/**
 * The dates on screen, with arrows to go one week, two weeks or month back or forward. Tapping the dates goes
 * back to the current one.
 */
export default function DatePicker({
  kind,
  from,
  current,
  onChange,
}: {
  kind: PeriodKind
  from: string
  /** Start of the period that contains today. */
  current: string
  onChange: (start: string) => void
}) {
  const words = PERIOD_WORDS[kind]
  const label = periodLabel(kind, from)
  const arrow = 'grid size-11 shrink-0 place-items-center rounded-full'
  return (
    <div className="flex items-center justify-center">
      <button type="button" aria-label={`Previous ${words.unit}`} className={arrow} onClick={() => onChange(shiftPeriod(kind, from, -1))}>
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        aria-label={`${label}, go to ${words.this}`}
        onClick={() => onChange(current)}
        className="min-h-11 w-52 rounded-full px-1 text-center text-lg font-medium whitespace-nowrap"
      >
        {label}
      </button>
      <button type="button" aria-label={`Next ${words.unit}`} className={arrow} onClick={() => onChange(shiftPeriod(kind, from, 1))}>
        <Chevron dir="right" />
      </button>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
      <path d={dir === 'left' ? 'm10 3-5 5 5 5' : 'm6 3 5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
