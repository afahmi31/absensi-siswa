import type { SemesterMembership } from './students.ts'
import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'

export type SemesterTerm = 'ganjil' | 'genap'
export type SemesterStatus = 'active' | 'closed'

export interface Semester {
  id: string
  school_id: string
  academic_year: string
  term: SemesterTerm
  starts_on: string
  ends_on: string
  status: SemesterStatus
  closed_at: Date | null
}

export async function createSemester(
  database: DatabaseExecutor,
  input: { schoolId: string; academicYear: string; term: SemesterTerm; startsOn: string; endsOn: string },
): Promise<Semester> {
  const [semester] = await database<Semester[]>`
    insert into semesters (school_id, academic_year, term, starts_on, ends_on)
    values (${input.schoolId}, ${input.academicYear}, ${input.term}, ${input.startsOn}, ${input.endsOn})
    returning id, school_id, academic_year, term, starts_on, ends_on, status, closed_at
  `
  if (!semester) throw new Error('Semester was not created.')
  return semester
}

export async function closeSemester(database: DatabaseExecutor, semesterId: string): Promise<Semester> {
  const [semester] = await database<Semester[]>`
    update semesters set status = 'closed' where id = ${semesterId}
    returning id, school_id, academic_year, term, starts_on, ends_on, status, closed_at
  `
  if (!semester) throw new Error('Semester was not found.')
  return semester
}

/** Copy the previous closed semester's end-date roster into an empty active target semester. */
export async function copyRosterFromPreviousSemester(
  database: DatabaseExecutor,
  input: { previousSemesterId: string; targetSemesterId: string },
): Promise<SemesterMembership[]> {
  return inDatabaseTransaction(database, async (transaction) => {
    const periods = await transaction<{
      previous_school_id: string
      previous_ends_on: string
      previous_status: SemesterStatus
      target_school_id: string
      target_starts_on: string
      target_status: SemesterStatus
      target_class_id: string
      target_has_memberships: boolean
    }[]>`
      select previous.school_id as previous_school_id,
             previous.ends_on as previous_ends_on,
             previous.status as previous_status,
             target.school_id as target_school_id,
             target.starts_on as target_starts_on,
             target.status as target_status,
             school_classes.id as target_class_id,
             exists (
               select 1 from semester_memberships as existing_membership
               where existing_membership.semester_id = target.id
             ) as target_has_memberships
      from semesters as previous
      join semesters as target on target.id = ${input.targetSemesterId}
      join school_classes on school_classes.school_id = target.school_id
      where previous.id = ${input.previousSemesterId}
      for share of previous, target
    `
    const period = periods[0]
    if (!period) throw new Error('Both semesters and the target school class must exist.')
    if (period.previous_status !== 'closed') throw new Error('The previous semester must be closed before copying its roster.')
    if (period.target_status !== 'active') throw new Error('The target semester must be active.')
    if (period.target_has_memberships) throw new Error('Copy the roster only into an empty target semester.')
    if (period.previous_school_id !== period.target_school_id) throw new Error('Semester roster can only be copied within the same school.')
    if (period.previous_ends_on >= period.target_starts_on) throw new Error('The target semester must start after the previous semester ends.')

    const copied = await transaction<SemesterMembership[]>`
      insert into semester_memberships (
        semester_id, school_id, school_class_id, student_id,
        name_snapshot, student_number_snapshot, gender_snapshot, starts_on
      )
      select target.id, target.school_id, ${period.target_class_id}, old_membership.student_id,
             old_membership.name_snapshot, old_membership.student_number_snapshot,
             old_membership.gender_snapshot, target.starts_on
      from semester_memberships as old_membership
      join semesters as previous on previous.id = old_membership.semester_id
      join semesters as target on target.id = ${input.targetSemesterId}
      where previous.id = ${input.previousSemesterId}
        and old_membership.starts_on <= previous.ends_on
        and (old_membership.ends_on is null or old_membership.ends_on >= previous.ends_on)
      returning id, semester_id, school_id, school_class_id, student_id,
                name_snapshot, student_number_snapshot, gender_snapshot, starts_on, ends_on
    `
    return copied
  })
}
