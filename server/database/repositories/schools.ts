export interface SchoolSignatures { principalName?: string; principalNip?: string; teacherName?: string; teacherNip?: string }
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

export interface SchoolLogoAsset {
  id: string
  school_id: string
  mime_type: 'image/png' | 'image/jpeg'
  byte_size: number
  width: number
  height: number
  sha256: string
  uploaded_by: string
}

export async function lockTeacherSchoolSave(database: DatabaseExecutor, teacherId: string): Promise<void> {
  await database`select pg_advisory_xact_lock(1729, hashtext(${teacherId}::text))`
}

export async function lockSchoolProfileSave(database: DatabaseExecutor, schoolId: string): Promise<void> {
  await database`select pg_advisory_xact_lock(1728, hashtext(${schoolId}::text))`
}

export async function createSchool(
  database: DatabaseExecutor,
  input: SchoolSignatures & { id?: string; teacherId: string; name: string; timeZone?: string; logoPath?: string | null },
): Promise<School> {
  if (input.principalName === undefined && input.principalNip === undefined && input.teacherName === undefined && input.teacherNip === undefined) {
    const [school] = input.id
      ? await database<School[]>`insert into schools (id,teacher_id,name,time_zone,logo_path) values (${input.id},${input.teacherId},${input.name},${input.timeZone ?? 'Asia/Jakarta'},${input.logoPath ?? null}) returning id,teacher_id,name,time_zone,logo_path`
      : await database<School[]>`insert into schools (teacher_id,name,time_zone,logo_path) values (${input.teacherId},${input.name},${input.timeZone ?? 'Asia/Jakarta'},${input.logoPath ?? null}) returning id,teacher_id,name,time_zone,logo_path`
    if (!school) throw new Error('School was not created.')
    return school
  }
  const [school] = input.id
    ? await database<School[]>`
      insert into schools (id, teacher_id, name, time_zone, logo_path, principal_name, principal_nip, teacher_name, teacher_nip)
      values (${input.id}, ${input.teacherId}, ${input.name}, ${input.timeZone ?? 'Asia/Jakarta'}, ${input.logoPath ?? null}, ${input.principalName ?? ''}, ${input.principalNip ?? ''}, ${input.teacherName ?? ''}, ${input.teacherNip ?? ''})
      returning id, teacher_id, name, time_zone, logo_path
    `
    : await database<School[]>`
      insert into schools (teacher_id, name, time_zone, logo_path, principal_name, principal_nip, teacher_name, teacher_nip)
      values (${input.teacherId}, ${input.name}, ${input.timeZone ?? 'Asia/Jakarta'}, ${input.logoPath ?? null}, ${input.principalName ?? ''}, ${input.principalNip ?? ''}, ${input.teacherName ?? ''}, ${input.teacherNip ?? ''})
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

export async function updateSchoolProfile(
  database: DatabaseExecutor,
  input: SchoolSignatures & { teacherId: string; schoolId: string; name: string; timeZone: string; activeLogoAssetId: string | null },
): Promise<Pick<School, 'id' | 'name' | 'time_zone'> & SchoolSignatures> {
  const [school] = await database<(Pick<School, 'id' | 'name' | 'time_zone'> & SchoolSignatures)[]>`
    update schools
    set principal_name = coalesce(${input.principalName ?? null}::text, principal_name), principal_nip = coalesce(${input.principalNip ?? null}::text, principal_nip), teacher_name = coalesce(${input.teacherName ?? null}::text, teacher_name), teacher_nip = coalesce(${input.teacherNip ?? null}::text, teacher_nip), name = ${input.name}, time_zone = ${input.timeZone}, active_logo_asset_id = ${input.activeLogoAssetId}, updated_at = clock_timestamp()
    where id = ${input.schoolId} and teacher_id = ${input.teacherId}
    returning id, name, time_zone, principal_name as "principalName", principal_nip as "principalNip", teacher_name as "teacherName", teacher_nip as "teacherNip"
  `
  if (!school) throw new Error('School was not found.')
  return school
}

export async function createSchoolLogoAsset(
  database: DatabaseExecutor,
  input: {
    assetId: string
    schoolId: string
    mimeType: SchoolLogoAsset['mime_type']
    byteSize: number
    width: number
    height: number
    sha256: string
    uploadedBy: string
  },
): Promise<void> {
  await database`
    insert into school_logo_assets (id, school_id, mime_type, byte_size, width, height, sha256, uploaded_by)
    values (${input.assetId}, ${input.schoolId}, ${input.mimeType}, ${input.byteSize}, ${input.width}, ${input.height}, ${input.sha256}, ${input.uploadedBy})
  `
}

export async function setActiveSchoolLogo(
  database: DatabaseExecutor,
  input: { schoolId: string; assetId: string | null },
): Promise<void> {
  const result = await database<{ id: string }[]>`
    update schools set active_logo_asset_id = ${input.assetId}, updated_at = clock_timestamp()
    where id = ${input.schoolId}
    returning id
  `
  if (!result[0]) throw new Error('School logo reference was not updated.')
}

export async function findSchoolLogoForTeacher(
  database: DatabaseExecutor,
  input: { teacherId: string; assetId: string },
): Promise<Pick<SchoolLogoAsset, 'id' | 'mime_type' | 'byte_size' | 'sha256'> | null> {
  const rows = await database<Pick<SchoolLogoAsset, 'id' | 'mime_type' | 'byte_size' | 'sha256'>[]>`
    select asset.id, asset.mime_type, asset.byte_size, asset.sha256
    from school_logo_assets as asset
    where asset.id = ${input.assetId}
      and (
        exists (
          select 1 from schools as school
          where school.id = asset.school_id
            and school.teacher_id = ${input.teacherId}
            and school.active_logo_asset_id = asset.id
        )
        or exists (
          select 1
          from semester_archive_snapshots as snapshot
          join semesters as semester on semester.id = snapshot.semester_id
          join schools as school on school.id = semester.school_id
          where snapshot.logo_asset_id = asset.id and school.teacher_id = ${input.teacherId}
        )
      )
    limit 1
  `
  return rows[0] ?? null
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
