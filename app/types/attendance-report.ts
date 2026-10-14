export type AttendanceReportMode = 'month' | 'semester'
export type AttendanceStatus = 'H' | 'S' | 'I' | 'A'

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
