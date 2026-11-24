import { today } from '../domain/today'
import { exportBackup } from './backup'
import { shareOrDownload } from './shareFile'

/** Builds a backup of everything and hands it to the share sheet (or saves it as a download). */
export async function saveBackup(): Promise<void> {
  const blob = await exportBackup()
  await shareOrDownload(new File([blob], `clock-in-backup-${today()}.json`, { type: 'application/json' }))
}
