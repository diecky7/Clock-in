import { useId, useState } from 'react'
import type { Account } from '../domain/types'
import { inputCls } from './ui'

export const findAccount = (accounts: Account[], name: string): Account | undefined =>
  accounts.find((a) => a.name.toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase())

/**
 * Type to pick a bank account. Matching accounts are listed under the field; a name that doesn't exist yet
 * offers "Create". The field never holds a choice that isn't a real account: `value` is an account id or ''.
 */
export default function AccountPicker({
  accounts,
  text,
  onText,
  value,
  onPick,
  onCreate,
  error,
}: {
  accounts: Account[]
  text: string
  onText: (t: string) => void
  value: string
  onPick: (id: string) => void
  onCreate: (name: string) => void
  error?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const q = text.trim().toLowerCase()
  const matches = accounts.filter((a) => !q || a.name.toLowerCase().includes(q))
  const exact = findAccount(accounts, text)
  const row = 'flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-base'

  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        Account
      </label>
      <input
        id={id}
        className={inputCls}
        value={text}
        placeholder="Santander, Bank of America…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onText(e.target.value)
          const m = findAccount(accounts, e.target.value)
          onPick(m ? m.id : '')
          setOpen(true)
        }}
      />
      {open && (matches.length > 0 || (q && !exact)) && (
        <div id={`${id}-list`} role="listbox" aria-label="Accounts" className="mt-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {matches.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={a.id === value}
              className={`${row} ${a.id === value ? 'font-semibold' : ''}`}
              onClick={() => {
                onText(a.name)
                onPick(a.id)
                setOpen(false)
              }}
            >
              {a.name}
              {a.id === value && <span aria-hidden>✓</span>}
            </button>
          ))}
          {q && !exact && (
            <button type="button" className={`${row} font-medium`} onClick={() => onCreate(text)}>
              Create “{text.trim()}”
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
