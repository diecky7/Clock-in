# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: Igor, a painter and carpenter in Massachusetts, working for one or more employers (contractors) and doing side jobs of his own. He uses the app alone, on his iPhone, as a PWA installed on the home screen. He logs hours and expenses at the end of the day or week, often from a job site, and checks what he is owed before and after payday. The interface is in English (US); he reads it as a second language and prefers few words.

## Product Purpose

A personal time clock and pay ledger. Success is four things:

1. Knowing exactly how much each employer owes him for a week, two weeks or a month: hours, overtime and reimbursable expenses.
2. Proving his hours to the employer with a shareable PDF (times, breaks, job addresses, receipt photos).
3. Tracking what was actually received: which entries a payment covered, the real amount, the difference, and whether it came in cash or by Zelle to which bank account.
4. Seeing earnings across the month and year to plan ahead.

## Positioning

Not a team timesheet or a payroll product: it is the worker's own record, kept on his phone and under his control, built to settle up with the people who pay him. Hours are entered by hand after the fact, not clocked live.

## Operating Context

- Entries are logged after the work, with a default schedule pre-filled, and a job address from GPS, typed search or a map pin; nearby saved addresses are offered instead of duplicates.
- Pay periods: weekly, biweekly (a default start in Settings, optionally per employer) or monthly; overtime is 1.5× after 40 hours per employer per work week.
- Employers have hourly rates that change over time; a change applies only to new entries. Side jobs carry their own rate and service per entry.
- Expenses (materials) are reimbursed by the employer and count in what he is owed.
- The PDF is shared from the phone (share sheet) at the end of a period.
- Backups are exported and imported by hand as a JSON file.

## Capabilities and Constraints

- Hosted on GitHub Pages (`diecky7/Clock-in`), React + TypeScript + Vite PWA; data in IndexedDB on the device only.
- Works offline; maps, address search and ZIP checks need a connection the first time.
- Money is integer cents; time math is DST-safe; hours display as `7h 50m`, never decimals.
- US formats: dates, 12-hour times, USD, USPS-style short addresses with ZIP; full address only in the address detail box.
- Every data change offers Undo for 3.5 seconds.
- Database schema is versioned; an older build must never be deployed over a newer database.

## Brand Commitments

- Name: Clock-in. App icon and favicon: an original clock symbol.
- Map apps are named with generic icons and captions, never their logos.
- Minimal text: no explanatory copy where the data speaks for itself.

## Evidence on Hand

Real data exists only on the owner's phone; there are no testimonials, customers or metrics, and none should be invented. Sample data in tests and screenshots is fictional.

## Product Principles

1. **His data, his phone.** Nothing leaves the device unless he shares it; no accounts, no cloud.
2. **Every number is right.** Money and hours must match across Home, Summary, Receive payment and the PDF, to the cent.
3. **Fast to log.** Few taps, sensible defaults (last employer, schedule, nearby address), no unnecessary words.
4. **Works on the job site.** Usable offline, one-handed, in sunlight, on an iPhone.
5. **Nothing is lost by a tap.** Destructive or bulk actions confirm or can be undone.

## Accessibility & Inclusion

- iPhone first (reference device: iPhone 16 Pro Max, Safari); light and dark mode follow the system.
- Inputs at 16 px or larger so iOS doesn't zoom; touch targets about 44 px.
- VoiceOver must be able to reach every action that touch gestures (long press, swipe) offer.
- Plain English for a non-native reader.
