// Builds public/zips/<ST>.json: every US ZIP that covers a delivery area (Census ZCTA, from `us-zips`)
// with its USPS city/state (from `zipcodes`) and area center. PO-box-only ZIPs are left out on purpose:
// a street address never belongs to one. Each file: [[zip, city, lat, lon], ...].
// Run: node scripts/build-zips.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { codes } = require('zipcodes')
const areas = require('us-zips')

const byState = {}
for (const [zip, { latitude, longitude }] of Object.entries(areas)) {
  const c = codes[zip]
  if (!c?.state) continue
  ;(byState[c.state] ??= []).push([zip, c.city, Number(latitude.toFixed(4)), Number(longitude.toFixed(4))])
}
rmSync('public/zips', { recursive: true, force: true })
mkdirSync('public/zips', { recursive: true })
for (const [st, rows] of Object.entries(byState)) {
  rows.sort((a, b) => a[0].localeCompare(b[0]))
  writeFileSync(`public/zips/${st}.json`, JSON.stringify(rows))
}
console.log(Object.keys(byState).length, 'states', Object.values(byState).reduce((n, r) => n + r.length, 0), 'ZIPs')
