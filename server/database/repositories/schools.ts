import type { DatabaseExecutor } from '../transaction.ts'

export interface School {
  id: string
  teacher_id: string
  name: string
  time_zone: string
  logo_path: string | null
}

export interface SchoolClass {
  id: string
  school_id: string
  name: string
}

export async function createSchool(
  database: DatabaseExecutor,
  input: { teacherId: string; name: string; timeZone?: string; logoPath?: string | null },
): Promise<School> {
  const [school] = await database<School[]>`
    insert into schools (teacher_id, name, time_zone, logo_path)
    values (${input.teacherId}, ${input.name}, ${input.timeZone ?? 'Asia/Jakarta'}, ${input.logoPath ?? null})
    returning id, teacher_id, name, time_zone, logo_path
  `
  if (!school) throw new Error('School was not created.')
  return school
}

export async function findSchoolForTeacher(database: DatabaseExecutor, teacherId: string): Promise<School | null> {
  const rows = await database<School[]>`
    select id, teacher_id, name, time_zone, logo_path from schools where teacher_id = ${teacherId}
  `
  return rows[0] ?? null
}

export async function updateSchoolForTeacher(
  database: DatabaseExecutor,
  input: { teacherId: string; name: string; timeZone: string },
): Promise<School> {
  const [school] = await database<School[]>`
    update schools
    set name = ${input.name}, time_zone = ${input.timeZone}, updated_at = clock_timestamp()
    where teacher_id = ${input.teacherId}
    returning id, teacher_id, name, time_zone, logo_path
  `
  if (!school) throw new Error('School was not found.')
  return school
}

export async function createSchoolClass(
  database: DatabaseExecutor,
  input: { schoolId: string; name: string },
): Promise<SchoolClass> {
  const [schoolClass] = await database<SchoolClass[]>`
    insert into school_classes (school_id, name) values (${input.schoolId}, ${input.name})
    returning id, school_id, name
  `
  if (!schoolClass) throw new Error('School class was not created.')
  return schoolClass
}

export async function updateSchoolClass(
  database: DatabaseExecutor,
  input: { schoolId: string; name: string },
): Promise<SchoolClass> {
  const [schoolClass] = await database<SchoolClass[]>`
    update school_classes
    set name = ${input.name}
    where school_id = ${input.schoolId}
    returning id, school_id, name
  `
  if (!schoolClass) throw new Error('School class was not found.')
  return schoolClass
}
