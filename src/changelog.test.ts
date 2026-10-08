import { expect, it } from 'vitest'
import { CHANGELOG } from './changelog'
import { APP_VERSION } from './version'

it('the newest changelog entry matches the app version', () => {
  expect(CHANGELOG[0].version).toBe(APP_VERSION)
})
