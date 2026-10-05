import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareOrDownload } from './shareFile'

const file = new File(['x'], 'report.pdf', { type: 'application/pdf' })
let click: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined })
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})
afterEach(() => {
  click.mockRestore()
  vi.unstubAllGlobals()
})

describe('shareOrDownload', () => {
  it('opens the share sheet when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    await shareOrDownload(file)
    expect(share).toHaveBeenCalledWith({ files: [file] })
    expect(click).not.toHaveBeenCalled()
  })

  it('does nothing more when the user dismisses the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    await shareOrDownload(file)
    expect(click).not.toHaveBeenCalled()
  })

  it('downloads the file when iOS refuses to share it', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('no gesture'), { name: 'NotAllowedError' }))
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    await shareOrDownload(file)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('downloads the file when sharing files is not supported', async () => {
    vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined })
    await shareOrDownload(file)
    expect(click).toHaveBeenCalledTimes(1)
  })
})
