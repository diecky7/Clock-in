import { formatDateTime } from '../domain/time'

/**
 * One field showing date and time together ("Mon, Oct 5 · 7:00 AM").
 * A transparent native datetime-local input on top opens the iOS picker.
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div className="mt-4">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <div className="relative flex min-h-12 items-center rounded-xl border border-border bg-surface px-3 text-base focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fg">
        <span aria-hidden="true">{value ? formatDateTime(value) : 'Select date and time'}</span>
        <input
          type="datetime-local"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
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
