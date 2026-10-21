import { spawnSync } from 'node:child_process'
import { childEnvironment } from './local-backup-postgres.mjs'
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/local-backup-validation.test.ts', 'tests/local-backup-managed-identity.test.ts', 'tests/local-backup.test.ts'], { cwd: process.cwd(), stdio: 'inherit', windowsHide: true, env: childEnvironment() })
process.exitCode = result.status ?? 1
