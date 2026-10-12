import type { SemesterTerm } from '../database/repositories/semesters.ts'
import { fieldValidationError, isIsoDate } from './study-api.ts'

export interface SemesterFields {
  academicYear: string
  term: SemesterTerm
  startsOn: string
  endsOn: string
}

export function requiredAcademicYear(value: unknown): string {
  if (typeof value !== 'string') {
    fieldValidationError({ academicYear: 'Tulis tahun ajaran dengan format YYYY/YYYY.' })
  }
  const year = value.trim()
  const match = /^(\d{4})\/(\d{4})$/.exec(year)
  if (!match) fieldValidationError({ academicYear: 'Tulis tahun ajaran dengan format YYYY/YYYY.' })
  const firstYear = Number(match[1])
  const secondYear = Number(match[2])
  if (firstYear < 1 || firstYear > 9998 || secondYear !== firstYear + 1) {
    fieldValidationError({ academicYear: 'Tahun kedua harus satu tahun setelah tahun pertama.' })
  }
  return year
}

export function requiredSemesterTerm(value: unknown): SemesterTerm {
  if (value === 'ganjil' || value === 'genap') return value
  fieldValidationError({ term: 'Pilih semester ganjil atau genap.' })
}

export function requiredSemesterDate(value: unknown, field: 'startsOn' | 'endsOn', label: string): string {
  if (typeof value !== 'string' || !isIsoDate(value)) {
    fieldValidationError({ [field]: `${label} harus berupa tanggal yang benar.` })
  }
  return value
}

export function validateSemesterDateOrder(input: Pick<SemesterFields, 'startsOn' | 'endsOn'>): void {
  if (input.endsOn < input.startsOn) {
    fieldValidationError({ endsOn: 'Tanggal selesai harus sama dengan atau setelah tanggal mulai.' })
  }
}

export function readSemesterFields(body: Record<string, unknown>): SemesterFields {
  const fields = {
    academicYear: requiredAcademicYear(body.academicYear),
    term: requiredSemesterTerm(body.term),
    startsOn: requiredSemesterDate(body.startsOn, 'startsOn', 'Tanggal mulai'),
    endsOn: requiredSemesterDate(body.endsOn, 'endsOn', 'Tanggal selesai'),
  }
  validateSemesterDateOrder(fields)
  return fields
}
