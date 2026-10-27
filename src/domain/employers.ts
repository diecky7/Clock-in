import type { Employer, Settings } from './types'

/** Employer pre-selected for a new entry: the one used last if still active, else the first active one. */
export function defaultEmployerId(all: Employer[], lastId?: string): string {
  const active = activeEmployers(all)
  return (active.find((e) => e.id === lastId) ?? active[0])?.id ?? ''
}

/** Employers that can be chosen for new entries (archived ones are hidden). */
export function activeEmployers(all: Employer[]): Employer[] {
  return all.filter((e) => !e.archived)
}

export const ALL_EMPLOYERS = 'all'

/**
 * Employer shown on the home screen: the one chosen there, else the one used last, else the first active one.
 * 'all' when every employer was chosen (or there are none).
 */
export function homeEmployerFor(all: Employer[], s: Pick<Settings, 'homeEmployer' | 'lastEmployerId'>): string {
  if (s.homeEmployer === ALL_EMPLOYERS) return ALL_EMPLOYERS
  const active = activeEmployers(all)
  if (active.some((e) => e.id === s.homeEmployer)) return s.homeEmployer!
  return defaultEmployerId(all, s.lastEmployerId) || ALL_EMPLOYERS
}
