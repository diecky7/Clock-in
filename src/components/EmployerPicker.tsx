import type { Employer } from '../domain/types'

export default function EmployerPicker({
  employers,
  value,
  onChange,
}: {
  employers: Employer[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Employer" className="flex flex-wrap gap-2">
      {employers.map((e) => {
        const on = e.id === value
        return (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(e.id)}
            className={`min-h-11 rounded-full border px-5 text-base font-medium ${
              on ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface text-fg'
            }`}
          >
            {e.name}
          </button>
        )
      })}
    </div>
  )
}
