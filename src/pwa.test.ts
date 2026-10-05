/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeManifest } from './pwa-manifest'

describe('manifest', () => {
  const m = makeManifest('/Clock-in/')

  it('is a standalone app scoped to the base path', () => {
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/Clock-in/')
    expect(m.scope).toBe('/Clock-in/')
  })

  it('has 192 and 512 icons plus a maskable one', () => {
    const sizes = m.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })
})

describe('theme.css', () => {
  const css = readFileSync('src/styles/theme.css', 'utf8')
  const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
  const light = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'))

  it.each(['--bg', '--fg', '--muted', '--border', '--accent', '--danger'])('defines %s for light and dark', (v) => {
    expect(light).toMatch(new RegExp(`:root\\s*{[^}]*${v}:`))
    expect(dark).toMatch(new RegExp(`:root\\s*{[^}]*${v}:`))
  })
})
