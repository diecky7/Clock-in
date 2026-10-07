import { formatClock, formatDateTime, formatDay } from '../domain/time'

const FORMAT = { 'datetime-local': formatDateTime, date: formatDay, time: formatClock } as const
const EMPTY = { 'datetime-local': 'Select date and time', date: 'Select a date', time: 'Select a time' } as const

/**
 * A date, time or date+time field drawn by us ("Mon, Oct 5 · 7:00 AM").
 * A transparent native input on top opens the iOS picker; drawing the text ourselves keeps
 * iOS Safari from sizing the field by its own rules (it ignores width:100% on date/time inputs).
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  error,
  type = 'datetime-local',
  className = 'mt-4',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: keyof typeof FORMAT
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <div className="relative flex min-h-12 items-center overflow-hidden rounded-xl border border-border bg-surface px-3 text-base text-fg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fg">
        <span aria-hidden="true" className={`truncate ${value ? '' : 'text-muted'}`}>
          {value ? FORMAT[type](value) : EMPTY[type]}
        </span>
        <input
          type={type}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full min-w-0 cursor-pointer appearance-none opacity-0"
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
