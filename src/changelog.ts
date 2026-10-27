export interface Release {
  version: string
  date: string
  changes: string[]
}

/** Newest first. Keep `package.json` version equal to the first entry. */
export const CHANGELOG: Release[] = [
  {
    version: '1.7.0',
    date: '2026-10-27',
    changes: [
      'Employer menu on the home screen: one employer or All employers; it opens on the one used last',
      'New entries and expenses go to the employer chosen there (the choice is offered only under All employers)',
      'With one employer chosen, each row shows the shift times; Export opens with that employer ticked',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-10-27',
    changes: [
      'The "saved address nearby" question opens in its own box, showing the saved address and the one found',
      'GPS coordinates no longer get a stray space ("-71. 41010")',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-20',
    changes: [
      'Export a weekly, biweekly or monthly PDF; it opens on the period shown on the home screen',
      'Biweekly PDFs follow the employer\'s pay period; overtime is still judged on whole work weeks',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-20',
    changes: ['Each employer can set the day its biweekly pay period starts; the home screen\'s Biweekly view follows it'],
  },
  {
    version: '1.4.0',
    date: '2026-10-20',
    changes: [
      'Home screen: tap the dates to show it weekly, biweekly or monthly; the arrows and swipe move by that period',
      'Delete an address from Places (past entries keep it)',
      'Monthly totals keep overtime earned in a week that crosses the month edge',
    ],
  },
  {
    version: '1.3.2',
    date: '2026-10-09',
    changes: ['Hours are shown as hours and minutes (7h 50m) everywhere, including the PDF, instead of decimals'],
  },
  {
    version: '1.3.1',
    date: '2026-10-08',
    changes: ['Summary is more compact and fits on one screen'],
  },
  {
    version: '1.3.0',
    date: '2026-10-08',
    changes: ['Summary: one card per figure (total, hours, overtime, earnings, expenses) with weekly, monthly and yearly rows'],
  },
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
