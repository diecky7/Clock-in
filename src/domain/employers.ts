import type { Employer } from './types'

/** Employer pre-selected for a new entry: the one used last if still active, else the first active one. */
export function defaultEmployerId(all: Employer[], lastId?: string): string {
  const active = activeEmployers(all)
  return (active.find((e) => e.id === lastId) ?? active[0])?.id ?? ''
}

/** Employers that can be chosen for new entries (archived ones are hidden). */
export function activeEmployers(all: Employer[]): Employer[] {
  return all.filter((e) => !e.archived)
}
