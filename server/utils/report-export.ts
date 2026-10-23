import { createHash } from 'node:crypto'
import PDFDocument from 'pdfkit'
import type {
  AttendanceReport,
  AttendanceReportLayoutBundle,
  AttendanceReportLayoutHeadingPart,
  AttendanceReportLayoutPage,
  AttendanceReportLayoutRow,
  AttendanceReportPaper,
  AttendanceReportPaperPlan,
  AttendanceReportRow,
} from '../../app/types/attendance-report.ts'

export const ATTENDANCE_REPORT_LAYOUT_VERSION = 'rep-001d-v1'
export const ATTENDANCE_REPORT_EMPTY_MESSAGE = 'Tidak ada siswa pada periode ini.'

const POINTS_PER_MM = 72 / 25.4
const PAGE_MARGIN_MM = 6
const TABLE_HEADER_ROW_HEIGHTS_PT: [number, number] = [17, 15]
const TABLE_HEADER_HEIGHT_PT = TABLE_HEADER_ROW_HEIGHTS_PT[0] + TABLE_HEADER_ROW_HEIGHTS_PT[1]
const BODY_FONT_SIZE_PT = 6
const BODY_LINE_HEIGHT_PT = 7.2
const BODY_CELL_PADDING_X_PT = 2.4
const BODY_CELL_PADDING_Y_PT = 2
const BODY_MIN_ROW_HEIGHT_PT = 14.4
const REPORT_NOTE = 'Hari libur, di luar masa terdaftar atau periode, serta tanggal tanpa catatan tetap kosong.'

const paperSpecs: Record<AttendanceReportPaper, { widthMm: number; heightMm: number }> = {
  a4: { widthMm: 297, heightMm: 210 },
  f4: { widthMm: 330, heightMm: 216 },
  letter: { widthMm: 279.4, heightMm: 215.9 },
}

export class AttendanceReportLayoutError extends Error {
  readonly code: 'invalid_model' | 'row_too_tall'

  constructor(code: 'invalid_model' | 'row_too_tall') {
    super(code)
    this.name = 'AttendanceReportLayoutError'
    this.code = code
  }
}

export function hasAttendanceReportStudents(report: AttendanceReport): boolean {
  return report.months.some((month) => month.rows.length > 0)
}

function roundPoints(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function millimetersToPoints(value: number): number {
  return roundPoints(value * POINTS_PER_MM)
}

function measure(metrics: PDFKit.PDFDocument, text: string): number {
  return metrics.widthOfString(text)
}

function splitLongToken(metrics: PDFKit.PDFDocument, token: string, maxWidthPt: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const character of Array.from(token)) {
    const candidate = current + character
    if (current && measure(metrics, candidate) > maxWidthPt) {
      lines.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function wrapText(
  metrics: PDFKit.PDFDocument,
  text: string,
  widthPt: number,
  font: 'Helvetica' | 'Helvetica-Bold',
  fontSizePt: number,
): string[] {
  metrics.font(font).fontSize(fontSizePt)
  const lines: string[] = []
  for (const paragraph of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }

    let current = ''
    for (const word of words) {
      if (measure(metrics, word) > widthPt) {
        if (current) lines.push(current)
        current = ''
        lines.push(...splitLongToken(metrics, word, widthPt))
        continue
      }

      const candidate = current ? `${current} ${word}` : word
      if (current && measure(metrics, candidate) > widthPt) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['']
}

function createHeadingParts(
  metrics: PDFKit.PDFDocument,
  report: AttendanceReport,
  month: string,
  contentWidthPt: number,
): AttendanceReportLayoutHeadingPart[] {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const monthTitle = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)))
  const schoolAndClass = report.semester.className
    ? `${report.semester.schoolName} · ${report.semester.className}`
    : report.semester.schoolName
  const semesterTerm = report.semester.term === 'ganjil' ? 'Ganjil' : 'Genap'
  const semesterStatus = report.semester.status === 'active' ? 'Aktif' : 'Arsip'
  const safeWidth = Math.max(1, contentWidthPt - 1)

  const definitions = [
    { kind: 'school' as const, value: schoolAndClass, font: 'Helvetica-Bold' as const, fontSizePt: 8, lineHeightPt: 9.6, fontWeight: 'bold' as const, gapBeforePt: 0, gapAfterPt: 1.6 },
    { kind: 'title' as const, value: `Laporan absensi · ${monthTitle}`, font: 'Helvetica-Bold' as const, fontSizePt: 10, lineHeightPt: 12, fontWeight: 'bold' as const, gapBeforePt: 0, gapAfterPt: 1.6 },
    { kind: 'semester' as const, value: `Semester ${semesterTerm} ${report.semester.academicYear} · ${semesterStatus}`, font: 'Helvetica' as const, fontSizePt: 7, lineHeightPt: 8.4, fontWeight: 'normal' as const, gapBeforePt: 0, gapAfterPt: 2.2 },
    { kind: 'note' as const, value: REPORT_NOTE, font: 'Helvetica' as const, fontSizePt: 6.2, lineHeightPt: 7.44, fontWeight: 'normal' as const, gapBeforePt: 0, gapAfterPt: 5 },
  ]

  return definitions.map((part) => ({
    kind: part.kind,
    lines: wrapText(metrics, part.value, safeWidth, part.font, part.fontSizePt),
    fontSizePt: part.fontSizePt,
    lineHeightPt: part.lineHeightPt,
    fontWeight: part.fontWeight,
    gapBeforePt: part.gapBeforePt,
    gapAfterPt: part.gapAfterPt,
  }))
}

function headingHeight(parts: AttendanceReportLayoutHeadingPart[]): number {
  return roundPoints(parts.reduce((height, part) => height
    + part.gapBeforePt
    + part.lines.length * part.lineHeightPt
    + part.gapAfterPt, 0))
}

function columnWidths(contentWidthPt: number): number[] {
  const number = 20
  const gender = 20
  const day = 13.5
  const total = 16.5
  const dayAndTotals = day * 31 + total * 3
  const remaining = contentWidthPt - number - gender - dayAndTotals
  if (remaining <= 40) throw new AttendanceReportLayoutError('invalid_model')
  const name = remaining * 0.68
  const studentNumber = remaining - name
  const values = [number, name, studentNumber, gender, ...Array.from({ length: 31 }, () => day), ...Array.from({ length: 3 }, () => total)]
  const rounded = values.map(roundPoints)
  rounded[rounded.length - 1] = roundPoints(contentWidthPt - rounded.slice(0, -1).reduce((sum, width) => sum + width, 0))
  return rounded
}

function layoutRows(metrics: PDFKit.PDFDocument, rows: AttendanceReportRow[], widths: number[]): AttendanceReportLayoutRow[] {
  const nameWidthPt = Math.max(1, widths[1]! - BODY_CELL_PADDING_X_PT * 2 - 1)
  const studentNumberWidthPt = Math.max(1, widths[2]! - BODY_CELL_PADDING_X_PT * 2 - 1)
  const output: AttendanceReportLayoutRow[] = []

  rows.forEach((row, rowIndex) => {
    if (row.cells.length !== 31 || !row.membershipId) throw new AttendanceReportLayoutError('invalid_model')
    const nameLines = wrapText(metrics, row.name, nameWidthPt, 'Helvetica', BODY_FONT_SIZE_PT)
    const studentNumberLines = row.studentNumber
      ? wrapText(metrics, row.studentNumber, studentNumberWidthPt, 'Helvetica', BODY_FONT_SIZE_PT)
      : ['']
    const lineCount = Math.max(nameLines.length, studentNumberLines.length, 1)
    const heightPt = roundPoints(Math.max(BODY_MIN_ROW_HEIGHT_PT, lineCount * BODY_LINE_HEIGHT_PT + BODY_CELL_PADDING_Y_PT * 2))
    output.push({
      rowIndex,
      membershipId: row.membershipId,
      heightPt,
      lineHeightPt: BODY_LINE_HEIGHT_PT,
      nameLines,
      studentNumberLines,
    })
  })

  return output
}

function pageRows(
  rows: AttendanceReportLayoutRow[],
  availableHeightPt: number,
): AttendanceReportLayoutRow[][] {
  if (availableHeightPt <= 0) throw new AttendanceReportLayoutError('row_too_tall')
  if (!rows.length) return [[]]

  const pages: AttendanceReportLayoutRow[][] = []
  let current: AttendanceReportLayoutRow[] = []
  let currentHeight = 0
  for (const row of rows) {
    if (row.heightPt > availableHeightPt) throw new AttendanceReportLayoutError('row_too_tall')
    if (current.length && currentHeight + row.heightPt > availableHeightPt) {
      pages.push(current)
      current = []
      currentHeight = 0
    }
    current.push(row)
    currentHeight += row.heightPt
  }
  if (current.length) pages.push(current)
  return pages
}

function makePaperPlan(metrics: PDFKit.PDFDocument, report: AttendanceReport, paper: AttendanceReportPaper): AttendanceReportPaperPlan {
  const spec = paperSpecs[paper]
  const widthPt = millimetersToPoints(spec.widthMm)
  const heightPt = millimetersToPoints(spec.heightMm)
  const marginPt = millimetersToPoints(PAGE_MARGIN_MM)
  const contentWidthPt = roundPoints(widthPt - marginPt * 2)
  const contentHeightPt = roundPoints(heightPt - marginPt * 2)
  const widths = columnWidths(contentWidthPt)
  const pages: AttendanceReportLayoutPage[] = []

  for (const [monthIndex, month] of report.months.entries()) {
    if (month.days.length !== 31) throw new AttendanceReportLayoutError('invalid_model')
    const descriptor = report.semester.logo
    const headingTextOffsetPt = descriptor ? 44 : 0
    const headingTextWidthPt = contentWidthPt - headingTextOffsetPt
    const headingParts = createHeadingParts(metrics, report, month.month, headingTextWidthPt)
    const headingHeightPt = Math.max(headingHeight(headingParts), descriptor ? 36 : 0)
    const scale = descriptor ? Math.min(36 / descriptor.width, 36 / descriptor.height) : 0
    const logo = descriptor ? {
      xPt: roundPoints((36 - descriptor.width * scale) / 2),
      yPt: roundPoints((36 - descriptor.height * scale) / 2),
      widthPt: roundPoints(descriptor.width * scale), heightPt: roundPoints(descriptor.height * scale),
    } : null
    const availableRowsHeightPt = roundPoints(contentHeightPt - headingHeightPt - TABLE_HEADER_HEIGHT_PT)
    const rows = layoutRows(metrics, month.rows, widths)
    const monthPages = pageRows(rows, availableRowsHeightPt)

    for (const [monthPageIndex, pageRowsLayout] of monthPages.entries()) {
      pages.push({
        index: pages.length,
        monthIndex,
        month: month.month,
        pageInMonth: monthPageIndex + 1,
        pagesInMonth: monthPages.length,
        headingParts,
        headingHeightPt,
        headingTextOffsetPt,
        headingTextWidthPt,
        logo,
        tableHeaderRowHeightsPt: TABLE_HEADER_ROW_HEIGHTS_PT,
        rows: pageRowsLayout,
      })
    }
  }

  return {
    paper,
    widthPt,
    heightPt,
    marginPt,
    contentWidthPt,
    contentHeightPt,
    columnWidthsPt: widths,
    pages,
  }
}

export function buildAttendanceReportLayoutBundle(report: AttendanceReport): AttendanceReportLayoutBundle {
  if (!report || !report.semester || !Array.isArray(report.months)) throw new AttendanceReportLayoutError('invalid_model')

  const metrics = new PDFDocument({ size: 'A4', margin: 0, compress: false })
  metrics.on('data', () => {})
  try {
    const plans: Record<AttendanceReportPaper, AttendanceReportPaperPlan> = {
      a4: makePaperPlan(metrics, report, 'a4'),
      f4: makePaperPlan(metrics, report, 'f4'),
      letter: makePaperPlan(metrics, report, 'letter'),
    }
    const revision = createHash('sha256')
      .update(JSON.stringify({ version: ATTENDANCE_REPORT_LAYOUT_VERSION, report, plans }))
      .digest('hex')
    return { version: ATTENDANCE_REPORT_LAYOUT_VERSION, revision, report, plans, logoStatus: report.semester.logo ? 'unavailable' : 'none' }
  } finally {
    metrics.end()
  }
}

function drawRect(document: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, fillColor: string): void {
  document.save()
  document.lineWidth(0.32).strokeColor('#333333')
  document.rect(x, y, width, height).fillAndStroke(fillColor, '#333333')
  document.restore()
}

function drawTextLine(
  document: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  font: 'Helvetica' | 'Helvetica-Bold',
  fontSizePt: number,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  document.save()
  document.font(font).fontSize(fontSizePt).fillColor('#111111')
  document.text(text, x, y, { width, align, lineBreak: false })
  document.restore()
}

function drawPageHeading(document: PDFKit.PDFDocument, page: AttendanceReportLayoutPage, plan: AttendanceReportPaperPlan, logoBytes?: Buffer | null): void {
  const x = plan.marginPt + page.headingTextOffsetPt
  const width = page.headingTextWidthPt
  if (page.logo) {
    if (!logoBytes) throw new Error('Report logo unavailable.')
    document.image(logoBytes, plan.marginPt + page.logo.xPt, plan.marginPt + page.logo.yPt, { width: page.logo.widthPt, height: page.logo.heightPt })
  }
  let y = plan.marginPt
  for (const part of page.headingParts) {
    y += part.gapBeforePt
    for (const line of part.lines) {
      drawTextLine(
        document,
        line,
        x,
        y,
        width,
        part.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica',
        part.fontSizePt,
      )
      y += part.lineHeightPt
    }
    y += part.gapAfterPt
  }
}

function drawCell(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  options: { font?: 'Helvetica' | 'Helvetica-Bold'; fontSizePt?: number; align?: 'left' | 'center' | 'right'; fillColor?: string; lineHeightPt?: number; paddingXPt?: number; lines?: string[] } = {},
): void {
  drawRect(document, x, y, width, height, options.fillColor ?? '#ffffff')
  const font = options.font ?? 'Helvetica'
  const fontSizePt = options.fontSizePt ?? BODY_FONT_SIZE_PT
  const lineHeightPt = options.lineHeightPt ?? fontSizePt * 1.2
  const lines = options.lines ?? [text]
  const textHeight = lineHeightPt * lines.length
  const paddingX = options.paddingXPt ?? 2
  const textWidth = Math.max(1, width - paddingX * 2)
  let textY = y + Math.max(0, (height - textHeight) / 2)
  for (const line of lines) {
    drawTextLine(document, line, x + paddingX, textY, textWidth, font, fontSizePt, options.align ?? 'center')
    textY += lineHeightPt
  }
}

function drawTableHeader(
  document: PDFKit.PDFDocument,
  report: AttendanceReport,
  page: AttendanceReportLayoutPage,
  plan: AttendanceReportPaperPlan,
  x: number,
  y: number,
): void {
  const [firstHeight, secondHeight] = page.tableHeaderRowHeightsPt
  const allHeaderHeight = firstHeight + secondHeight
  const widths = plan.columnWidthsPt
  const xPositions = [x]
  for (const width of widths) xPositions.push(xPositions[xPositions.length - 1]! + width)
  const labelOptions = { font: 'Helvetica-Bold' as const, fontSizePt: 5.6, fillColor: '#eef2f1' }

  for (let column = 0; column < 4; column += 1) {
    const label = ['No.', 'Nama siswa', 'NIPD', 'JK'][column]!
    drawCell(document, xPositions[column]!, y, widths[column]!, allHeaderHeight, label, labelOptions)
  }
  const dayStart = 4
  const dayWidth = widths[dayStart]!
  const daysWidth = widths.slice(dayStart, dayStart + 31).reduce((sum, width) => sum + width, 0)
  const totalsWidth = widths.slice(dayStart + 31).reduce((sum, width) => sum + width, 0)
  drawCell(document, xPositions[dayStart]!, y, daysWidth, firstHeight, 'Tanggal', labelOptions)
  drawCell(document, xPositions[dayStart + 31]!, y, totalsWidth, firstHeight, 'Jumlah', labelOptions)

  const month = report.months[page.monthIndex]!
  for (let index = 0; index < 31; index += 1) {
    drawCell(document, xPositions[dayStart + index]!, y + firstHeight, dayWidth, secondHeight, String(month.days[index]!.day), labelOptions)
  }
  for (let index = 0; index < 3; index += 1) {
    const column = dayStart + 31 + index
    drawCell(document, xPositions[column]!, y + firstHeight, widths[column]!, secondHeight, ['S', 'I', 'A'][index]!, labelOptions)
  }
}

function drawBodyRow(
  document: PDFKit.PDFDocument,
  report: AttendanceReport,
  page: AttendanceReportLayoutPage,
  plan: AttendanceReportPaperPlan,
  rowLayout: AttendanceReportLayoutRow,
  x: number,
  y: number,
): void {
  const row = report.months[page.monthIndex]?.rows[rowLayout.rowIndex]
  if (!row || row.membershipId !== rowLayout.membershipId) throw new AttendanceReportLayoutError('invalid_model')
  const widths = plan.columnWidthsPt
  const xPositions = [x]
  for (const width of widths) xPositions.push(xPositions[xPositions.length - 1]! + width)
  const simple = (index: number, text: string, align: 'left' | 'center' = 'center', fontSizePt = BODY_FONT_SIZE_PT, font: 'Helvetica' | 'Helvetica-Bold' = 'Helvetica') => {
    drawCell(document, xPositions[index]!, y, widths[index]!, rowLayout.heightPt, text, {
      font,
      fontSizePt,
      align,
      paddingXPt: BODY_CELL_PADDING_X_PT,
      lineHeightPt: rowLayout.lineHeightPt,
    })
  }

  simple(0, String(rowLayout.rowIndex + 1))
  drawCell(document, xPositions[1]!, y, widths[1]!, rowLayout.heightPt, '', {
    align: 'left', fontSizePt: BODY_FONT_SIZE_PT, paddingXPt: BODY_CELL_PADDING_X_PT,
    lineHeightPt: rowLayout.lineHeightPt, lines: rowLayout.nameLines,
  })
  drawCell(document, xPositions[2]!, y, widths[2]!, rowLayout.heightPt, '', {
    align: 'left', fontSizePt: BODY_FONT_SIZE_PT, paddingXPt: BODY_CELL_PADDING_X_PT,
    lineHeightPt: rowLayout.lineHeightPt, lines: rowLayout.studentNumberLines,
  })
  simple(3, row.gender ?? '')
  for (let dayIndex = 0; dayIndex < 31; dayIndex += 1) simple(4 + dayIndex, row.cells[dayIndex] ?? '')
  simple(35, String(row.totals.S))
  simple(36, String(row.totals.I))
  simple(37, String(row.totals.A))
}

export function renderAttendanceReportPdf(bundle: AttendanceReportLayoutBundle, paper: AttendanceReportPaper, logoBytes?: Buffer | null): Promise<Buffer> {
  const plan = bundle.plans[paper]
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ autoFirstPage: false, compress: true, info: { Title: 'Laporan Absensi' } })
    const chunks: Buffer[] = []
    document.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)))
    document.once('error', reject)
    document.once('end', () => {
      const buffer = Buffer.concat(chunks)
      if (buffer.length < 8 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        reject(new Error('PDF output is incomplete.'))
        return
      }
      resolve(buffer)
    })

    try {
      for (const page of plan.pages) {
        document.addPage({
          size: [plan.widthPt, plan.heightPt],
          margins: { top: plan.marginPt, right: plan.marginPt, bottom: plan.marginPt, left: plan.marginPt },
        })
        drawPageHeading(document, page, plan, logoBytes)
        const tableTop = plan.marginPt + page.headingHeightPt
        drawTableHeader(document, bundle.report, page, plan, plan.marginPt, tableTop)
        let y = tableTop + page.tableHeaderRowHeightsPt[0] + page.tableHeaderRowHeightsPt[1]
        for (const row of page.rows) {
          drawBodyRow(document, bundle.report, page, plan, row, plan.marginPt, y)
          y += row.heightPt
        }
      }
      document.end()
    } catch (error) {
      document.destroy(error instanceof Error ? error : new Error('PDF render failed.'))
    }
  })
}
