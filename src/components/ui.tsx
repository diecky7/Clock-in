import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { navigate } from '../router'

export const inputCls =
  'min-h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-base text-fg placeholder:text-muted'

export function Screen({
  title,
  back,
  swipe,
  children,
}: {
  title: string
  back?: string
  /** Horizontal-drag behaviour (see useWeekSwipe): handlers go on the whole screen, the motion on the content. */
  swipe?: { bind: HTMLAttributes<HTMLElement>; style: CSSProperties }
  children: ReactNode
}) {
  return (
    <main aria-label={title} {...swipe?.bind} className="relative mx-auto min-h-dvh max-w-md px-4 pb-16">
      <header className="flex min-h-14 items-center gap-2">
        {back && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(back)}
            className="-ml-2 grid size-11 place-items-center rounded-full text-2xl"
          >
            ‹
          </button>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </header>
      <div style={swipe?.style}>{children}</div>
    </main>
  )
}

export function Section({ title, compact, children }: { title: string; compact?: boolean; children: ReactNode }) {
  return (
    <section className={`${compact ? 'mt-3' : 'mt-6'} overflow-hidden rounded-b-2xl rounded-t-md bg-surface`} aria-label={title}>
      <h2 className={`bg-title px-4 font-semibold text-title-fg ${compact ? 'py-1.5 text-base' : 'py-3 text-lg'}`}>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

export function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string
  error?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="mt-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="grid h-11 w-14 shrink-0 place-items-center"
    >
      <span
        className={`relative block h-8 w-14 rounded-full border border-border transition-colors ${checked ? 'bg-accent' : 'bg-bg'}`}
      >
        <span
          className={`absolute top-0.5 size-6 rounded-full transition-all ${checked ? 'left-7 bg-accent-fg' : 'left-0.5 bg-muted'}`}
        />
      </span>
    </button>
  )
}

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-12 w-full rounded-full bg-accent px-6 text-base font-semibold text-accent-fg disabled:opacity-70 ${props.className ?? ''}`}
    />
  )
}
