import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { renderPdf, sanitizeForPdf } from './pdf'
import type { ReportModel } from './report'

const JPG = '/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAGAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAXEAEAAwAAAAAAAAAAAAAAAAAAAhRh/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAYEQACAwAAAAAAAAAAAAAAAAAAAQQUUv/aAAwDAQACEQMRAD8AlrctAVFCNhCLsjbP/9k='
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAYAAAAIAQMAAADgCBx7AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURQCAAP///xQ/L08AAAABYktHRAH/Ai3eAAAAB3RJTUUH6goFFi0y9jOuegAAAAtJREFUCNdjYEAFAAAQAAGhxSHBAAAAAElFTkSuQmCC'
const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

function model(over: Partial<ReportModel> = {}): ReportModel {
  return {
    employerName: 'Acme Painting',
    weekLabel: 'Oct 5 – 11',
    rateLabel: '$30.00/h',
    hoursTotal: '38.5 h',
    valueLines: [{ label: 'Regular pay', detail: '38.5 h', cents: 115500 }],
    totalCents: 115500,
    days: [{ label: 'Mon, Oct 5', times: '7:00 AM – 3:30 PM', hours: '8.0 h', detail: '30 min break · 12 Main St' }],
    expenseItems: [],
    receipts: [],
    ...over,
  }
}
const receipt = (i: number, count: number, photoId: string) => ({
  description: 'Brushes', employerName: 'Acme Painting', dateLabel: 'Wed, Oct 7', amountCents: 2500, photoId, index: i, count,
})
const photos = async (id: string) =>
  id === 'p1' ? new Blob([bytes(JPG)], { type: 'image/jpeg' })
  : id === 'p2' ? new Blob([bytes(PNG)], { type: 'image/png' })
  : id === 'p3' ? new Blob([bytes(JPG)], { type: 'image/jpeg' })
  : undefined

async function load(models: ReportModel[], get = photos) {
  return PDFDocument.load(await renderPdf(models, get))
}

describe('sanitizeForPdf', () => {
  it('replaces unencodable characters, keeps WinAnsi ones', () => {
    expect(sanitizeForPdf('Paint 🎨 ñ')).toBe('Paint ? ñ')
    expect(sanitizeForPdf('a\nb\tc')).toBe('a b c')
  })
})

describe('renderPdf', () => {
  it('one employer without expenses is one 1080x1920 page', async () => {
    const doc = await load([model()])
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getSize()).toEqual({ width: 1080, height: 1920 })
  })
  it('three photos give four pages', async () => {
    const m = model({
      expenseItems: [{ description: 'Brushes', cents: 2500 }, { description: 'Tape', cents: 1000 }],
      receipts: [receipt(1, 3, 'p1'), receipt(2, 3, 'p2'), receipt(3, 3, 'p3')],
    })
    expect((await load([m])).getPageCount()).toBe(4)
  })
  it('emoji in a description does not throw', async () => {
    const m = model({ expenseItems: [{ description: 'Paint 🎨', cents: 100 }], receipts: [{ ...receipt(1, 1, 'p1'), description: 'Paint 🎨' }] })
    await expect(renderPdf([m], photos)).resolves.toBeInstanceOf(Uint8Array)
  })
  it('missing photo does not throw', async () => {
    const m = model({ receipts: [receipt(1, 1, 'nope')] })
    const doc = await load([m], async () => undefined)
    expect(doc.getPageCount()).toBe(2)
  })
  it('30 day rows overflow to extra pages of the same size', async () => {
    const days = Array.from({ length: 30 }, (_, i) => ({ label: `Day ${i}`, times: '7:00 AM – 3:30 PM', hours: '8.0 h', detail: '30 min break' }))
    const doc = await load([model({ days })])
    expect(doc.getPageCount()).toBeGreaterThan(1)
    for (const p of doc.getPages()) expect(p.getSize()).toEqual({ width: 1080, height: 1920 })
  })
  it('several employers render in sequence', async () => {
    const doc = await load([model(), model({ employerName: 'Other' })])
    expect(doc.getPageCount()).toBe(2)
  })
})
