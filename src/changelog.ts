export interface Release {
  version: string
  date: string
  changes: string[]
}

/** Newest first. Keep `package.json` version equal to the first entry. */
export const CHANGELOG: Release[] = [
  {
    version: '1.2.1',
    date: '2026-10-08',
    changes: ['Swiping to change week works from anywhere on the screen, including the edges, and needs half the screen width', 'Same swipe on the Summary screen'],
  },
  {
    version: '1.2.0',
    date: '2026-10-08',
    changes: [
      'Swipe left or right to change week, with a slide animation',
      'Newest entries first on the home screen',
      'New entries and expenses start on the employer you used last',
      'Refresh button, version number and this changelog',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-07',
    changes: [
      'Small menu on the + button',
      'Summary screen: week, month and year totals',
      'Card titles in a band, larger titles and even spacing on every screen',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-06',
    changes: [
      'Addresses: short USPS style in lists, full in the address box, ZIP codes verified, copy buttons',
      'Directions to Apple Maps, Google Maps or Waze from any saved address',
      'Ask which address to use when you start near a saved one',
      'Money fields fill from the right, like a cash register',
      'Clock icon, one default schedule, map that shows streets',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-05',
    changes: [
      'Manual hour entries with employers, hourly rates and overtime after 40 h',
      'Weekly balance, expenses with receipt photos',
      'PDF export for your employer, backup export and import',
    ],
  },
]
