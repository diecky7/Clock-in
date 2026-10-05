import { useEffect, useState } from 'react'
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
          <button type="button" id="export-backup" className={rowCls}>
            Export backup
          </button>
        </div>
        <div className={divider}>
          <button type="button" id="import-backup" className={rowCls}>
            Import backup
          </button>
        </div>
      </Section>
    </Screen>
  )
}
