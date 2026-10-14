import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdtemp, mkdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { getAttendanceDayView, saveAttendanceDay } from '../server/database/repositories/attendance-days.ts'
import { createSemester, closeSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { createSchool, createSchoolClass } from '../server/database/repositories/schools.ts'
import { saveSchoolRoutine } from '../server/database/repositories/calendar.ts'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pgBin = 'C:\\Program Files\\PostgreSQL\\16\\bin'
const passwordHasher = new Scrypt({})
const statuses = ['H', 'S', 'I', 'A']

function pgExecutable(name) {
  const target = path.join(pgBin, `${name}.exe`)
  const version = execFileSync(target, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  if (!/\b16\./.test(version)) throw new Error('Fixture memerlukan binary PostgreSQL 16 yang sudah tersedia di komputer ini.')
  return target
}

function runPg(name, args, options = {}) {
  return execFileSync(pgExecutable(name), args, { stdio: 'ignore', ...options })
}

function secureDirectory(directory) {
  const output = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' })
  const sid = output.match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) throw new Error('Tidak dapat membatasi akses folder fixture lokal.')
  execFileSync('icacls.exe', [
    directory,
    '/inheritance:r',
    '/grant:r',
    `*${sid}:(OI)(CI)F`,
    '*S-1-5-18:(OI)(CI)F',
  ], { stdio: 'ignore' })
}

async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Tidak dapat memilih port loopback untuk fixture.')
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

function databaseUrl(user, password, port) {
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/lab002_fixture?sslmode=disable`
}

async function startPostgres(privateRoot) {
  const clusterPath = path.join(privateRoot, 'postgres')
  const port = await availablePort()
  const bootstrapPassword = randomBytes(32).toString('hex')
  const migrationPassword = randomBytes(32).toString('hex')
  const runtimePassword = randomBytes(32).toString('hex')
  const apiPasswords = Object.fromEntries(['anon', 'authenticated', 'service_role'].map((name) => [name, randomBytes(32).toString('hex')]))
  const bootstrapPath = path.join(privateRoot, 'bootstrap-password.txt')
  await writeFile(bootstrapPath, `${bootstrapPassword}\n`, { flag: 'wx', mode: 0o600 })
  await mkdir(clusterPath)
  execFileSync(pgExecutable('initdb'), [
    '-D', clusterPath,
    '-U', 'postgres',
    '--encoding=UTF8',
    '--locale=C',
    '--auth-local=scram-sha-256',
    '--auth-host=scram-sha-256',
    `--pwfile=${bootstrapPath}`,
  ], { stdio: 'ignore' })
  await writeFile(path.join(clusterPath, 'postgresql.conf'), [
    "listen_addresses = '127.0.0.1'",
    `port = ${port}`,
    "password_encryption = 'scram-sha-256'",
    "timezone = 'UTC'",
    "log_statement = 'none'",
    'log_connections = off',
    '',
  ].join('\n'), { flag: 'a' })
  await writeFile(path.join(clusterPath, 'pg_hba.conf'), [
    'local all all scram-sha-256',
    'host all all 127.0.0.1/32 scram-sha-256',
    'host all all ::1/128 reject',
    '',
  ].join('\n'))
  runPg('pg_ctl', ['-D', clusterPath, '-l', path.join(privateRoot, 'postgres.log'), '-w', 'start'])

  const admin = postgres(`postgres://postgres:${bootstrapPassword}@127.0.0.1:${port}/postgres?sslmode=disable`, { max: 1, connect_timeout: 5 })
  try {
    const [server] = await admin`select current_setting('server_version_num')::int as version_num`
    if (Math.floor(Number(server.version_num) / 10000) !== 16) throw new Error('Fixture hanya menerima PostgreSQL 16.')
    await admin.unsafe(`CREATE ROLE lab002_migrator LOGIN PASSWORD '${migrationPassword}'`)
    await admin.unsafe(`CREATE ROLE lab002_app LOGIN PASSWORD '${runtimePassword}'`)
    await admin.unsafe(`CREATE ROLE anon LOGIN PASSWORD '${apiPasswords.anon}'`)
    await admin.unsafe(`CREATE ROLE authenticated LOGIN PASSWORD '${apiPasswords.authenticated}'`)
    await admin.unsafe(`CREATE ROLE service_role LOGIN BYPASSRLS PASSWORD '${apiPasswords.service_role}'`)
    await admin.unsafe('CREATE DATABASE lab002_fixture OWNER lab002_migrator')
    await admin.unsafe('ALTER ROLE postgres NOLOGIN PASSWORD NULL')
  } finally {
    await admin.end({ timeout: 3 })
    await rm(bootstrapPath, { force: true })
  }

  return {
    clusterPath,
    port,
    migrationUrl: databaseUrl('lab002_migrator', migrationPassword, port),
    runtimeUrl: databaseUrl('lab002_app', runtimePassword, port),
    async stop() {
      runPg('pg_ctl', ['-D', clusterPath, '-m', 'fast', '-w', 'stop'])
    },
  }
}

async function closeSemesterForFixture(database, teacherId, semesterId) {
  const preview = await getSemesterClosurePreview(database, { semesterId, teacherId })
  if (!preview) throw new Error('Semester sintetis tidak ditemukan saat disiapkan sebagai arsip.')
  await withAuditActor(database, teacherId, (transaction) => closeSemester(transaction, {
    semesterId,
    teacherId,
    previewToken: preview.previewToken,
    confirmed: true,
  }))
}

async function createFixtureData(runtimeUrl, migrationUrl) {
  const migrator = postgres(migrationUrl, { max: 1, connect_timeout: 5 })
  const database = postgres(runtimeUrl, { max: 5, connect_timeout: 5 })
  const email = `laporan-${randomUUID().slice(0, 8)}@example.invalid`
  const password = randomBytes(24).toString('base64url')
  const revisionSecret = randomBytes(32).toString('base64url')

  try {
    await runMigrations(migrator, 'up')
    const teacher = await provisionTeacherAccount(migrator, email, await passwordHasher.make(password))
    const school = await createSchool(database, { teacherId: teacher.id, name: 'Sekolah Contoh Uji Laporan', timeZone: 'Asia/Jakarta' })
    const schoolClass = await createSchoolClass(database, { schoolId: school.id, name: 'Kelas Sintetis 45+' })

    const emptySemester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
      schoolId: school.id,
      academicYear: '2024/2025',
      term: 'genap',
      startsOn: '2025-01-10',
      endsOn: '2025-03-10',
    }))
    await withAuditActor(database, teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: '2025-01-10',
      schoolDays: [1, 2, 3, 4, 5],
    }))
    await closeSemesterForFixture(database, teacher.id, emptySemester.id)

    const archivedSemester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
      schoolId: school.id,
      academicYear: '2025/2026',
      term: 'genap',
      startsOn: '2026-01-01',
      endsOn: '2026-06-30',
    }))
    await withAuditActor(database, teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: '2026-01-01',
      schoolDays: [1, 2, 3, 4, 5],
    }))

    const syntheticStudents = []
    for (let index = 1; index <= 48; index += 1) {
      const isLongName = index === 1 || index === 2 || index === 3
      const fullName = isLongName
        ? `Anak Didik Dengan Nama Panjang Untuk Menguji Lebar Kolom Laporan Nomor ${String(index).padStart(2, '0')}`
        : `Siswa Contoh ${String(index).padStart(2, '0')}`
      const student = await createStudent(database, {
        fullName,
        studentNumber: index % 4 === 0 ? null : `S-${String(index).padStart(4, '0')}`,
        gender: index % 3 === 0 ? null : index % 2 === 0 ? 'P' : 'L',
      })
      const archivedMembership = await withAuditActor(database, teacher.id, (transaction) => addStudentToSemester(transaction, {
        semesterId: archivedSemester.id,
        schoolId: school.id,
        schoolClassId: schoolClass.id,
        studentId: student.id,
        startsOn: '2026-01-01',
      }))
      syntheticStudents.push({ student, archivedMembership })
    }

    await closeSemesterForFixture(database, teacher.id, archivedSemester.id)

    const activeSemester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
      schoolId: school.id,
      academicYear: '2026/2027',
      term: 'ganjil',
      startsOn: '2026-07-15',
      endsOn: '2026-12-10',
    }))
    await withAuditActor(database, teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: '2026-07-15',
      schoolDays: [1, 2, 3, 4, 5],
    }))

    const memberships = []
    for (const { student, archivedMembership } of syntheticStudents) {
      const activeMembership = await withAuditActor(database, teacher.id, (transaction) => addStudentToSemester(transaction, {
        semesterId: activeSemester.id,
        schoolId: school.id,
        schoolClassId: schoolClass.id,
        studentId: student.id,
        startsOn: '2026-07-15',
      }))
      memberships.push({ archivedMembership, activeMembership })
    }

    for (const [dayOffset, date] of ['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-20'].entries()) {
      const input = { teacherId: teacher.id, semesterId: activeSemester.id, date, revisionSecret }
      const view = await getAttendanceDayView(database, input)
      if (!view) throw new Error(`Hari sintetis ${date} tidak tersedia untuk seed absensi.`)
      const entries = view.roster.map((row, index) => ({
        membershipId: row.id,
        status: index % 11 === 0 && dayOffset > 0 ? null : statuses[(index + dayOffset) % statuses.length],
      }))
      await withAuditActor(database, teacher.id, (transaction) => saveAttendanceDay(transaction, {
        ...input,
        revision: view.revision,
        entries,
      }))
    }

    return {
      email,
      password,
      activeSemesterId: activeSemester.id,
      archivedSemesterId: archivedSemester.id,
      emptySemesterId: emptySemester.id,
      studentCount: memberships.length,
    }
  } finally {
    await Promise.all([
      migrator.end({ timeout: 3 }),
      database.end({ timeout: 3 }),
    ])
  }
}

async function createIsolatedNuxtRoot(privateRoot) {
  const root = await mkdtemp(path.join(privateRoot, 'nuxt-'))
  try {
    for (const entry of ['app', 'server', 'shared']) await cp(path.join(appRoot, entry), path.join(root, entry), { recursive: true })
    for (const entry of ['nuxt.config.ts', 'package.json']) await cp(path.join(appRoot, entry), path.join(root, entry))
    await symlink(path.join(appRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction')
    return root
  } catch (error) {
    await removeIsolatedNuxtRoot(root, privateRoot)
    throw error
  }
}

async function removeIsolatedNuxtRoot(root, privateRoot) {
  const resolved = await realpath(root).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!resolved) return
  const ownedRoot = await realpath(privateRoot)
  if (path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase() || !/^nuxt-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
    throw new Error('Menolak menghapus folder Nuxt di luar fixture sintetis yang dibuat script ini.')
  }
  const modulesPath = path.join(resolved, 'node_modules')
  const info = await lstat(modulesPath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (info) {
    if (!info.isSymbolicLink()) throw new Error('Folder node_modules fixture berubah dari junction yang dibuat script.')
    await unlink(modulesPath)
  }
  await rm(resolved, { recursive: true, force: false })
}

function sanitizeServerOutput(output, secrets) {
  let sanitized = output
  for (const secret of secrets) sanitized = sanitized.replaceAll(secret, '[redacted]')
  return sanitized.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[database-url-redacted]').slice(-4_000).trim()
}

async function waitForServer(child, baseUrl, output, secrets) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostics = sanitizeServerOutput(output(), secrets)
      throw new Error(`Server Nuxt fixture berhenti (exit ${child.exitCode ?? child.signalCode}).${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return
    } catch {}
    await delay(400)
  }
  throw new Error(`Server Nuxt fixture belum siap dalam 90 detik.${output() ? `\n${sanitizeServerOutput(output(), secrets)}` : ''}`)
}

async function stopOwnedProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(8_000)])
  if (child.exitCode === null && !child.signalCode && child.pid) {
    execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

async function runFixture() {
  const fixtureParent = path.join(appRoot, '.cache')
  await mkdir(fixtureParent, { recursive: true })
  const privateRoot = await mkdtemp(path.join(fixtureParent, 'reports-fixture-'))
  secureDirectory(privateRoot)
  let temporary
  let server
  let isolatedNuxtRoot
  let serverOutput = ''
  let shutdownRequested = false
  const requestShutdown = () => { shutdownRequested = true }
  const handleFixtureInput = (chunk) => {
    if (String(chunk).trim().toLowerCase() === 'stop') requestShutdown()
  }
  process.once('SIGINT', requestShutdown)
  process.once('SIGTERM', requestShutdown)
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', handleFixtureInput)

  try {
    temporary = await startPostgres(privateRoot)
    const credentials = await createFixtureData(temporary.runtimeUrl, temporary.migrationUrl)
    const sessionPassword = randomBytes(48).toString('base64url')
    const httpPort = await availablePort()
    const baseUrl = `http://127.0.0.1:${httpPort}`
    isolatedNuxtRoot = await createIsolatedNuxtRoot(privateRoot)
    server = spawn(process.execPath, [
      path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'),
      'dev', '--host', '127.0.0.1', '--port', String(httpPort), '--no-fork', '--no-tui', '--strictPort', isolatedNuxtRoot,
    ], {
      cwd: isolatedNuxtRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        NUXT_DATABASE_URL: temporary.runtimeUrl,
        NUXT_DATABASE_MODE: 'local',
        NUXT_SESSION_PASSWORD: sessionPassword,
        NUXT_TELEMETRY_DISABLED: '1',
        PORT: String(httpPort),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    server.stdout?.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    server.stderr?.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    await waitForServer(server, baseUrl, () => serverOutput, [credentials.password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

    console.log('Fixture absensi sintetis siap hanya di loopback.')
    console.log(`URL: ${baseUrl}`)
    console.log(`Akun uji: ${credentials.email}`)
    console.log(`Kata sandi uji: ${credentials.password}`)
    console.log(`Data: ${credentials.studentCount} siswa, semester aktif parsial, semester arsip, dan satu arsip tanpa siswa.`)
    console.log(`Untuk berhenti aman: ketik STOP lalu Enter pada sesi ini (atau kirim Ctrl+C). Folder sementara akan dibersihkan.`)
    console.log('Server Nuxt dan PostgreSQL hanya bind ke 127.0.0.1; tidak memakai database .data proyek.')

    await new Promise((resolve) => {
      const finish = () => resolve()
      server.once('exit', finish)
      const checkSignal = setInterval(() => {
        if (shutdownRequested) {
          clearInterval(checkSignal)
          finish()
        }
      }, 100)
      checkSignal.unref()
    })
  } finally {
    process.stdin.off('data', handleFixtureInput)
    process.stdin.pause()
    process.off('SIGINT', requestShutdown)
    process.off('SIGTERM', requestShutdown)
    await stopOwnedProcess(server)
    if (temporary) await temporary.stop().catch(() => {})
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot, privateRoot)
    const resolved = await realpath(privateRoot).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    const ownedParent = await realpath(fixtureParent).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    if (resolved && ownedParent && path.dirname(resolved).toLowerCase() === ownedParent.toLowerCase() && /^reports-fixture-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
      await rm(resolved, { recursive: true, force: false })
    }
  }
}

runFixture().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Fixture laporan sintetis gagal disiapkan.')
  process.exitCode = 1
})
