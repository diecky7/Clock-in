import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { navigate } from '../router'

export const inputCls =
  'min-h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-base text-fg placeholder:text-muted'

export function Screen({ title, back, children }: { title: string; back?: string; children: ReactNode }) {
  return (
    <main aria-label={title} className="mx-auto min-h-dvh max-w-md px-4 pb-16">
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
        <h1 className="text-xl font-semibold">{title}</h1>
      </header>
      {children}
    </main>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="mb-2 px-6 text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface p-2">{children}</div>
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
