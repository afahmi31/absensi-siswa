import { spawnSync } from 'node:child_process'

const targetVariables = ['LAB002_TEST_DATABASE_URL', 'DATABASE_URL', 'NUXT_DATABASE_URL']

try {
  for (const name of targetVariables) {
    const value = process.env[name]
    if (!value) continue
    let target
    try { target = new URL(value) } catch { throw new Error(`Database test target in ${name} is invalid.`) }
    if (
      !['postgres:', 'postgresql:'].includes(target.protocol)
      || target.hostname !== '127.0.0.1'
      || target.port !== '55432'
      || target.pathname !== '/lab002_local'
    ) {
      throw new Error('Database tests refuse non-managed or remote database targets. They create a disposable PostgreSQL 16 cluster.')
    }
  }

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--test',
    'tests/database.test.ts',
  ], { stdio: 'inherit', cwd: process.cwd() })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database test target rejected.')
  process.exitCode = 1
}
