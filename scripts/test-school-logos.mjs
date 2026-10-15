import { spawnSync } from 'node:child_process'

for (const [label, args] of [
  ['storage', ['--experimental-strip-types', '--test', 'tests/school-logo-storage.test.ts']],
  ['school HTTP and regression', ['scripts/test-students.mjs']],
]) {
  console.log(`\nSchool logo ${label} checks`)
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error) {
    console.error(result.error.message)
    process.exitCode = 1
    break
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    break
  }
}
