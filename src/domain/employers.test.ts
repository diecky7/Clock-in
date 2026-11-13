import { describe, expect, it } from 'vitest'
import { SIDE_JOB, SIDE_JOB_ID, defaultEmployerId, homeEmployerFor, isSideJob } from './employers'
import type { Employer } from './types'

const e = (id: string, archived = false) => ({ id, name: id, archived, overtimeEnabled: false, rates: [] }) as Employer

describe('defaultEmployerId', () => {
  it('prefers the last used employer, else the first active one', () => {
    const all = [e('a'), e('b'), e('c', true)]
    expect(defaultEmployerId(all, 'b')).toBe('b')
    expect(defaultEmployerId(all)).toBe('a')
    expect(defaultEmployerId(all, 'c')).toBe('a') // archived: not offered
    expect(defaultEmployerId(all, 'gone')).toBe('a')
    expect(defaultEmployerId([])).toBe('')
  })
})

describe('side job', () => {
  it('is a built-in employer without rates or overtime', () => {
    expect(SIDE_JOB).toEqual({ id: 'side-job', name: 'Side job', overtimeEnabled: false, archived: false, rates: [] })
    expect(SIDE_JOB_ID).toBe('side-job')
    expect(isSideJob('side-job')).toBe(true)
    expect(isSideJob('e1')).toBe(false)
    expect(isSideJob(undefined)).toBe(false)
  })

  it('never defaults to Side job while a real employer exists, even if it was passed as the last one', () => {
    const real = { id: 'e1', name: 'Acme', overtimeEnabled: false, archived: false, rates: [] }
    expect(defaultEmployerId([real, SIDE_JOB], 'side-job')).toBe('e1')
    expect(defaultEmployerId([real, SIDE_JOB])).toBe('e1')
    expect(defaultEmployerId([SIDE_JOB])).toBe('side-job')
  })

  it('home shows All without real employers; Side job only when chosen explicitly', () => {
    const real = { id: 'e1', name: 'Acme', overtimeEnabled: false, archived: false, rates: [] }
    expect(homeEmployerFor([SIDE_JOB], {})).toBe('all')
    expect(homeEmployerFor([SIDE_JOB], { lastEmployerId: 'side-job' })).toBe('all')
    expect(homeEmployerFor([SIDE_JOB], { homeEmployer: 'side-job' })).toBe('side-job')
    expect(homeEmployerFor([real, SIDE_JOB], { lastEmployerId: 'side-job' })).toBe('e1')
  })
})
