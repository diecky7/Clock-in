import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface DropdownOption {
  value: string
  label: string
}

/**
 * A pill button that opens a small menu right under it (rendered at the page level, so a sliding parent
 * doesn't move or clip it). Escape or a tap outside closes it.
 */
export default function Dropdown({
  value,
  options,
  onChange,
  buttonLabel,
  ariaLabel,
  menuLabel,
  className = '',
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  buttonLabel: ReactNode
  ariaLabel: string
  menuLabel: string
  className?: string
}) {
  const [at, setAt] = useState<{ top: number; left: number; align: 'center' | 'left' } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const current = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!at) return
    current.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [at])

  function open() {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    // Centered under the button, unless that would run off the left edge.
    const center = r.left + r.width / 2
    setAt(center - 112 < 8 ? { top: r.bottom + 6, left: r.left, align: 'left' } : { top: r.bottom + 6, left: center, align: 'center' })
  }
  function close() {
    setAt(null)
    button.current?.focus()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={at !== null}
        aria-label={ariaLabel}
        onClick={open}
        className={`flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-3 text-base font-medium ${className}`}
      >
        {buttonLabel}
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-muted">
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {at &&
        createPortal(
          <div className="fixed inset-0 z-20" onClick={(e) => e.target === e.currentTarget && close()}>
            <div
              role="group"
              aria-label={menuLabel}
              style={{ top: at.top, left: at.left }}
              className={`fixed max-h-[60dvh] w-56 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-lg ${at.align === 'center' ? '-translate-x-1/2' : ''}`}
            >
              {options.map((o) => {
                const on = o.value === value
                return (
                  <button
                    key={o.value}
                    ref={on ? current : undefined}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onChange(o.value)
                      close()
                    }}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-base ${on ? 'bg-bg font-semibold' : ''}`}
                  >
                    <span className="truncate">{o.label}</span>
                    {on && <span aria-hidden>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
