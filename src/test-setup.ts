import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// ZIP checks fetch a USPS list; tests that need it install their own loader.
import { setZipLoader } from './location/zip'
setZipLoader(() => Promise.reject(new Error('no ZIP list in tests')))
