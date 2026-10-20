import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PERIOD_KINDS, type PeriodKind } from '../domain/periods'

/**
 * The period label in the date bar. Tapping it opens a small menu right under it
 * to show the home screen by week, two weeks or month.
 */
export default function PeriodPicker({ kind, label, onChange }: { kind: PeriodKind; label: string; onChange: (k: PeriodKind) => void }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!at) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [at])

  function open() {
    const r = button.current?.getBoundingClientRect()
    if (r) setAt({ top: r.bottom + 6, left: r.left + r.width / 2 })
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
        aria-label={`${label}, change period`}
        onClick={open}
        className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-base font-medium"
      >
        {label}
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-muted">
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {at &&
        createPortal(
          <div className="fixed inset-0 z-20" onClick={(e) => e.target === e.currentTarget && close()}>
            <div
              role="group"
              aria-label="Show"
              style={{ top: at.top, left: at.left }}
              className="fixed w-44 -translate-x-1/2 space-y-1 rounded-2xl border border-border bg-surface p-1.5 shadow-lg"
            >
              {PERIOD_KINDS.map((p, i) => (
                <button
                  key={p.kind}
                  ref={i === 0 ? first : undefined}
                  type="button"
                  aria-pressed={p.kind === kind}
                  onClick={() => {
                    onChange(p.kind)
                    close()
                  }}
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-base ${p.kind === kind ? 'bg-bg font-semibold' : ''}`}
                >
                  {p.name}
                  {p.kind === kind && <span aria-hidden>✓</span>}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
