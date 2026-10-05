import type { Employer } from './types'

/** Employers that can be chosen for new entries (archived ones are hidden). */
export function activeEmployers(all: Employer[]): Employer[] {
  return all.filter((e) => !e.archived)
}
