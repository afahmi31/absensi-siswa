import type { DatabaseExecutor } from '../transaction.ts'

export interface TeacherAccount {
  id: string
  email: string
}

export async function createTeacherAccount(database: DatabaseExecutor, email: string): Promise<TeacherAccount> {
  const [account] = await database<TeacherAccount[]>`
    insert into teacher_accounts (email) values (${email}) returning id, email
  `
  if (!account) throw new Error('Teacher account was not created.')
  return account
}

export async function findTeacherAccountByEmail(database: DatabaseExecutor, email: string): Promise<TeacherAccount | null> {
  const rows = await database<TeacherAccount[]>`
    select id, email from teacher_accounts where lower(btrim(email)) = lower(btrim(${email}))
  `
  return rows[0] ?? null
}
