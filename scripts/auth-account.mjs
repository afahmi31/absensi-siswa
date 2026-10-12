import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { provisionTeacherAccount, resetTeacherAccountPassword } from '../server/auth/account-admin.ts'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(appRoot, '.data')
const clusterPath = path.join(dataRoot, 'postgres')
const metadataPath = path.join(dataRoot, 'local-db.json')
const accountPath = path.join(dataRoot, 'teacher-account.json')
const authEnvPath = path.join(dataRoot, 'auth-env.ps1')
const pgCtl = 'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe'
const passwordHash = new Scrypt({})

function validLocalUrl(value, expectedRole) {
  let url
  try { url = new URL(value) } catch { throw new Error('Managed local database metadata is invalid.') }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1'
    || url.port !== '55432'
    || url.pathname !== '/lab002_local'
    || decodeURIComponent(url.username) !== expectedRole
  ) {
    throw new Error('Account maintenance may only use the managed loopback PostgreSQL 16 database.')
  }
  return url
}

function verifyManagedCluster() {
  try {
    execFileSync(pgCtl, ['-D', clusterPath, 'status'], { stdio: 'ignore' })
  } catch {
    throw new Error('Start the managed project database with `npm run db:start` first.')
  }
}

async function atomicWriteJson(target, value) {
  const temporary = `${target}.${randomBytes(12).toString('hex')}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

async function ensureAuthEnvironment() {
  try {
    await access(authEnvPath)
    const contents = await readFile(authEnvPath, 'utf8')
    if (!/^\$env:NUXT_SESSION_PASSWORD = '[A-Za-z0-9_-]{64}'\r?\n?$/.test(contents)) {
      throw new Error('The private session environment file is invalid; inspect it locally before replacing it.')
    }
    return
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const sessionPassword = randomBytes(48).toString('base64url')
  await writeFile(authEnvPath, `$env:NUXT_SESSION_PASSWORD = '${sessionPassword}'\r\n`, { flag: 'wx', mode: 0o600 })
}

async function readExistingAccountFile(expectedEmail) {
  try {
    const contents = await readFile(accountPath, 'utf8')
    const parsed = JSON.parse(contents)
    if (
      typeof parsed.email !== 'string'
      || typeof parsed.password !== 'string'
      || parsed.email !== expectedEmail
      || parsed.password.length < 32
    ) {
      throw new Error('The private teacher account file does not match the local account; inspect it locally before continuing.')
    }
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    if (error instanceof SyntaxError) throw new Error('The private teacher account file is invalid; inspect it locally before continuing.')
    throw error
  }
}

async function main() {
  const command = process.argv[2]
  const emailArgument = process.argv[3]
  if (!['provision', 'reset'].includes(command) || (command === 'provision' && (!emailArgument || process.argv.length !== 4)) || (command === 'reset' && process.argv.length !== 3)) {
    throw new Error('Usage: auth-account.mjs provision <teacher-email> | reset')
  }

  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  if (
    metadata.formatVersion !== 1
    || metadata.postgresMajor !== 16
    || metadata.port !== 55432
    || metadata.database !== 'lab002_local'
    || path.resolve(metadata.clusterPath).toLowerCase() !== clusterPath.toLowerCase()
  ) {
    throw new Error('Managed local database metadata is invalid.')
  }
  const migrationUrl = validLocalUrl(metadata.migrationUrl, 'lab002_migrator')
  verifyManagedCluster()

  if (command === 'provision') {
    try { await access(accountPath); throw new Error('Private account credentials already exist; use the explicit owner reset command.') }
    catch (error) { if (error?.code !== 'ENOENT') throw error }
  }

  const database = postgres(migrationUrl.toString(), { max: 1, connect_timeout: 5 })
  try {
    const [target] = await database`
      select current_setting('server_version_num')::int as version_num,
             current_user as role_name,
             current_database() as database_name,
             inet_server_addr() = inet '127.0.0.1' as is_loopback,
             inet_server_port() as server_port
    `
    if (
      Math.floor(Number(target.version_num) / 10000) !== 16
      || target.role_name !== 'lab002_migrator'
      || target.database_name !== 'lab002_local'
      || !target.is_loopback
      || Number(target.server_port) !== 55432
    ) {
      throw new Error('Managed PostgreSQL verification failed; no account change was made.')
    }

    const migrations = await database`select name from public.schema_migrations where name = '0002_authentication'`
    if (migrations.length !== 1) throw new Error('Apply local authentication migrations with `npm run db:migrate` first.')

    const email = command === 'provision' ? emailArgument.trim().toLowerCase() : null
    if (command === 'reset') {
      const [account] = await database`select email from teacher_accounts order by created_at`
      const count = await database`select count(*)::int as count from teacher_accounts`
      if (count[0].count !== 1 || typeof account?.email !== 'string') {
        throw new Error('Password reset requires exactly one existing teacher account.')
      }
      if (!await readExistingAccountFile(account.email)) {
        // Reset is explicit owner recovery; it can recreate a lost local credential file.
      }
    }

    const password = randomBytes(24).toString('base64url')
    const hash = await passwordHash.make(password)
    try {
      if (command === 'provision') {
        await provisionTeacherAccount(database, email, hash)
      } else {
        const account = await resetTeacherAccountPassword(database, hash)
        const accountFile = { formatVersion: 1, email: account.email, password }
        await atomicWriteJson(accountPath, accountFile)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) throw error
      if (error instanceof Error && error.message.includes('exactly one')) throw error
      throw new Error('The local teacher account could not be updated. Check the local database state and retry explicitly.')
    }

    if (command === 'provision') {
      try {
        await atomicWriteJson(accountPath, { formatVersion: 1, email, password })
      } catch {
        throw new Error('The account row was created, but its private credential file could not be written. Use the explicit owner reset command to recover it.')
      }
    }
    await ensureAuthEnvironment()
    console.log('Local teacher credentials saved in the ignored .data directory. Keep those files private.')
  } finally {
    await database.end({ timeout: 3 })
  }
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : 'Local teacher account maintenance failed.'
  if (message.includes('password') || message.includes('postgres') || message.includes('connection')) {
    console.error('Local teacher account maintenance failed. Check the managed database status and private .data files.')
  } else {
    console.error(message)
  }
  process.exitCode = 1
}
