import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import { formatUSD } from '../domain/money'
import type { ReportModel, ReportReceipt } from './report'

const W = 1080
const H = 1920
const MARGIN = 90
const CW = W - MARGIN * 2
const BOTTOM = 170 // keeps clear of the footer
const INK = rgb(0.07, 0.07, 0.07)
const GREY = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.86, 0.86, 0.86)
const BOX = rgb(0.94, 0.94, 0.94)

// Characters beyond Latin-1 that Helvetica's WinAnsi encoding can draw.
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

export function sanitizeForPdf(text: string): string {
  let out = ''
  for (const ch of (text ?? '').replace(/[\r\n\t]+/g, ' ')) {
    const c = ch.codePointAt(0)!
    const ok = (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(c)
    out += ok ? ch : '?'
  }
  return out
}

interface Fonts { regular: PDFFont; bold: PDFFont }
type Align = 'left' | 'center' | 'right'

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const s = sanitizeForPdf(text)
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s
  const chars = Array.from(s)
  while (chars.length > 0 && font.widthOfTextAtSize(chars.join('').trimEnd() + '…', size) > maxWidth) chars.pop()
  return chars.join('').trimEnd() + '…'
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const words = sanitizeForPdf(text).split(' ').filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]
    if (font.widthOfTextAtSize(next, size) <= maxWidth) { cur = next; continue }
    if (cur) {
      lines.push(cur)
      cur = ''
      if (lines.length === maxLines) break
      i--
    } else {
      lines.push(fit(words[i], font, size, maxWidth)) // single word too long
      if (lines.length === maxLines) break
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  const consumed = lines.join(' ')
  if (consumed.replace(/…$/, '').length < words.join(' ').length && lines.length) {
    const last = lines.length - 1
    lines[last] = fit(lines[last].replace(/…$/, '') + ' …', font, size, maxWidth)
  }
  return lines
}

interface TextOpts { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; align?: Align; x?: number; maxWidth?: number; spacing?: number }

/** Draws text whose top edge is at `top` (distance from page top). */
function text(page: PDFPage, s: string, top: number, o: TextOpts) {
  const maxWidth = o.maxWidth ?? CW
  const spacing = o.spacing ?? 0
  const str = fit(s, o.font, o.size, maxWidth)
  const w = o.font.widthOfTextAtSize(str, o.size) + spacing * Math.max(0, str.length - 1)
  const align = o.align ?? 'left'
  const base = o.x ?? MARGIN
  const x = align === 'center' ? W / 2 - w / 2 : align === 'right' ? base - w + (o.x === undefined ? CW : 0) : base
  page.drawText(str, {
    x, y: H - top - o.size * 0.8, size: o.size, font: o.font, color: o.color ?? INK,
    ...(spacing ? { characterSpacing: spacing } : {}),
  })
}

function rule(page: PDFPage, top: number, color = LIGHT, thickness = 2) {
  page.drawLine({ start: { x: MARGIN, y: H - top }, end: { x: W - MARGIN, y: H - top }, thickness, color })
}

async function blobBytes(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') return new Uint8Array(await b.arrayBuffer())
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer))
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(b)
  })
}

async function embedPhoto(doc: PDFDocument, blob: Blob | undefined): Promise<PDFImage | null> {
  if (!blob) return null
  try {
    const bytes = await blobBytes(blob)
    const isPng = blob.type === 'image/png' || (bytes[0] === 0x89 && bytes[1] === 0x50)
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  } catch {
    return null
  }
}

class Layout {
  pages: PDFPage[] = []
  page!: PDFPage
  top = 0
  private doc: PDFDocument
  private f: Fonts
  constructor(doc: PDFDocument, f: Fonts) { this.doc = doc; this.f = f }

  newPage(): PDFPage {
    this.page = this.doc.addPage([W, H])
    this.pages.push(this.page)
    return this.page
  }

  continuation(m: ReportModel) {
    this.newPage()
    text(this.page, 'TIME REPORT (cont.)', 130, { size: 26, font: this.f.regular, color: GREY, align: 'center', spacing: 6 })
    text(this.page, m.employerName, 190, { size: 40, font: this.f.bold, align: 'center' })
    this.top = 290
  }

  ensure(m: ReportModel, needed: number) {
    if (this.top + needed > H - BOTTOM) this.continuation(m)
  }

  heading(m: ReportModel, label: string) {
    this.ensure(m, 140)
    text(this.page, label, this.top, { size: 24, font: this.f.regular, color: GREY, spacing: 5 })
    rule(this.page, this.top + 44)
    this.top += 64
  }

  report(m: ReportModel) {
    const { regular, bold } = this.f
    const p = this.newPage()
    text(p, 'TIME REPORT', 130, { size: 26, font: regular, color: GREY, align: 'center', spacing: 6 })
    let nameSize = 68
    while (nameSize > 40 && bold.widthOfTextAtSize(sanitizeForPdf(m.employerName), nameSize) > CW) nameSize -= 2
    text(p, m.employerName, 215 + (68 - nameSize) / 2, { size: nameSize, font: bold, align: 'center' })
    text(p, m.weekLabel, 310, { size: 38, font: regular, color: GREY, align: 'center' })
    let y = 370
    if (m.rateLabel) { text(p, m.rateLabel, y, { size: 30, font: regular, color: GREY, align: 'center' }); y += 50 }

    text(p, 'TOTAL HOURS', y + 90, { size: 24, font: regular, color: GREY, align: 'center', spacing: 5 })
    text(p, m.hoursTotal, y + 140, { size: 170, font: bold, align: 'center' })
    this.top = y + 380

    if (m.valueLines.length) {
      for (const l of m.valueLines) {
        this.ensure(m, 80)
        text(this.page, l.label, this.top, { size: 34, font: bold, maxWidth: 400 })
        const lw = bold.widthOfTextAtSize(sanitizeForPdf(l.label), 34)
        if (l.detail) text(this.page, l.detail, this.top + 4, { size: 28, font: regular, color: GREY, x: MARGIN + Math.min(lw, 400) + 20, maxWidth: 260 })
        text(this.page, formatUSD(l.cents), this.top, { size: 34, font: regular, align: 'right', maxWidth: 280, x: W - MARGIN })
        this.top += 70
      }
      if (m.totalCents !== null) {
        this.ensure(m, 110)
        rule(this.page, this.top + 6, INK, 3)
        this.top += 30
        text(this.page, 'Total', this.top, { size: 44, font: bold })
        text(this.page, formatUSD(m.totalCents), this.top, { size: 44, font: bold, align: 'right', maxWidth: 400, x: W - MARGIN })
        this.top += 90
      }
    }

    if (m.expenseItems.length) {
      this.top += 40
      this.heading(m, 'EXPENSES')
      for (const x of m.expenseItems) {
        this.ensure(m, 56)
        text(this.page, x.description, this.top, { size: 30, font: regular, maxWidth: CW - 260 })
        text(this.page, formatUSD(x.cents), this.top, { size: 30, font: regular, align: 'right', maxWidth: 240, x: W - MARGIN })
        this.top += 56
      }
    }

    if (m.days.length) {
      this.top += 40
      this.heading(m, 'DAYS')
      for (const d of m.days) {
        const rowH = d.detail ? 112 : 78
        this.ensure(m, rowH)
        const pg = this.page
        text(pg, d.label, this.top, { size: 30, font: bold, maxWidth: 260 })
        if (d.times) text(pg, d.times, this.top + 1, { size: 28, font: regular, color: GREY, x: MARGIN + 290, maxWidth: 400 })
        text(pg, d.hours, this.top, { size: 30, font: bold, align: 'right', maxWidth: 160, x: W - MARGIN })
        if (d.detail) text(pg, d.detail, this.top + 44, { size: 24, font: regular, color: GREY })
        rule(pg, this.top + rowH - 20, rgb(0.93, 0.93, 0.93), 1.5)
        this.top += rowH
      }
    }
  }

  async receipt(r: ReportReceipt, photo: PDFImage | null) {
    const { regular, bold } = this.f
    const p = this.newPage()
    text(p, `RECEIPT ${r.index} OF ${r.count}`, 130, { size: 26, font: regular, color: GREY, align: 'center', spacing: 6 })
    const lines = wrap(r.description, bold, 52, CW, 2)
    let y = 215
    for (const l of lines) { text(p, l, y, { size: 52, font: bold, align: 'center' }); y += 66 }
    y += 14
    text(p, `${r.employerName} · ${r.dateLabel}`, y, { size: 30, font: regular, color: GREY, align: 'center' })
    y += 64
    text(p, formatUSD(r.amountCents), y, { size: 110, font: bold, align: 'center' })
    y += 170

    const areaTop = y
    const areaH = H - BOTTOM - areaTop
    if (photo) {
      const s = Math.min(CW / photo.width, areaH / photo.height)
      const w = photo.width * s
      const h = photo.height * s
      p.drawImage(photo, { x: W / 2 - w / 2, y: H - areaTop - h - (areaH - h) / 2, width: w, height: h })
    } else {
      const bh = Math.min(areaH, 700)
      p.drawRectangle({ x: MARGIN, y: H - areaTop - bh, width: CW, height: bh, color: BOX })
      text(p, 'Photo unavailable', areaTop + bh / 2 - 15, { size: 32, font: regular, color: GREY, align: 'center' })
    }
  }
}

export async function renderPdf(
  models: ReportModel[],
  getPhoto: (id: string) => Promise<Blob | undefined>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  const layout = new Layout(doc, fonts)
  for (const m of models) {
    layout.report(m)
    for (const r of m.receipts) {
      let blob: Blob | undefined
      try { blob = await getPhoto(r.photoId) } catch { blob = undefined }
      await layout.receipt(r, await embedPhoto(doc, blob))
    }
  }
  const total = layout.pages.length
  if (total > 1) {
    layout.pages.forEach((pg, i) => {
      text(pg, `Page ${i + 1} of ${total}`, H - 110, { size: 24, font: fonts.regular, color: GREY, align: 'center' })
    })
  }
  return doc.save()
}
