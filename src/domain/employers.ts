import type { Employer, Settings } from './types'

/** Built-in pseudo-employer for work done on the side. Never stored in IndexedDB; the rate is typed per entry. */
export const SIDE_JOB_ID = 'side-job'
export const SIDE_JOB: Employer = { id: SIDE_JOB_ID, name: 'Side job', overtimeEnabled: false, archived: false, rates: [] }
export const isSideJob = (id: string | undefined): boolean => id === SIDE_JOB_ID

/** Employer pre-selected for a new entry: the one used last if still active, else the first active one. */
export function defaultEmployerId(all: Employer[], lastId?: string): string {
  const active = activeEmployers(all)
  // Side job never becomes the default by itself: only when it is all there is.
  const real = active.filter((e) => !isSideJob(e.id))
  return (real.find((e) => e.id === lastId) ?? real[0] ?? active[0])?.id ?? ''
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
  // Without a real employer, show everything; Side job shows only when chosen explicitly (handled above).
  if (!active.some((e) => !isSideJob(e.id))) return ALL_EMPLOYERS
  return defaultEmployerId(all, s.lastEmployerId) || ALL_EMPLOYERS
}
