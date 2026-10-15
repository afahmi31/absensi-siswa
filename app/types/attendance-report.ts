export type AttendanceReportMode = 'month' | 'semester'
export type AttendanceStatus = 'H' | 'S' | 'I' | 'A'
export type AttendanceReportPaper = 'a4' | 'f4' | 'letter'

export interface AttendanceReportDay {
  day: number
  date: string | null
  inSemester: boolean
  isSchoolDay: boolean
}

export interface AttendanceReportRow {
  membershipId: string
  name: string
  studentNumber: string | null
  gender: 'L' | 'P' | null
  cells: Array<AttendanceStatus | null>
  totals: Record<AttendanceStatus, number>
}

export interface AttendanceReportMonth {
  month: string
  days: AttendanceReportDay[]
  rows: AttendanceReportRow[]
}

/** Client-side shape returned by the protected REP-001A GET route. */
export interface AttendanceReport {
  mode: AttendanceReportMode
  semester: {
    id: string
    academicYear: string
    term: 'ganjil' | 'genap'
    startsOn: string
    endsOn: string
    status: 'active' | 'closed'
    schoolName: string
    className: string
  }
  months: AttendanceReportMonth[]
}

export interface AttendanceReportLayoutHeadingPart {
  kind: 'school' | 'title' | 'semester' | 'note'
  lines: string[]
  fontSizePt: number
  lineHeightPt: number
  fontWeight: 'normal' | 'bold'
  gapBeforePt: number
  gapAfterPt: number
}

export interface AttendanceReportLayoutRow {
  rowIndex: number
  membershipId: string
  heightPt: number
  lineHeightPt: number
  nameLines: string[]
  studentNumberLines: string[]
}

export interface AttendanceReportLayoutPage {
  index: number
  monthIndex: number
  month: string
  pageInMonth: number
  pagesInMonth: number
  headingParts: AttendanceReportLayoutHeadingPart[]
  headingHeightPt: number
  tableHeaderRowHeightsPt: [number, number]
  rows: AttendanceReportLayoutRow[]
}

export interface AttendanceReportPaperPlan {
  paper: AttendanceReportPaper
  widthPt: number
  heightPt: number
  marginPt: number
  contentWidthPt: number
  contentHeightPt: number
  columnWidthsPt: number[]
  pages: AttendanceReportLayoutPage[]
}

/** Server-measured, client-safe layout bundle shared by preview, print and PDF. */
export interface AttendanceReportLayoutBundle {
  version: string
  revision: string
  report: AttendanceReport
  plans: Record<AttendanceReportPaper, AttendanceReportPaperPlan>
}
