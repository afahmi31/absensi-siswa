import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'

export type StudentGender = 'L' | 'P' | null

export interface Student {
  id: string
  full_name: string
  student_number: string | null
  gender: StudentGender
  inactive_at: Date | null
}

export interface SemesterMembership {
  id: string
  semester_id: string
  school_id: string
  school_class_id: string
  student_id: string
  name_snapshot: string
  student_number_snapshot: string | null
  gender_snapshot: StudentGender
  starts_on: string
  ends_on: string | null
}

export async function createStudent(
  database: DatabaseExecutor,
  input: { fullName: string; studentNumber?: string | null; gender?: StudentGender },
): Promise<Student> {
  const [student] = await database<Student[]>`
    insert into students (full_name, student_number, gender)
    values (${input.fullName}, ${input.studentNumber ?? null}, ${input.gender ?? null})
    returning id, full_name, student_number, gender, inactive_at
  `
  if (!student) throw new Error('Student was not created.')
  return student
}

export async function addStudentToSemester(
  database: DatabaseExecutor,
  input: {
    semesterId: string
    schoolId: string
    schoolClassId: string
    studentId: string
    startsOn: string
    endsOn?: string | null
  },
): Promise<SemesterMembership> {
  return inDatabaseTransaction(database, async (transaction) => {
    const [student] = await transaction<{ full_name: string; student_number: string | null; gender: StudentGender }[]>`
      select full_name, student_number, gender from students where id = ${input.studentId} for share
    `
    if (!student) throw new Error('Student was not found.')

    const [membership] = await transaction<SemesterMembership[]>`
      insert into semester_memberships (
        semester_id, school_id, school_class_id, student_id,
        name_snapshot, student_number_snapshot, gender_snapshot, starts_on, ends_on
      ) values (
        ${input.semesterId}, ${input.schoolId}, ${input.schoolClassId}, ${input.studentId},
        ${student.full_name}, ${student.student_number}, ${student.gender}, ${input.startsOn}, ${input.endsOn ?? null}
      ) returning id, semester_id, school_id, school_class_id, student_id,
                  name_snapshot, student_number_snapshot, gender_snapshot, starts_on, ends_on
    `
    if (!membership) throw new Error('Student membership was not created.')
    return membership
  })
}

export async function updateStudentIdentity(
  database: DatabaseExecutor,
  studentId: string,
  identity: { fullName: string; studentNumber: string | null; gender: StudentGender },
): Promise<Student> {
  const [student] = await database<Student[]>`
    update students
    set full_name = ${identity.fullName},
        student_number = ${identity.studentNumber},
        gender = ${identity.gender}
    where id = ${studentId}
    returning id, full_name, student_number, gender, inactive_at
  `
  if (!student) throw new Error('Student was not found.')
  return student
}

export async function endStudentMembership(
  database: DatabaseExecutor,
  membershipId: string,
  endsOn: string,
): Promise<SemesterMembership> {
  const [membership] = await database<SemesterMembership[]>`
    update semester_memberships set ends_on = ${endsOn}
    where id = ${membershipId}
    returning id, semester_id, school_id, school_class_id, student_id,
              name_snapshot, student_number_snapshot, gender_snapshot, starts_on, ends_on
  `
  if (!membership) throw new Error('Semester membership was not found.')
  return membership
}
