import Modal from '../components/Modal'
import MarkReceivedDialog from '../components/MarkReceivedDialog'
import DateTimeField from '../components/DateTimeField'
import { formatDay } from '../domain/time'
import { addDays } from '../domain/weeks'
import { APP_VERSION } from '../version'
import { updateApp } from '../pwa-update'
import { saveBackup } from '../data/saveBackup'
import { CHANGELOG } from '../changelog'
import PersistenceNote from '../components/PersistenceNote'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackupError, importBackup } from '../data/backup'
import * as repo from '../data/repo'
import { Screen, Section, inputCls } from '../components/ui'
import { activeEmployers, isSideJob } from '../domain/employers'
import { formatUSD } from '../domain/money'
import { rateOn } from '../domain/rates'
import { today } from '../domain/today'
import type { Employer, Settings as SettingsData } from '../domain/types'
import { DEFAULT_NEARBY_FT } from '../location/distance'
import { navigate } from '../router'
import { DATA_CHANGED, offerUndo } from '../undo'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const NEARBY_OPTIONS = [
  { ft: 0, label: 'Off' },
  { ft: 250, label: '250 ft' },
  { ft: 500, label: '500 ft' },
  { ft: 1000, label: '1,000 ft' },
  { ft: 2640, label: '0.5 mi' },
  { ft: 5280, label: '1 mi' },
]

const rowCls = 'flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-base'
const divider = 'border-t border-border first:border-t-0'

export function scheduleSummary(s: SettingsData): string {
  const on = s.schedule.filter(Boolean).length
  return on === 0 ? 'All days off' : `${on} days a week`
}

export default function Settings() {
  const [employers, setEmployers] = useState<Employer[]>([])
  const [settings, setSettings] = useState<SettingsData | null>(null)

  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [marking, setMarking] = useState(false)
  const [dataMsg, setDataMsg] = useState<{ text: string; error: boolean } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    const [e, s] = await Promise.all([repo.listEmployers(), repo.getSettings()])
    setEmployers(e)
    setSettings(s)
  }, [])

  useEffect(() => {
    let alive = true
    void Promise.all([repo.listEmployers(), repo.getSettings()]).then(([e, s]) => {
      if (!alive) return
      setEmployers(e)
      setSettings(s)
    })
    const onUndo = () => void reload()
    window.addEventListener(DATA_CHANGED, onUndo)
    return () => {
      alive = false
      window.removeEventListener(DATA_CHANGED, onUndo)
    }
  }, [reload])

  async function doExport() {
    setDataMsg(null)
    try {
      await saveBackup()
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return // share sheet dismissed
      setDataMsg({ text: "Couldn't create the backup.", error: true })
    }
  }

  async function doImport() {
    const file = pendingImport
    setPendingImport(null)
    if (!file) return
    try {
      await importBackup(file)
      await reload()
      setDataMsg({ text: 'Backup restored.', error: false })
    } catch (err) {
      setDataMsg({
        text: err instanceof BackupError ? err.message : "Couldn't restore the backup. Your existing data was not changed.",
        error: true,
      })
    }
  }

  async function patch(partial: Partial<SettingsData>) {
    if (!settings) return
    const before = settings
    const next = { ...settings, ...partial }
    setSettings(next)
    await repo.saveSettings(next)
    // Put back only the fields this change touched, so a later change isn't lost.
    const old = Object.fromEntries(Object.keys(partial).map((k) => [k, before[k as keyof SettingsData]])) as Partial<SettingsData>
    offerUndo('Setting changed', async () => repo.saveSettings({ ...(await repo.getSettings()), ...old }))
  }

  const now = today()
  return (
    <Screen title="Settings" back="/">
      <PersistenceNote />
      <Section title="App">
        <div className={divider}>
          <button type="button" className={rowCls} onClick={() => void updateApp()}>
            <span>Update app</span>
            <span className="text-muted" aria-label={`Version ${APP_VERSION}`}>v{APP_VERSION}</span>
          </button>
        </div>
      </Section>
      <Section title="Employers">
        {activeEmployers(employers).filter((e) => !isSideJob(e.id)).map((e) => (
          <div key={e.id} className={divider}>
            <button type="button" className={rowCls} onClick={() => navigate(`/settings/employer/${e.id}`)}>
              <span>{e.name}</span>
              <span className="text-muted">{formatUSD(rateOn(e, now))}/h</span>
            </button>
          </div>
        ))}
        <div className={divider}>
          <button type="button" className={`${rowCls} font-medium`} onClick={() => navigate('/settings/employer/new')}>
            Add employer
          </button>
        </div>
      </Section>

      {settings && (
        <Section title="Work">
          <div className={divider}>
            <button type="button" className={rowCls} onClick={() => navigate('/settings/schedule')}>
              <span>Default schedule</span>
              <span className="text-muted">{scheduleSummary(settings)}</span>
            </button>
          </div>
          <div className={`${rowCls} ${divider} py-2`}>
            <div>
              <label htmlFor="week-start">Week starts on</label>
              <p className="text-sm text-muted">Ends on {DAYS[(settings.weekStartsOn + 6) % 7]}</p>
            </div>
            <select
              id="week-start"
              className={`${inputCls} !w-auto`}
              value={settings.weekStartsOn}
              onChange={(ev) => void patch({ weekStartsOn: Number(ev.target.value) as SettingsData['weekStartsOn'] })}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className={`${divider} px-4 pb-3`}>
            <DateTimeField
              type="date"
              label="Biweekly period starts on"
              value={settings.biweeklyStart ?? ''}
              onChange={(v) => void patch({ biweeklyStart: v || undefined })}
              className="mt-3"
            />
            <div className="mt-1 flex min-h-11 items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {settings.biweeklyStart
                  ? `Ends on ${formatDay(addDays(settings.biweeklyStart, 13))} · repeats every 14 days`
                  : 'Not set: two weeks count from Jan 2026'}
              </p>
              {settings.biweeklyStart && (
                <button type="button" className="min-h-11 shrink-0 px-2 text-sm text-muted" onClick={() => void patch({ biweeklyStart: undefined })}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className={`${rowCls} ${divider} py-2`}>
            <label htmlFor="nearby">Ask about saved address within</label>
            <select
              id="nearby"
              className={`${inputCls} !w-auto`}
              value={settings.nearbyFeet ?? DEFAULT_NEARBY_FT}
              onChange={(ev) => void patch({ nearbyFeet: Number(ev.target.value) })}
            >
              {NEARBY_OPTIONS.map((o) => (
                <option key={o.ft} value={o.ft}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </Section>
      )}

      {settings && (settings.accounts ?? []).length > 0 && (
        <Section title="Accounts">
          {(settings.accounts ?? []).map((a) => (
            <div key={a.id} className={`${rowCls} ${divider}`}>
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                aria-label={`Delete ${a.name}`}
                className="min-h-11 shrink-0 px-2 text-base text-danger"
                onClick={() => {
                  void (async () => {
                    const before = settings.accounts ?? []
                    await repo.deleteAccount(a.id)
                    setSettings({ ...settings, accounts: before.filter((x) => x.id !== a.id) })
                    offerUndo(`Account “${a.name}” deleted`, async () => repo.saveSettings({ ...(await repo.getSettings()), accounts: before }))
                  })()
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </Section>
      )}

      <Section title="Data">
        <div className={divider}>
          <button type="button" className={rowCls} onClick={() => void doExport()}>
            Export backup
          </button>
        </div>
        <div className={divider}>
          <button type="button" className={rowCls} onClick={() => fileInput.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              setDataMsg(null)
              setPendingImport(f)
            }}
          />
        </div>
        <div className={divider}>
          <button type="button" className={rowCls} onClick={() => setMarking(true)}>
            Mark older work as received
          </button>
        </div>
      </Section>
      {marking && <MarkReceivedDialog onClose={() => setMarking(false)} />}
      {dataMsg && (
        <p role={dataMsg.error ? 'alert' : 'status'} className={`mt-3 text-sm ${dataMsg.error ? 'text-danger' : 'text-muted'}`}>
          {dataMsg.text}
        </p>
      )}
      {pendingImport && (
        <Modal label="Replace data" placement="bottom" onClose={() => setPendingImport(null)}>
            <p className="px-2 py-3 text-center text-base">Replace all data on this device?</p>
            <button type="button" className="min-h-12 w-full rounded-xl bg-danger font-medium text-accent-fg" onClick={() => void doImport()}>
              Replace
            </button>
            <button type="button" className="min-h-12 w-full rounded-xl text-muted" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
        </Modal>
      )}
      <Section title="What's new">
        {CHANGELOG.map((r, i) => (
          <details key={r.version} open={i === 0} className={`group ${divider}`}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base [&::-webkit-details-marker]:hidden">
              <span>
                v{r.version} <span className="text-muted">· {r.date}</span>
              </span>
              <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <ul className="list-disc space-y-1.5 pb-4 pl-10 pr-4 text-base text-muted">
              {r.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        ))}
      </Section>
    </Screen>
  )
}
