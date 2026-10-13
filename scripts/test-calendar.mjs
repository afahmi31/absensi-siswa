import { spawnSync } from 'node:child_process'

const targetVariables = ['LAB002_TEST_DATABASE_URL', 'DATABASE_URL', 'NUXT_DATABASE_URL']

try {
  for (const name of targetVariables) {
    const value = process.env[name]
    if (!value) continue
    let target
    try { target = new URL(value) } catch { throw new Error(`CAL test target in ${name} is invalid.`) }
    if (
      !['postgres:', 'postgresql:'].includes(target.protocol)
      || target.hostname !== '127.0.0.1'
      || target.port !== '55432'
      || target.pathname !== '/lab002_local'
    ) {
      throw new Error('CAL tests only create a disposable PostgreSQL 16 cluster; persistent or remote targets are rejected.')
    }
  }

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', '--test', 'tests/calendar.test.ts',
  ], { stdio: 'inherit', cwd: process.cwd(), windowsHide: true })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(error instanceof Error ? error.message : 'CAL test target rejected.')
  process.exitCode = 1
}
