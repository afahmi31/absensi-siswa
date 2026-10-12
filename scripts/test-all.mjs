import { spawnSync } from 'node:child_process'

for (const script of ['scripts/test-data.mjs', 'scripts/test-auth.mjs', 'scripts/test-students.mjs']) {
  const result = spawnSync(process.execPath, [script], {
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
