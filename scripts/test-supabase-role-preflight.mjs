import assert from 'node:assert/strict'
import postgres from 'postgres'
import { hasAllDatabaseRoles } from '../server/database/supabase-role-preflight.mjs'
import { startTemporaryPostgres } from '../tests/support/temporary-postgres.mjs'

const temporary = await startTemporaryPostgres()
const database = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })

try {
  assert.equal(await hasAllDatabaseRoles(database, ['anon', 'authenticated', 'service_role']), true)
  assert.equal(await hasAllDatabaseRoles(database, ['anon', 'missing_lab002_role']), false)
  console.log('Supabase role preflight regression passed against isolated PostgreSQL 16.')
} finally {
  await database.end({ timeout: 3 })
  await temporary.cleanup()
}
