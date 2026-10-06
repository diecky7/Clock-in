import { describe, expect, it } from 'vitest'
import { abbreviateStreet, copyText, formatParts, shortAddress, zip5 } from './address'

describe('address format', () => {
  it('abbreviates street types and directions but not names', () => {
    expect(abbreviateStreet('12 North Main Street')).toBe('12 N Main St')
    expect(abbreviateStreet('500 Park Avenue South')).toBe('500 Park Ave S')
    expect(abbreviateStreet('1 City Hall Plaza')).toBe('1 City Hall Plz')
    expect(abbreviateStreet('7 Summer Street Extension')).toBe('7 Summer St Ext')
    expect(abbreviateStreet('Street')).toBe('Street')
  })

  it('builds "street, city, ST 12345"', () => {
    expect(formatParts({ number: '12', street: 'Main Street', city: 'Framingham', state: 'Massachusetts', postcode: '01702' })).toBe(
      '12 Main St, Framingham, MA 01702',
    )
    expect(formatParts({ name: 'Home Depot', city: 'Medford', state: 'Massachusetts' })).toBe('Home Depot, Medford, MA')
  })

  it('keeps only a valid 5-digit ZIP', () => {
    expect(zip5('02201-1234')).toBe('02201')
    expect(zip5('B3H 1A1')).toBe('')
    expect(zip5(undefined)).toBe('')
  })

  it('shortens older saved labels when copying', () => {
    expect(shortAddress('12 Main Street, Framingham, Massachusetts')).toBe('12 Main St, Framingham, MA')
    expect(shortAddress('12 Main St, Framingham, MA 01702')).toBe('12 Main St, Framingham, MA 01702')
  })

  it('copyText uses the clipboard and reports failure', async () => {
    let copied = ''
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void (copied = t) } })
    expect(await copyText('x')).toBe(true)
    expect(copied).toBe('x')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => Promise.reject(new Error('no')) } })
    document.execCommand = () => false
    expect(await copyText('y')).toBe(false)
  })
})

describe('coordinates and place type', () => {
  it('formats decimal and degrees', async () => {
    const { decimalCoords, dmsCoords, kindLabel } = await import('./address')
    expect(decimalCoords(42.3601, -71.0589)).toBe('42.36010, -71.05890')
    expect(dmsCoords(42.3601, -71.0589)).toBe('42°21′36″ N, 71°03′32″ W')
    expect(kindLabel('residential')).toBe('Residential street')
    expect(kindLabel('some_thing')).toBe('Some thing')
  })
})
