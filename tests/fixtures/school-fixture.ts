import { randomUUID } from 'node:crypto'
import type postgres from 'postgres'
import { setCalendarException } from '../../server/database/repositories/calendar.ts'
import { createSemester } from '../../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../../server/database/repositories/students.ts'
import { createSchool, createSchoolClass } from '../../server/database/repositories/schools.ts'
import { createTeacherAccount } from '../../server/database/repositories/teacher-accounts.ts'

export interface SchoolFixture {
  teacherId: string
  schoolId: string
  classId: string
  semesterId: string
  today: string
  semesterStart: string
  semesterEnd: string
  membershipStart: string
  membershipEnd: string
  studentOneId: string
  membershipOneId: string
  studentTwoId: string
  membershipTwoId: string
}

export function addDays(date: string, offset: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + offset))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

export async function createSchoolFixture(
  database: postgres.Sql,
  options: { firstMembershipEnd?: string | null; teacherAccountDatabase?: postgres.Sql } = {},
): Promise<SchoolFixture> {
  const token = randomUUID()
  const teacher = await createTeacherAccount(options.teacherAccountDatabase ?? database, `fixture-${token}@example.invalid`)
  const school = await createSchool(database, {
    teacherId: teacher.id,
    name: 'Sekolah Contoh',
    timeZone: 'Asia/Jakarta',
  })
  const schoolClass = await createSchoolClass(database, { schoolId: school.id, name: 'Kelas Uji' })
  const [localDate] = await database`select school_local_today(${school.id})::text as today`
  const today = localDate.today
  const semesterStart = addDays(today, -10)
  const semesterEnd = addDays(today, 90)
  const membershipStart = addDays(today, -3)
  const membershipEnd = today
  const semester = await createSemester(database, {
    schoolId: school.id,
    academicYear: '2026/2027',
    term: 'ganjil',
    startsOn: semesterStart,
    endsOn: semesterEnd,
  })
  const studentOne = await createStudent(database, { fullName: 'Siswa Contoh', studentNumber: null, gender: 'P' })
  const studentTwo = await createStudent(database, { fullName: 'Siswa Contoh', studentNumber: null, gender: 'P' })
  const membershipOne = await addStudentToSemester(database, {
    semesterId: semester.id,
    schoolId: school.id,
    schoolClassId: schoolClass.id,
    studentId: studentOne.id,
    startsOn: membershipStart,
    endsOn: options.firstMembershipEnd === undefined ? membershipEnd : options.firstMembershipEnd,
  })
  const membershipTwo = await addStudentToSemester(database, {
    semesterId: semester.id,
    schoolId: school.id,
    schoolClassId: schoolClass.id,
    studentId: studentTwo.id,
    startsOn: membershipStart,
    endsOn: membershipEnd,
  })

  for (const date of new Set([membershipStart, membershipEnd, addDays(today, 1)])) {
    await setCalendarException(database, {
      schoolId: school.id,
      date,
      kind: 'school_day',
      note: 'Fixture sintetis',
    })
  }

  return {
    teacherId: teacher.id,
    schoolId: school.id,
    classId: schoolClass.id,
    semesterId: semester.id,
    today,
    semesterStart,
    semesterEnd,
    membershipStart,
    membershipEnd,
    studentOneId: studentOne.id,
    membershipOneId: membershipOne.id,
    studentTwoId: studentTwo.id,
    membershipTwoId: membershipTwo.id,
  }
}

export async function recordAttendance(
  database: postgres.Sql,
  membershipId: string,
  semesterId: string,
  date: string,
  status: 'H' | 'S' | 'I' | 'A' = 'H',
): Promise<string> {
  const [row] = await database`
    insert into attendance_records (membership_id, semester_id, attendance_date, status)
    values (${membershipId}, ${semesterId}, ${date}, ${status}) returning id
  `
  return row.id
}
