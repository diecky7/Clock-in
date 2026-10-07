import { formatUSD } from '../domain/money'

const MAX_DIGITS = 9 // up to $9,999,999.99

/**
 * Cash-register style money field: digits fill from the right, so typing 1, 2, 5 shows
 * $0.01, $0.12, $1.25. Backspace removes the last digit.
 */
export default function MoneyInput({
  id,
  cents,
  onChange,
  placeholder = '$0.00',
}: {
  id: string
  cents: number | null
  onChange: (cents: number | null) => void
  placeholder?: string
}) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className="min-h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-base tabular-nums text-fg placeholder:text-muted"
      value={cents ? formatUSD(cents) : ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS)
        onChange(digits ? Number(digits) : null)
      }}
    />
  )
}
