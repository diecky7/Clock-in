import { useCallback, useEffect, useRef, useState } from 'react'
import { BackupError, exportBackup, importBackup } from '../data/backup'
import { shareOrDownload } from '../data/shareFile'
import * as repo from '../data/repo'
import { Screen, Section, inputCls } from '../components/ui'
import { activeEmployers } from '../domain/employers'
import { formatUSD } from '../domain/money'
import { rateOn } from '../domain/rates'
import { today } from '../domain/today'
import type { Employer, Settings as SettingsData } from '../domain/types'
import { navigate } from '../router'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
    return () => {
      alive = false
    }
  }, [])

  async function doExport() {
    setDataMsg(null)
    try {
      const blob = await exportBackup()
      const file = new File([blob], `clock-in-backup-${today()}.json`, { type: 'application/json' })
      await shareOrDownload(file)
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

  async function setWeekStart(v: number) {
    if (!settings) return
    const next = { ...settings, weekStartsOn: v as SettingsData['weekStartsOn'] }
    setSettings(next)
    await repo.saveSettings(next)
  }

  const now = today()
  return (
    <Screen title="Settings" back="/">
      <Section title="Employers">
        {activeEmployers(employers).map((e) => (
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
          <div className={`${rowCls} ${divider}`}>
            <label htmlFor="week-start">Week starts on</label>
            <select
              id="week-start"
              className={`${inputCls} !w-auto`}
              value={settings.weekStartsOn}
              onChange={(ev) => void setWeekStart(Number(ev.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
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
      </Section>
      {dataMsg && (
        <p role={dataMsg.error ? 'alert' : 'status'} className={`mt-3 text-sm ${dataMsg.error ? 'text-danger' : 'text-muted'}`}>
          {dataMsg.text}
        </p>
      )}
      {pendingImport && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={() => setPendingImport(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Replace data"
            className="mx-auto w-full max-w-md space-y-2 rounded-t-3xl bg-bg p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2 py-3 text-center text-base">Replace all data on this device?</p>
            <button type="button" className="min-h-12 w-full rounded-xl bg-danger font-medium text-white" onClick={() => void doImport()}>
              Replace
            </button>
            <button type="button" className="min-h-12 w-full rounded-xl text-muted" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Screen>
  )
}
