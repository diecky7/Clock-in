# Time Clock App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-user, offline-first PWA for Igor to log work shifts and expenses by employer, see the weekly balance, and share a 9:16 PDF report (with receipt photos) with an employer.

**Architecture:** Vite + React + TypeScript single-page app, hash-routed so it works on GitHub Pages. All data lives in IndexedDB on the iPhone (no backend, no accounts). Pay and report logic are pure functions in `src/domain` and `src/export`, tested without the UI; screens are thin and call a small repository layer.

**Tech Stack:** React, TypeScript, Vite, Tailwind, vite-plugin-pwa, `idb`, MapLibre GL (OpenFreeMap tiles), Photon + Nominatim (OpenStreetMap), `pdf-lib`, Vitest, Testing Library, `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-10-05-time-clock-app-design.md`

## Global Constraints

- UI language is English, US format: dates `MM/DD/YYYY`, 12-hour time with AM/PM, money in US$.
- Single user, no login, no backend, no external database. Data only in the iPhone's IndexedDB; ask the browser for persistent storage on first launch.
- Hosting: GitHub Pages from a **public** repo on the `diecky7` account; app must be a PWA (installable, standalone). Vite `base` comes from env `VITE_BASE`, default `/Clock-in/`. The app URL must never change after install.
- Massachusetts overtime: 1.5× only for hours above 40 per week **per employer**, only when that employer's `overtimeEnabled` is true; no daily overtime, no double time.
- Money is stored as integer cents. A shift's paid minutes = end − start − break. A shift belongs to the week of its **start**.
- `Time entry` stores `rateCents` = the employer's rate in effect on the entry's date, computed when the entry is created or its employer changes; editing other fields keeps it. A new rate never alters existing entries.
- Deleting an employer archives it: hidden from new-entry choices, still shown in past weeks and exports.
- Week start day is one global setting (default Sunday). Future weeks show only what is already logged; no forecast.
- Expenses: linked to one employer, max 3 photos each (camera or library), amount in cents, optional description. They are reimbursement: never multiplied and never counted toward overtime.
- Export is **one PDF, 9:16, page size 1080 × 1920**: page 1 report, then one page per receipt photo. Export "Show" toggles always start all-on; nothing is remembered.
- Report values are separate lines: Regular pay, Overtime pay, Expenses, each with its own amount; **Total sums only visible lines**; total hours and daily hours are always shown; no value lines visible → no value block at all.
- Theme follows the iPhone (light/dark); accent is neutral (black in light, white in dark); color only for warnings/errors.
- Interface is clean: little text, tap targets at least 44 px, no bottom tab bar; Settings (gear) and Export (share) icons at the top of Home.

## Review Focus

- Location denied, GPS slow, or offline: the entry still saves with a typed or empty address. (Task 7)
- Importing a corrupt or wrong-version backup must not wipe existing data. (Task 9)
- Shift crossing midnight, a week boundary, or the DST change on 2026-11-01 counts real elapsed time and stays in the start week. (Tasks 2, 3)
- Out before In, or break not shorter than the shift: no save, inline error on the field. (Tasks 2, 7)
- Text the PDF font cannot encode (emoji, non-Latin) in descriptions or addresses must not crash the export. (Task 10)

---

### Task 1: Scaffold, tooling, deploy pipeline

**Files:**
- Create: project at `/home/claude/Clock-in` (`package.json`, `vite.config.ts`, `vitest.config.ts`, `src/test-setup.ts`, `src/App.tsx`, `src/App.test.tsx`, `.github/workflows/deploy.yml`)
- Copy: `docs/` from `/home/claude/docs` into the repo

**Interfaces:**
- Produces: `npm test`, `npm run build`; `App` default export; tests run with `TZ=America/New_York` and `fake-indexeddb/auto` loaded.

- [ ] **Step 1:** In `/home/claude` run `npm create vite@latest Clock-in -- --template react-ts`, `cd Clock-in && git init`, install runtime deps (`idb maplibre-gl pdf-lib`) and dev deps (`tailwindcss @tailwindcss/vite vite-plugin-pwa vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fake-indexeddb`); copy `docs/` in.
- [ ] **Step 2:** Write failing `src/App.test.tsx::renders_home_landmark` asserting `getByRole('main', { name: 'Time clock' })`. Run `npx vitest run` — expect FAIL.
- [ ] **Step 3:** Implement `App()` returning `<main aria-label="Time clock">`; configure `vitest.config.ts` (jsdom, `setupFiles: src/test-setup.ts` importing `fake-indexeddb/auto` and `@testing-library/jest-dom`, `globalSetup` that sets `process.env.TZ = 'America/New_York'`); set Vite `base: process.env.VITE_BASE ?? '/Clock-in/'` and add the Tailwind plugin.
- [ ] **Step 4:** Add `.github/workflows/deploy.yml`: on push to `main`, `npm ci`, `npm test -- --run`, `npm run build`, then `actions/upload-pages-artifact` and `actions/deploy-pages` from `dist`.
- [ ] **Step 5:** Run `npx vitest run` and `npm run build` — expect PASS and a `dist/` folder. Commit `chore: scaffold app`.

### Task 2: Domain types and pure helpers

**Files:**
- Create: `src/domain/types.ts`, `money.ts`, `time.ts`, `weeks.ts`, `rates.ts`; tests beside each (`*.test.ts`)

**Interfaces:**
- Produces (`types.ts`): `Place {lat:number; lon:number; label:string}`, `RateChange {from:string; cents:number}`, `Employer {id; name; overtimeEnabled:boolean; archived:boolean; rates:RateChange[]}`, `TimeEntry {id; employerId; start; end; breakMin:number; rateCents:number; place?:Place}`, `Expense {id; employerId; date; description; amountCents:number; photoIds:string[]}`, `DaySchedule = {in:string; out:string; breakMin:number} | null`, `Settings {weekStartsOn:0|1|2|3|4|5|6; schedule:DaySchedule[]; recentPlaces:Place[]}`. Dates are `YYYY-MM-DD`, date-times `YYYY-MM-DDTHH:mm` (local, no zone), times `HH:mm`; `schedule[0]` is Sunday.
- Produces (`money.ts`): `formatUSD(cents:number):string`, `parseUSD(text:string):number|null`.
- Produces (`time.ts`): `shiftMinutes(e:{start:string;end:string;breakMin:number}):number`, `validateShift(e):'OUT_BEFORE_IN'|'BREAK_TOO_LONG'|null`, `formatDateTime(s:string):string`, `formatHours(minutes:number):string`.
- Produces (`weeks.ts`): `addDays(date:string,n:number):string`, `weekStartOf(date:string,weekStartsOn:number):string`, `weekDates(weekStart:string):string[]`, `weekLabel(weekStart:string):string`.
- Produces (`rates.ts`): `rateOn(e:Employer,date:string):number`, `addRateChange(e:Employer,c:RateChange):Employer`.

- [ ] **Step 1:** Write failing tests with these assertions: `formatUSD(123456)==='$1,234.56'`; `parseUSD('175.50')===17550`, `parseUSD('abc')===null`, `parseUSD('0')===null`; `shiftMinutes({start:'2026-10-05T07:00',end:'2026-10-05T15:30',breakMin:30})===480`; overnight `22:00→06:00` next day with break 0 `===480`; DST fall-back `2026-11-01T00:00→08:00`, break 0 `===540`; `validateShift` returns `'OUT_BEFORE_IN'` when end ≤ start and `'BREAK_TOO_LONG'` when `breakMin >= gross minutes`; `formatDateTime('2026-10-05T07:00')==='Mon, Oct 5 · 7:00 AM'`; `formatHours(480)==='8.0'`, `510→'8.5'`, `495→'8.25'`; `weekStartOf('2026-10-07',0)==='2026-10-04'`, `weekStartOf('2026-10-07',1)==='2026-10-05'`; `weekLabel('2026-10-04')==='Oct 4 – 10'`, `weekLabel('2026-10-25')==='Oct 25 – Nov 1'`; `rateOn` returns the latest change with `from <= date`, and the earliest rate for earlier dates; `addRateChange` with an existing `from` replaces it and keeps the list sorted ascending.
- [ ] **Step 2:** Run `npx vitest run src/domain` — expect FAIL (modules missing).
- [ ] **Step 3:** Implement the modules to the signatures above. `shiftMinutes` uses real elapsed time via local `Date` (not wall-clock subtraction), minus `breakMin`.
- [ ] **Step 4:** Run `npx vitest run src/domain` — expect PASS. Commit `feat: domain helpers`.

### Task 3: Pay engine

**Files:**
- Create: `src/domain/pay.ts`, `src/domain/pay.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `shiftMinutes`, `weekDates`.
- Produces: `computeWeek(input:{weekStart:string; entries:TimeEntry[]; expenses:Expense[]; employers:Employer[]}):WeekSummary`; `WeekSummary {totalMinutes; regularMinutes; overtimeMinutes; regularCents; overtimeCents; expensesCents; totalCents; byEmployer:EmployerWeek[]}`; `EmployerWeek {employerId; minutes; regularMinutes; overtimeMinutes; regularCents; overtimeCents; expensesCents; entries:TimeEntry[]; expenses:Expense[]}` (entries sorted by `start`).

- [ ] **Step 1:** Write failing tests: (a) 38.5 h at 3200¢, overtime on → `overtimeMinutes===0`, `regularCents===123200`; (b) 51.5 h at 3200¢, overtime on → `regularMinutes===2400`, `overtimeMinutes===690`, `regularCents===128000`, `overtimeCents===55200`; (c) same hours, overtime off → `overtimeCents===0`, `regularCents===164800`; (d) two employers at 30 h each → no overtime for either; (e) overtime portion uses the `rateCents` of the entry it falls in when rates differ between entries; (f) an entry starting Saturday 22:00 and ending Sunday 06:00 counts in the Saturday's week; (g) `expensesCents` sums expenses dated in the week, adds to `totalCents`, and is not multiplied; (h) an archived employer's data is still computed.
- [ ] **Step 2:** Run `npx vitest run src/domain/pay.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement `computeWeek`: per employer, walk entries in `start` order accumulating minutes; minutes beyond 2400 (when `overtimeEnabled`) are overtime; per segment cents = `Math.round(minutes * rateCents / 60)` (×1.5 for overtime) summed per entry.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: weekly pay engine`.

### Task 4: Storage layer

**Files:**
- Create: `src/data/db.ts`, `src/data/repo.ts`, `src/data/images.ts`, `src/data/repo.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces (`repo.ts`): `repo.listEmployers():Promise<Employer[]>`, `repo.saveEmployer(e)`, `repo.listEntriesBetween(fromDate,toDate):Promise<TimeEntry[]>` (by start date, inclusive), `repo.getEntry(id)`, `repo.saveEntry(e)`, `repo.deleteEntry(id)`, `repo.listExpensesBetween(fromDate,toDate)`, `repo.getExpense(id)`, `repo.saveExpense(e)`, `repo.deleteExpense(id)` (also deletes its photos), `repo.putPhoto(blob:Blob):Promise<string>`, `repo.getPhoto(id):Promise<Blob|undefined>`, `repo.deletePhoto(id)`, `repo.getSettings():Promise<Settings>`, `repo.saveSettings(s)`, `repo.addRecentPlace(p:Place)` (dedupe by `label`, newest first, max 8).
- Produces (`images.ts`): `resizeImage(file:Blob, maxEdge=1600):Promise<Blob>` (JPEG, quality 0.8), `requestPersistence():Promise<boolean>`.
- Default `Settings`: `weekStartsOn:0`, schedule Mon–Fri `07:00`–`15:30` break 30, Sunday and Saturday `null`, `recentPlaces:[]`.

- [ ] **Step 1:** Write failing tests in `repo.test.ts`: entries come back only within the date range; `deleteExpense` removes its photo blobs; `getSettings()` returns the defaults on a fresh DB; `addRecentPlace` keeps at most 8 and moves a repeated label to the front; `saveEmployer` then `listEmployers` round-trips `rates`.
- [ ] **Step 2:** Run `npx vitest run src/data` — expect FAIL.
- [ ] **Step 3:** Implement with `idb` (stores: `employers`, `entries` indexed by `start`, `expenses` indexed by `date`, `photos`, `settings`); `resizeImage` draws to a canvas, `requestPersistence` calls `navigator.storage.persist()` and returns `false` when unsupported.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: storage layer`. (`resizeImage` is browser-only; it is verified on a device in Task 12.)

### Task 5: Router, Settings, employers, schedule

**Files:**
- Create: `src/router.ts`, `src/screens/Settings.tsx`, `EmployerEdit.tsx`, `ScheduleEdit.tsx`, `src/screens/Settings.test.tsx`
- Modify: `src/App.tsx` (route table)

**Interfaces:**
- Consumes: `repo`, `addRateChange`, `rateOn`, `formatUSD`, `parseUSD`.
- Produces: `useRoute():{path:string; params:Record<string,string>}`, `navigate(path:string):void`; routes `/`, `/entry/new`, `/entry/:id`, `/expense/new`, `/expense/:id`, `/settings`, `/settings/employer/:id`, `/settings/schedule`, `/export` (hash-based: `#/settings`). `activeEmployers(all:Employer[]):Employer[]`.

- [ ] **Step 1:** Write failing tests: adding an employer "Acme" at `$32.00` stores `rates:[{from:<today>,cents:3200}]`; changing the rate adds a second `RateChange` and leaves an existing entry's `rateCents` untouched; "Delete employer" sets `archived:true` and `activeEmployers` omits it; the overtime switch saves `overtimeEnabled`; the Week starts on selector saves `weekStartsOn`; setting a day to Off saves `null`; an empty name or invalid rate shows an inline error and does not save.
- [ ] **Step 2:** Run `npx vitest run src/screens/Settings.test.tsx` — expect FAIL.
- [ ] **Step 3:** Implement the hash router and the three screens per the approved Settings / Edit employer layouts (sections Employers, Work, Data; rate history list; note "New rate applies to new entries only"). The Data section's backup buttons are wired in Task 9.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: settings and employers`.

### Task 6: Home screen

**Files:**
- Create: `src/screens/Home.tsx`, `src/components/NewChoiceSheet.tsx`, `src/components/LongPressMenu.tsx`, `src/screens/Home.test.tsx`

**Interfaces:**
- Consumes: `computeWeek`, `repo`, `weekLabel`, `addDays`, `formatUSD`, `formatHours`, `navigate`.
- Produces: `Home` (route `/`); `useLongPress(onLongPress:()=>void, ms=500)` returning pointer handlers.

- [ ] **Step 1:** Write failing tests: with fixture data the big balance shows `$1,415.50` and the detail line shows `38.5 h · $1,240.00 + $175.50 expenses`; with no expenses the detail line is only `38.5 h`; the ‹ › buttons change the label (`Oct 4 – 10` → `Oct 11 – 17`); a future week with nothing logged shows an empty state and `$0.00`; holding a row for 500 ms opens a menu with Edit and Delete; Delete asks for confirmation and removes the row; the "+" opens a choice between "Time entry" and "Expense" that navigates to `/entry/new` or `/expense/new`; header has gear → `/settings` and share → `/export`.
- [ ] **Step 2:** Run `npx vitest run src/screens/Home.test.tsx` — expect FAIL.
- [ ] **Step 3:** Implement per the approved "Balance first" design: week navigation on top, big balance, detail line, list rows (day · employer · hours, receipt icon rows for expenses), round "+" button, neutral accent.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: home screen`.

### Task 7: Time entry form and location

**Files:**
- Create: `src/location/geocode.ts`, `src/location/MapPicker.tsx`, `src/screens/EntryForm.tsx`, `src/location/geocode.test.ts`, `src/screens/EntryForm.test.tsx`

**Interfaces:**
- Consumes: `repo`, `rateOn`, `shiftMinutes`, `validateShift`, `formatHours`, `navigate`.
- Produces (`geocode.ts`): `searchAddress(q:string, signal?:AbortSignal):Promise<Place[]>` (Photon `https://photon.komoot.io/api/`, `limit=5`, `lang=en`), `reverseGeocode(lat:number, lon:number):Promise<Place>` (Nominatim `https://nominatim.openstreetmap.org/reverse`, `format=jsonv2`), `getCurrentPosition():Promise<{lat:number; lon:number; accuracyM:number}>` (`enableHighAccuracy: true`, 10 s timeout).
- Produces: `MapPicker({value:Place|null; onChange:(p:Place)=>void})` — MapLibre map with OpenFreeMap style `https://tiles.openfreemap.org/styles/liberty`, draggable pin, calls `reverseGeocode` once on drag end.

- [ ] **Step 1:** Write failing tests: `searchAddress` builds the Photon URL with `q` and `limit=5` and maps results to `Place` (mock `fetch`); `reverseGeocode` maps a Nominatim reply to a `Place`; EntryForm defaults In/Out/Break from the schedule for the chosen day (Monday → `7:00 AM`, `3:30 PM`, `30`); the Save button reads `Save · 8.0 h`; changing the employer buttons selects it; saving stores `rateCents = rateOn(employer, date)`; Out before In shows "Out must be after In" under Out and does not save; break ≥ shift shows "Break is longer than the shift"; when `fetch` rejects and GPS is denied, an entry with no place still saves; focusing the empty address search lists `recentPlaces`, and choosing one fills the place; saving adds the place to recents.
- [ ] **Step 2:** Run `npx vitest run src/location src/screens/EntryForm.test.tsx` — expect FAIL.
- [ ] **Step 3:** Implement `geocode.ts`, `MapPicker` (MapLibre is mocked in tests; the real map is checked on a device in Task 12), and `EntryForm` as a single page (employer buttons; In and Out as one date-time field each; Break; address search with suggestions and recents; map; Save). New entries open the map on GPS position, falling back to the last recent place. Search requests are debounced 400 ms and abort the previous one. Edit mode (`/entry/:id`) reuses the form and keeps the stored `rateCents` unless the employer changes.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: time entry with location`.

### Task 8: Expense form

**Files:**
- Create: `src/screens/ExpenseForm.tsx`, `src/components/PhotoPicker.tsx`, `src/screens/ExpenseForm.test.tsx`

**Interfaces:**
- Consumes: `repo`, `resizeImage`, `parseUSD`, `formatUSD`.
- Produces: `PhotoPicker({photoIds:string[]; onChange:(ids:string[])=>void; max=3})`.

- [ ] **Step 1:** Write failing tests: empty or invalid amount shows "Enter an amount" and does not save; a valid save stores `amountCents`, the employer, today's date and photo ids; a fourth photo is refused with "Up to 3 photos"; removing a photo and saving deletes its blob; an empty description is stored as `"Expense"`; the Save button reads `Save · $175.50`; edit mode (`/expense/:id`) loads the existing values.
- [ ] **Step 2:** Run `npx vitest run src/screens/ExpenseForm.test.tsx` — expect FAIL.
- [ ] **Step 3:** Implement per the approved form (employer buttons, Description, Amount, Date, three photo slots). `PhotoPicker` offers two actions: camera (`<input type="file" accept="image/*" capture="environment">`) and library (`accept="image/*"`); each file goes through `resizeImage` then `repo.putPhoto`. If `putPhoto` throws, show "Couldn't save the photo. Free some space and try again." and keep the form.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: expenses with receipts`.

### Task 9: Backup export and import

**Files:**
- Create: `src/data/backup.ts`, `src/data/backup.test.ts`
- Modify: `src/screens/Settings.tsx` (wire the buttons)

**Interfaces:**
- Consumes: `repo`, all stores in `db.ts`.
- Produces: `exportBackup():Promise<Blob>` (JSON, `{version:1, ...stores, photos as base64 data URLs}`), `importBackup(file:Blob):Promise<void>` (throws `BackupError`), `class BackupError extends Error`.

- [ ] **Step 1:** Write failing tests: export → wipe → import restores employers, entries, expenses, settings and the exact photo bytes; invalid JSON, a wrong `version`, or a missing store throws `BackupError` and leaves existing data unchanged; import replaces the data in a single transaction.
- [ ] **Step 2:** Run `npx vitest run src/data/backup.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement `backup.ts` (validate the whole file before opening the write transaction) and wire Settings: Export backup uses `navigator.share({files})` when available, else a download link; Import backup asks "Replace all data on this device?" before calling `importBackup`, and shows the error text on `BackupError`.
- [ ] **Step 4:** Run the tests — expect PASS. Commit `feat: backup export and import`.

### Task 10: Report model, PDF, and Export screen

**Files:**
- Create: `src/export/options.ts`, `report.ts`, `pdf.ts`, `src/screens/Export.tsx`, tests `report.test.ts`, `pdf.test.ts`, `src/screens/Export.test.tsx`

**Interfaces:**
- Consumes: `EmployerWeek`, `Employer`, `formatUSD`, `formatHours`, `formatDateTime`, `repo.getPhoto`.
- Produces (`options.ts`): `ReportOptions {regularPay; overtimePay; expenses; hourlyRate; addresses; timesAndBreak: boolean}`, `defaultOptions:ReportOptions` (all `true`).
- Produces (`report.ts`): `buildReportModel(week:EmployerWeek, employer:Employer, weekStart:string, o:ReportOptions):ReportModel`; `ReportModel {employerName; weekLabel; rateLabel?:string; hoursTotal:string; valueLines:{label:string; detail?:string; cents:number}[]; totalCents:number|null; days:{label:string; hours:string; detail?:string}[]; expenseItems:{description:string; cents:number}[]; receipts:{description; employerName; dateLabel; amountCents; photoId; index:number; count:number}[]}`.
- Produces (`pdf.ts`): `renderPdf(models:ReportModel[], getPhoto:(id:string)=>Promise<Blob|undefined>):Promise<Uint8Array>`; `sanitizeForPdf(text:string):string`.

- [ ] **Step 1:** Write failing `report.test.ts`: with all options on, `valueLines` are Regular pay, Overtime pay, Expenses and `totalCents` is their sum; with `overtimePay:false` the Overtime line is absent, `totalCents` excludes it, and `hoursTotal` still includes overtime hours; with all three value options off, `valueLines` is empty and `totalCents===null`; `expenses:false` → no `expenseItems` and no `receipts`; `hourlyRate:false` → no `rateLabel`; `addresses:false`/`timesAndBreak:false` remove those parts of each day's `detail`.
- [ ] **Step 2:** Write failing `pdf.test.ts`: one employer, no expenses → 1 page of `1080 × 1920`; two expenses with 3 photos total and `expenses:true` → 4 pages; `sanitizeForPdf('Paint 🎨 ñ')==='Paint ? ñ'`; rendering a description with an emoji does not throw.
- [ ] **Step 3:** Write failing `Export.test.tsx`: every toggle and every employer starts on each time the screen opens (nothing remembered); selecting two employers produces both in the PDF; "Share PDF" uses `navigator.share` with a `.pdf` file, else downloads.
- [ ] **Step 4:** Run `npx vitest run src/export src/screens/Export.test.tsx` — expect FAIL.
- [ ] **Step 5:** Implement `report.ts`, `pdf.ts` (`pdf-lib`, standard Helvetica, centered layout with generous spacing per the approved page-1 and "RECEIPT n OF m" receipt designs; for several employers, emit each employer's pages in turn; embed JPEG photos scaled to fit, preserving aspect ratio) and `Export.tsx` (Employers checkboxes, Show toggles in groups Amounts / Details, Share PDF button).
- [ ] **Step 6:** Run the tests — expect PASS. Commit `feat: PDF export`.

### Task 11: PWA, theme, polish

**Files:**
- Create: `public/icons/*` (192, 512, maskable 512, `apple-touch-icon.png` 180), `src/styles/theme.css`, `src/pwa.test.ts`
- Modify: `vite.config.ts`, `index.html`, `src/main.tsx`

**Interfaces:**
- Consumes: `requestPersistence`.
- Produces: installable manifest; CSS variables `--bg`, `--fg`, `--muted`, `--border`, `--accent`, `--danger` for light and dark.

- [ ] **Step 1:** Write failing `src/pwa.test.ts` that reads the generated manifest config and asserts `display==='standalone'`, `start_url` and `scope` equal `base`, and icons of 192 and 512 are present; and that `theme.css` defines the variables inside both `:root` and `@media (prefers-color-scheme: dark)`.
- [ ] **Step 2:** Run `npx vitest run src/pwa.test.ts` — expect FAIL.
- [ ] **Step 3:** Configure `vite-plugin-pwa` (precache the app shell so the app opens offline; `registerType: 'autoUpdate'`), add iOS meta tags (`apple-mobile-web-app-capable`, status bar, `apple-touch-icon`), apply the neutral light/dark theme, and call `requestPersistence()` once on first launch (when it returns `false`, show a dismissible note recommending regular backups).
- [ ] **Step 4:** Run `npx vitest run` and `npm run build` — expect PASS and a `dist/manifest.webmanifest`. Commit `feat: PWA and theme`.

### Task 12: Quality pass and release

**Files:**
- Modify: any file the audit flags; create `docs/superpowers/plans/device-checklist.md`

- [ ] **Step 1:** Install Impeccable (github.com/pbakaus/impeccable) following its README, run its audit over the app's CSS and spacing, apply the fixes, and re-run until it reports no remaining issues.
- [ ] **Step 2:** Check accessibility in both themes: every control has a label, tap targets ≥ 44 px, visible focus, text contrast ≥ 4.5:1; fix findings.
- [ ] **Step 3:** Run `npx vitest run` and `npm run build` — expect all PASS.
- [ ] **Step 4:** User creates the public repo on `diecky7` (name must match `VITE_BASE`, default `Clock-in`) and the GitHub connection for that account is available; push `main`; enable Pages with source "GitHub Actions"; confirm the workflow run succeeds and the site opens at `https://diecky7.github.io/Clock-in/`.
- [ ] **Step 5:** Write `device-checklist.md` with the checks below, then run them on the iPhone: add to Home Screen and reopen offline; GPS fills the address and dragging the pin updates it; typed address search and recents work; camera and library photos attach to an expense; week balance and overtime match a hand calculation for one real week; "Share PDF" sends a readable PDF through WhatsApp with zoomable receipts; backup export then import on a cleared app restores everything.
- [ ] **Step 6:** Commit `chore: polish and release`.
