import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, realpath, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import type { AttendanceReport, AttendanceReportPaper } from '../app/types/attendance-report.ts'
import postgres from 'postgres'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { getAttendanceDayView, saveAttendanceDay } from '../server/database/repositories/attendance-days.ts'
import { createSemester, closeSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { createSchool, createSchoolClass, createSchoolLogoAsset, setActiveSchoolLogo, updateSchoolForTeacher, updateSchoolClass } from '../server/database/repositories/schools.ts'
import { LocalSchoolLogoStorage } from '../server/utils/school-logo-storage.ts'
import { getAttendanceReport } from '../server/database/repositories/reports.ts'
import { buildAttendanceReportLayoutBundle, renderAttendanceReportPdf } from '../server/utils/report-export.ts'
import { createTeacherAccount } from '../server/database/repositories/teacher-accounts.ts'
import { saveSchoolRoutine, setCalendarException } from '../server/database/repositories/calendar.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'
import { listMigrationNames } from './support/migration-names.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.cache', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

test('REP-001C shared layout plans and PDFKit output cover A4, custom F4, and Letter', async () => {
  const daysFor = (year: number, month: number) => Array.from({ length: 31 }, (_, index) => {
    const day = index + 1
    const date = new Date(Date.UTC(year, month - 1, day))
    const exists = date.getUTCMonth() === month - 1
    return {
      day,
      date: exists ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null,
      inSemester: exists,
      isSchoolDay: exists && date.getUTCDay() > 0 && date.getUTCDay() < 6,
    }
  })
  const makeRow = (index: number) => ({
    membershipId: `${String(index + 1).padStart(8, '0')}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: index === 0 ? 'Siswa dengan nama yang cukup panjang untuk menguji pemenggalan baris laporan '.repeat(2) : `Siswa ${String(index + 1).padStart(2, '0')}`,
    studentNumber: index % 4 === 0 ? null : `NIPD-${String(index + 1).padStart(3, '0')}`,
    gender: index % 2 === 0 ? 'L' as const : 'P' as const,
    cells: Array.from({ length: 31 }, (_, dayIndex) => dayIndex === 1 ? 'H' as const : dayIndex === 4 ? 'S' as const : null),
    totals: { H: 1, S: 1, I: 0, A: 0 },
  })
  const rows = Array.from({ length: 48 }, (_, index) => makeRow(index))
  const report: AttendanceReport = {
    mode: 'semester',
    semester: {
      id: '11111111-1111-4111-8111-111111111111',
      academicYear: '2024/2025',
      term: 'ganjil',
      startsOn: '2024-07-15',
      endsOn: '2024-09-10',
      status: 'active',
      schoolName: 'Sekolah Sintetis untuk Uji PDF',
      className: 'Kelas 6A',
    },
    months: [
      { month: '2024-07', days: daysFor(2024, 7), rows },
      { month: '2024-08', days: daysFor(2024, 8), rows: [] },
      { month: '2024-09', days: daysFor(2024, 9), rows: rows.slice(0, 1) },
    ],
  }

  const bundle = buildAttendanceReportLayoutBundle(report)
  assert.equal(bundle.revision, buildAttendanceReportLayoutBundle(report).revision, 'revision excludes generated PDF metadata and stays deterministic')
  assert.match(bundle.revision, /^[a-f\d]{64}$/)

  for (const paper of ['a4', 'f4', 'letter'] as const satisfies readonly AttendanceReportPaper[]) {
    const plan = bundle.plans[paper]
    assert.equal(plan.columnWidthsPt.length, 38)
    assert.ok(Math.abs(plan.columnWidthsPt.reduce((sum, width) => sum + width, 0) - plan.contentWidthPt) < 0.001)
    assert.equal(plan.pages.some((page) => page.monthIndex === 1 && page.rows.length === 0), true,
      'an empty month retains its heading/header page without a fabricated student row')
    assert.deepEqual(
      plan.pages.filter((page) => page.monthIndex === 0).flatMap((page) => page.rows.map((row) => row.membershipId)).sort(),
      rows.map((row) => row.membershipId).sort(),
      'pagination places every student exactly once for the month',
    )

    const pdf = await renderAttendanceReportPdf(bundle, paper)
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
    const source = pdf.toString('latin1')
    assert.equal(source.match(/\/Type\s*\/Page\b/g)?.length, plan.pages.length)
    if (paper === 'f4') {
      assert.ok(Math.abs(plan.widthPt - 330 * 72 / 25.4) < 0.001, 'F4 width uses the approved custom 330 mm value')
      assert.ok(Math.abs(plan.heightPt - 216 * 72 / 25.4) < 0.001, 'F4 height uses the approved custom 216 mm value')
      const mediaBox = source.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
      assert.ok(mediaBox, 'F4 PDF exposes a page media box')
      assert.ok(Math.abs(Number(mediaBox[1]) - plan.widthPt) < 0.001)
      assert.ok(Math.abs(Number(mediaBox[2]) - plan.heightPt) < 0.001)
    }
  }
  const artifactRoot = path.join(appRoot, '.cache', 'rep001d-pdfs')
  await mkdir(artifactRoot, { recursive: true })
  for (const mimeType of ['image/png', 'image/jpeg'] as const) {
    const width = mimeType === 'image/png' ? 240 : 80
    const height = mimeType === 'image/png' ? 80 : 240
    const image = sharp({ create: { width, height, channels: 3, background: mimeType === 'image/png' ? '#167c59' : '#c78223' } })
    const bytes = await (mimeType === 'image/png' ? image.png() : image.jpeg()).toBuffer()
    const withLogo = structuredClone(report)
    withLogo.semester.schoolName = 'Sekolah Sintetis Dengan Nama Panjang untuk Memastikan Judul Membungkus '.repeat(3)
    withLogo.semester.logo = { assetId: randomUUID(), mimeType, width, height, byteSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    const logoBundle = buildAttendanceReportLayoutBundle(withLogo)
    assert.notEqual(logoBundle.revision, bundle.revision)
    for (const paper of ['a4', 'f4', 'letter'] as const) {
      const plan = logoBundle.plans[paper]
      assert.deepEqual(plan.pages.filter((page) => page.monthIndex === 0).flatMap((page) => page.rows.map((row) => row.membershipId)), rows.map((row) => row.membershipId))
      for (const page of plan.pages) {
        assert.equal(page.headingTextOffsetPt, 44)
        assert.ok(page.logo)
        assert.ok(Math.abs(page.logo.widthPt / page.logo.heightPt - width / height) < 0.0001)
        assert.ok(page.headingHeightPt >= page.logo.yPt + page.logo.heightPt)
        assert.ok(page.headingTextWidthPt + 44 <= plan.contentWidthPt + 0.001)
      }
      const pdf = await renderAttendanceReportPdf(logoBundle, paper, bytes)
      assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image\b/)
      await writeFile(path.join(artifactRoot, `${mimeType === 'image/png' ? 'wide' : 'tall'}-${paper}.pdf`), pdf)
    }
  }
})

interface ReportFixture {
  teacherId: string
  email: string
  password: string
  schoolId: string
  classId: string
  semesterId: string
  emptySemesterId: string
  archiveSemesterId: string
  memberOneId: string
  memberTwoId: string
  januaryMemberId: string
}

function fetchLocal(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) })
}

async function availablePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not choose a local HTTP test port.')
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

async function createIsolatedNuxtRoot(): Promise<string> {
  await mkdir(testRoot, { recursive: true })
  const root = await mkdtemp(path.join(testRoot, 'reports-nuxt-root-'))
  try {
    for (const entry of ['app', 'server', 'shared']) await cp(path.join(appRoot, entry), path.join(root, entry), { recursive: true })
    for (const entry of ['nuxt.config.ts', 'package.json']) await cp(path.join(appRoot, entry), path.join(root, entry))
    await symlink(path.join(appRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction')
    return root
  } catch (error) {
    await removeIsolatedNuxtRoot(root)
    throw error
  }
}

async function removeIsolatedNuxtRoot(root: string): Promise<void> {
  const resolved = await realpath(root).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!resolved) return
  const ownedRoot = await realpath(testRoot)
  if (path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase() || !/^reports-nuxt-root-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
    throw new Error('Refusing to remove an isolated Nuxt project outside the generated reports test directory.')
  }
  const modulesPath = path.join(resolved, 'node_modules')
  const modulesInfo = await lstat(modulesPath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (modulesInfo) {
    if (!modulesInfo.isSymbolicLink()) throw new Error('Refusing to remove an isolated project with an unexpected node_modules path.')
    await unlink(modulesPath)
  }
  await rm(resolved, { recursive: true, force: false })
}

function sanitizeServerOutput(output: string, secrets: string[]): string {
  let sanitized = output
  for (const secret of secrets) sanitized = sanitized.replaceAll(secret, '[redacted]')
  sanitized = sanitized.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[database-url-redacted]')
  sanitized = sanitized.replace(/NUXT_SESSION_PASSWORD\s*[:=]\s*[^\s'"<>]+/gi, 'NUXT_SESSION_PASSWORD=[redacted]')
  return sanitized.slice(-3000).trim()
}

async function waitForServer(
  child: ReturnType<typeof spawn>,
  baseUrl: string,
  serverOutput: () => string,
  secrets: string[],
): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostics = sanitizeServerOutput(serverOutput(), secrets)
      throw new Error(`Nuxt REP test server exited with code ${child.exitCode ?? child.signalCode}.${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      if ((await fetchLocal(`${baseUrl}/api/auth/session`)).ok) return
    } catch {}
    await delay(300)
  }
  throw new Error('Nuxt REP test server did not become ready within 60 seconds.')
}

async function stopOwnedProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise<void>((resolve) => child.once('exit', () => resolve())), delay(8_000)])
  if (child.exitCode !== null || child.signalCode) return
  execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie, 'successful login should set a session cookie')
  return setCookie.split(';', 1)[0]!
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>
}

test('REP-001A protected report model keeps month cells, totals, archive metadata, and GET data read-only', { timeout: 240_000 }, async (t) => {
  for (const name of ['LAB002_TEST_DATABASE_URL', 'DATABASE_URL', 'NUXT_DATABASE_URL']) {
    const value = process.env[name]
    if (!value) continue
    let target: URL
    try { target = new URL(value) } catch { throw new Error(`REP test target in ${name} is invalid.`) }
    if (!['postgres:', 'postgresql:'].includes(target.protocol)
      || target.hostname !== '127.0.0.1'
      || target.port !== '55432'
      || target.pathname !== '/lab002_local') {
      throw new Error('REP tests only create a disposable PostgreSQL 16 cluster; persistent or remote targets are rejected.')
    }
  }

  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const database = postgres(temporary.runtimeUrl, { max: 8, connect_timeout: 5 })
  let server: ReturnType<typeof spawn> | undefined
  let serverOutput = ''
  let isolatedNuxtRoot: string | undefined
  let baseUrl = ''
  let ownerCookie = ''
  let fixture: ReportFixture | undefined
  await mkdir(testRoot, { recursive: true })
  const logoRoot = await mkdtemp(path.join(testRoot, 'reports-logo-'))
  let archivedLogoId = ''
  let activeLogoId = ''
  let activeLogoBytes = Buffer.alloc(0)
  const password = randomBytes(24).toString('base64url')
  const sessionPassword = randomBytes(48).toString('base64url')
  const revisionSecret = randomBytes(32).toString('base64url')

  try {
    const migrations = await runMigrations(migrator, 'up')
    const expectedNames = await listMigrationNames()
    assert.deepEqual(migrations.map((migration) => migration.name), expectedNames)
    assert.deepEqual(migrations.map((migration) => migration.applied), expectedNames.map(() => true))

    const email = `rep-${randomUUID()}@example.invalid`
    const teacher = await provisionTeacherAccount(migrator, email, await passwordHasher.make(password))
    const school = await createSchool(database, { teacherId: teacher.id, name: 'Sekolah Arsip', timeZone: 'Asia/Jakarta' })
    const schoolClass = await createSchoolClass(database, { schoolId: school.id, name: 'Kelas Arsip' })
    const archiveSemester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
      schoolId: school.id,
      academicYear: '2022/2023',
      term: 'genap',
      startsOn: '2023-02-01',
      endsOn: '2023-04-30',
    }))
    await withAuditActor(database, teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: '2023-02-01',
      schoolDays: [1, 2, 3, 4, 5],
    }))
    const archivePreview = await getSemesterClosurePreview(database, { semesterId: archiveSemester.id, teacherId: teacher.id })
    assert.ok(archivePreview, 'the synthetic archive semester should have a closure preview')
    await withAuditActor(database, teacher.id, (transaction) => closeSemester(transaction, {
      semesterId: archiveSemester.id,
      teacherId: teacher.id,
      previewToken: archivePreview.previewToken,
      confirmed: true,
    }))
    await withAuditActor(database, teacher.id, (transaction) => updateSchoolForTeacher(transaction, {
      teacherId: teacher.id,
      name: 'Sekolah Aktif',
      timeZone: 'Asia/Jakarta',
    }))
    await updateSchoolClass(database, { schoolId: school.id, name: 'Kelas Aktif' })
    const semester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
      schoolId: school.id,
      academicYear: '2023/2024',
      term: 'genap',
      startsOn: '2023-12-15',
      endsOn: '2024-03-10',
    }))
    await withAuditActor(database, teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: '2023-12-15',
      schoolDays: [1, 2, 3, 4, 5],
    }))

    const studentOne = await createStudent(database, { fullName: 'Siswa Sama', studentNumber: null, gender: null })
    const studentTwo = await createStudent(database, { fullName: 'Siswa Sama', studentNumber: 'N-02', gender: 'P' })
    const januaryStudent = await createStudent(database, { fullName: 'Siswa Januari', studentNumber: null, gender: null })
    const addMembership = (studentId: string, startsOn: string, endsOn: string | null) => withAuditActor(database, teacher.id, (transaction) => addStudentToSemester(transaction, {
      semesterId: semester.id,
      schoolId: school.id,
      schoolClassId: schoolClass.id,
      studentId,
      startsOn,
      endsOn,
    }))
    const memberOne = await addMembership(studentOne.id, '2024-02-12', '2024-02-20')
    const memberTwo = await addMembership(studentTwo.id, '2024-02-20', null)
    const januaryMember = await addMembership(januaryStudent.id, '2024-01-15', '2024-01-31')

    await withAuditActor(database, teacher.id, (transaction) => setCalendarException(transaction, {
      schoolId: school.id,
      date: '2024-02-17',
      kind: 'school_day',
      note: 'Hari sekolah sintetis',
    }))

    const saveDay = async (date: string, entries: Array<{ membershipId: string; status: 'H' | 'S' | 'I' | 'A' | null }>) => {
      const input = { teacherId: teacher.id, semesterId: semester.id, date, revisionSecret }
      const view = await getAttendanceDayView(database, input)
      assert.ok(view, `synthetic daily attendance view should exist for ${date}`)
      await withAuditActor(database, teacher.id, (transaction) => saveAttendanceDay(transaction, {
        ...input,
        revision: view.revision,
        entries,
      }))
    }

    await saveDay('2024-01-31', [{ membershipId: januaryMember.id, status: 'A' }])
    await saveDay('2024-02-12', [{ membershipId: memberOne.id, status: 'H' }])
    await saveDay('2024-02-13', [{ membershipId: memberOne.id, status: 'S' }])
    await saveDay('2024-02-14', [{ membershipId: memberOne.id, status: 'I' }])
    await saveDay('2024-02-14', [{ membershipId: memberOne.id, status: 'A' }])
    await saveDay('2024-02-15', [{ membershipId: memberOne.id, status: 'S' }])
    await withAuditActor(database, teacher.id, (transaction) => setCalendarException(transaction, {
      schoolId: school.id,
      date: '2024-02-15',
      kind: 'holiday',
      note: 'Libur sintetis',
      confirmedAttendanceImpact: true,
    }))
    await saveDay('2024-02-16', [{ membershipId: memberOne.id, status: 'H' }])
    await saveDay('2024-02-16', [{ membershipId: memberOne.id, status: null }])
    await saveDay('2024-02-17', [{ membershipId: memberOne.id, status: 'H' }])
    await withAuditActor(database, teacher.id, (transaction) => setCalendarException(transaction, {
      schoolId: school.id,
      date: '2024-02-17',
      kind: 'holiday',
      note: 'Libur lalu dipulihkan sintetis',
      confirmedAttendanceImpact: true,
    }))
    await withAuditActor(database, teacher.id, (transaction) => setCalendarException(transaction, {
      schoolId: school.id,
      date: '2024-02-17',
      kind: 'school_day',
      note: 'Hari sekolah dipulihkan sintetis',
      confirmedAttendanceImpact: true,
    }))
    await saveDay('2024-02-19', [{ membershipId: memberOne.id, status: 'S' }])
    await saveDay('2024-02-19', [{ membershipId: memberOne.id, status: null }])
    await saveDay('2024-02-20', [
      { membershipId: memberOne.id, status: 'A' },
      { membershipId: memberTwo.id, status: 'H' },
    ])
    await saveDay('2024-02-21', [{ membershipId: memberTwo.id, status: 'S' }])
    await saveDay('2024-02-22', [{ membershipId: memberTwo.id, status: 'I' }])
    await saveDay('2024-02-23', [{ membershipId: memberTwo.id, status: 'A' }])
    await saveDay('2024-03-01', [{ membershipId: memberTwo.id, status: 'H' }])

    const activeModel = await getAttendanceReport(database, {
      teacherId: teacher.id,
      semesterId: semester.id,
      mode: 'month',
      month: '2024-02',
    })
    assert.equal(activeModel.kind, 'report')
    if (activeModel.kind !== 'report') throw new Error('Active synthetic semester report should be available.')
    assert.equal(activeModel.report.semester.status, 'active')
    assert.equal(activeModel.report.months[0]?.rows.length, 2)

    async function seedReportLogo(mimeType: 'image/png' | 'image/jpeg', width: number, height: number) {
      const id = randomUUID()
      const image = sharp({ create: { width, height, channels: 3, background: '#167c59' } })
      const bytes = await (mimeType === 'image/png' ? image.png() : image.jpeg()).toBuffer()
      await new LocalSchoolLogoStorage(logoRoot).write(id, mimeType, bytes)
      await withAuditActor(database, teacher.id, async (transaction) => {
        await createSchoolLogoAsset(transaction, { assetId: id, schoolId: school.id, mimeType, byteSize: bytes.length, width, height, sha256: createHash('sha256').update(bytes).digest('hex'), uploadedBy: teacher.id })
        await setActiveSchoolLogo(transaction, { schoolId: school.id, assetId: id })
      })
      return { id, bytes }
    }
    archivedLogoId = (await seedReportLogo('image/png', 240, 80)).id

    const mainPreview = await getSemesterClosurePreview(database, { semesterId: semester.id, teacherId: teacher.id })
    assert.ok(mainPreview, 'the synthetic report semester should have a closure preview')
    await withAuditActor(database, teacher.id, (transaction) => closeSemester(transaction, {
      semesterId: semester.id,
      teacherId: teacher.id,
      previewToken: mainPreview.previewToken,
      confirmed: true,
    }))
    const activeLogo = await seedReportLogo('image/jpeg', 80, 240)
    activeLogoId = activeLogo.id
    activeLogoBytes = activeLogo.bytes
    const emptySemester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
      schoolId: school.id,
      academicYear: '2024/2025',
      term: 'ganjil',
      startsOn: '2024-07-01',
      endsOn: '2024-08-31',
    }))

    const foreignTeacher = await createTeacherAccount(migrator, `foreign-${randomUUID()}@example.invalid`)
    const foreignSchool = await createSchool(database, { teacherId: foreignTeacher.id, name: 'Sekolah Guru Lain', timeZone: 'Asia/Jakarta' })
    await createSchoolClass(database, { schoolId: foreignSchool.id, name: 'Kelas Guru Lain' })
    const foreignSemester = await withAuditActor(database, foreignTeacher.id, (transaction) => createSemester(transaction, {
      schoolId: foreignSchool.id,
      academicYear: '2023/2024',
      term: 'genap',
      startsOn: '2023-12-15',
      endsOn: '2024-03-10',
    }))

    fixture = {
      teacherId: teacher.id,
      email,
      password,
      schoolId: school.id,
      classId: schoolClass.id,
      semesterId: semester.id,
      emptySemesterId: emptySemester.id,
      archiveSemesterId: archiveSemester.id,
      memberOneId: memberOne.id,
      memberTwoId: memberTwo.id,
      januaryMemberId: januaryMember.id,
    }

    const port = await availablePort()
    baseUrl = `http://127.0.0.1:${port}`
    isolatedNuxtRoot = await createIsolatedNuxtRoot()
    server = spawn(process.execPath, [
      path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'),
      'dev', '--host', '127.0.0.1', '--port', String(port), '--no-fork', '--no-tui', '--strictPort', isolatedNuxtRoot,
    ], {
      cwd: isolatedNuxtRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        NUXT_DATABASE_URL: temporary.runtimeUrl,
        NUXT_SESSION_PASSWORD: sessionPassword,
        NUXT_TELEMETRY_DISABLED: '1',
        LAB002_FIXTURE: '1',
        LAB002_SCHOOL_LOGO_ROOT: logoRoot,
        PORT: String(port),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    server.stdout?.on('data', (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    server.stderr?.on('data', (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    await waitForServer(server, baseUrl, () => serverOutput, [password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

    const ownerLogin = await fetchLocal(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email: fixture.email, password }),
    })
    assert.equal(ownerLogin.status, 200)
    ownerCookie = cookieFrom(ownerLogin)

    const reportUrl = (semesterId: string, query: string) => `/api/reports/${semesterId}?${query}`
    const getReport = (semesterId: string, query: string, cookie = ownerCookie) => fetchLocal(`${baseUrl}${reportUrl(semesterId, query)}`, {
      headers: cookie ? { cookie } : {},
    })
    const [beforeReads] = await database<{
      attendance_count: number
      audit_count: number
      archive_count: number
      membership_count: number
      calendar_rule_count: number
      calendar_exception_count: number
    }[]>`
      select (select count(*)::int from attendance_records) as attendance_count,
             (select count(*)::int from audit_events) as audit_count,
             (select count(*)::int from semester_archive_snapshots) as archive_count,
             (select count(*)::int from semester_memberships) as membership_count,
             (select count(*)::int from school_calendar_rules) as calendar_rule_count,
             (select count(*)::int from calendar_exceptions) as calendar_exception_count
    `

    await t.test('month mode uses inclusive partial boundaries, leap-day grid, snapshot roster, and effective totals', async () => {
      const unauthenticated = await getReport(fixture!.semesterId, 'mode=month&month=2024-02', '')
      assert.equal(unauthenticated.status, 401)

      const response = await getReport(fixture!.semesterId, 'mode=month&month=2024-02')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const body = await jsonResponse(response)
      assert.equal(body.mode, 'month')
      const semester = body.semester as Record<string, unknown>
      assert.equal(semester.schoolName, 'Sekolah Aktif')
      assert.equal(semester.className, 'Kelas Aktif')
      assert.equal(semester.status, 'closed')
      const months = body.months as Array<Record<string, unknown>>
      assert.equal(months.length, 1)
      const february = months[0]!
      assert.equal(february.month, '2024-02')
      const days = february.days as Array<Record<string, unknown>>
      assert.equal(days.length, 31)
      assert.equal(days.find((day) => day.day === 29)?.date, '2024-02-29')
      assert.equal(days.find((day) => day.day === 30)?.date, null)
      assert.equal(days.find((day) => day.day === 31)?.date, null)
      assert.equal(days.find((day) => day.day === 15)?.isSchoolDay, false, 'the holiday must not be treated as a school day')
      assert.equal(days.find((day) => day.day === 17)?.isSchoolDay, true, 'the restored Saturday remains a school day')

      const rows = february.rows as Array<Record<string, unknown>>
      assert.deepEqual(rows.map((row) => row.membershipId), [fixture!.memberOneId, fixture!.memberTwoId].sort(),
        'same-name roster entries are deterministically ordered by membership ID')
      const memberOne = rows.find((row) => row.membershipId === fixture!.memberOneId)!
      const memberTwo = rows.find((row) => row.membershipId === fixture!.memberTwoId)!
      assert.equal(memberOne.name, 'Siswa Sama', 'membership identity keeps its saved name snapshot')
      assert.equal(memberOne.studentNumber, null, 'missing student number is represented as empty')
      assert.equal(memberOne.gender, null, 'missing gender is represented as empty')
      const firstCells = memberOne.cells as Array<string | null>
      assert.equal(firstCells.length, 31)
      assert.equal(firstCells[11], 'H')
      assert.equal(firstCells[12], 'S')
      assert.equal(firstCells[13], 'A', 'correction replaces the former effective value')
      assert.equal(firstCells[14], null, 'holiday-excluded attendance stays blank')
      assert.equal(firstCells[15], null, 'manual clear does not count as an effective status')
      assert.equal(firstCells[16], null, 'restoring a school day does not revive holiday-excluded attendance')
      assert.equal(firstCells[18], null, 'a second manual clear remains blank')
      assert.equal(firstCells[19], 'A', 'membership end date is inclusive')
      assert.deepEqual(memberOne.totals, { H: 1, S: 1, I: 0, A: 2 })

      const secondCells = memberTwo.cells as Array<string | null>
      assert.equal(secondCells[19], 'H', 'membership start date is inclusive')
      assert.deepEqual(secondCells.slice(20, 23), ['S', 'I', 'A'])
      assert.deepEqual(memberTwo.totals, { H: 1, S: 1, I: 1, A: 1 })
    })

    await t.test('semester mode is chronological across years; month mode rejects outside dates', async () => {
      const response = await getReport(fixture!.semesterId, 'mode=semester')
      assert.equal(response.status, 200)
      const body = await jsonResponse(response)
      const months = body.months as Array<Record<string, unknown>>
      assert.deepEqual(months.map((month) => month.month), ['2023-12', '2024-01', '2024-02', '2024-03'])
      assert.equal((months[0]!.days as Array<Record<string, unknown>>).find((day) => day.day === 14)?.inSemester, false)
      assert.equal((months[0]!.days as Array<Record<string, unknown>>).find((day) => day.day === 15)?.inSemester, true)
      assert.deepEqual(months[0]!.rows, [], 'a month without overlapping memberships has an empty roster')

      const january = months[1]!
      const januaryRows = january.rows as Array<Record<string, unknown>>
      assert.deepEqual(januaryRows.map((row) => row.membershipId), [fixture!.januaryMemberId])
      assert.equal((januaryRows[0]!.cells as Array<string | null>)[30], 'A')
      const march = months[3]!
      const marchDays = march.days as Array<Record<string, unknown>>
      assert.equal(marchDays.find((day) => day.day === 10)?.inSemester, true)
      assert.equal(marchDays.find((day) => day.day === 11)?.inSemester, false)
      const marchRow = (march.rows as Array<Record<string, unknown>>).find((row) => row.membershipId === fixture!.memberTwoId)!
      assert.equal((marchRow.cells as Array<string | null>)[0], 'H')
      assert.equal((marchRow.cells as Array<string | null>)[10], null)

      const outside = await getReport(fixture!.semesterId, 'mode=month&month=2023-11')
      assert.equal(outside.status, 422)
      assert.match(String((await jsonResponse(outside)).statusMessage), /di luar periode semester/i)
    })

    await t.test('closed semester uses immutable archive metadata and covers 28, 30 and 31-day months', async () => {
      const response = await getReport(fixture!.archiveSemesterId, 'mode=semester')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const body = await jsonResponse(response)
      const semester = body.semester as Record<string, unknown>
      assert.equal(semester.status, 'closed')
      assert.equal(semester.schoolName, 'Sekolah Arsip')
      assert.equal(semester.className, 'Kelas Arsip')
      assert.deepEqual((body.months as Array<Record<string, unknown>>).map((month) => month.month), ['2023-02', '2023-03', '2023-04'])
      const februaryDays = ((body.months as Array<Record<string, unknown>>)[0]!.days as Array<Record<string, unknown>>)
      const aprilDays = ((body.months as Array<Record<string, unknown>>)[2]!.days as Array<Record<string, unknown>>)
      assert.equal(februaryDays.find((day) => day.day === 28)?.date, '2023-02-28')
      assert.equal(februaryDays.find((day) => day.day === 29)?.date, null)
      assert.equal(aprilDays.find((day) => day.day === 30)?.date, '2023-04-30')
      assert.equal(aprilDays.find((day) => day.day === 31)?.date, null)
      assert.deepEqual((body.months as Array<Record<string, unknown>>).every((month) => (month.rows as unknown[]).length === 0), true,
        'empty membership is represented by empty monthly rows')
    })

    await t.test('active empty semester keeps school class metadata with empty monthly rows', async () => {
      const response = await getReport(fixture!.emptySemesterId, 'mode=semester')
      assert.equal(response.status, 200)
      const body = await jsonResponse(response)
      assert.equal((body.semester as Record<string, unknown>).className, 'Kelas Aktif')
      assert.deepEqual((body.months as Array<Record<string, unknown>>).map((month) => month.rows), [[], []])
    })

    await t.test('invalid input and foreign or unknown semester IDs have safe responses', async () => {
      const invalidMode = await getReport(fixture!.semesterId, 'mode=annual')
      assert.equal(invalidMode.status, 422)
      assert.match(String((await jsonResponse(invalidMode)).statusMessage), /laporan bulan atau semester/i)
      const invalidMonth = await getReport(fixture!.semesterId, 'mode=month&month=2024-13')
      assert.equal(invalidMonth.status, 422)
      const invalidDate = await getReport(fixture!.semesterId, 'mode=month&month=2024-02&date=2024-02-31')
      assert.equal(invalidDate.status, 422)
      assert.match(String((await jsonResponse(invalidDate)).statusMessage), /bulan, bukan tanggal/i)
      const semesterWithMonth = await getReport(fixture!.semesterId, 'mode=semester&month=2024-02')
      assert.equal(semesterWithMonth.status, 422)
      const invalidId = await getReport('not-a-uuid', 'mode=semester')
      assert.equal(invalidId.status, 422)
      const unknown = await getReport(randomUUID(), 'mode=semester')
      assert.equal(unknown.status, 404)
      const foreignId = await getReport(foreignSemester.id, 'mode=semester')
      assert.equal(foreignId.status, 404)
      const foreignBody = await jsonResponse(foreignId)
      const unknownBody = await jsonResponse(unknown)
      assert.equal(foreignBody.statusCode, unknownBody.statusCode)
      assert.equal(foreignBody.statusMessage, unknownBody.statusMessage, 'foreign and unknown semesters share the same safe error')
      assert.doesNotMatch(JSON.stringify(foreignBody), /Sekolah Guru Lain|postgres(?:ql)?:\/\/|select\s/i)
    })

    await t.test('layout and PDF endpoints preserve the report, empty state, revision, and safe response headers', async () => {
      const getLayout = (semesterId: string, query: string, cookie = ownerCookie) => fetchLocal(
        `${baseUrl}/api/reports/${semesterId}/layout?${query}`,
        { headers: cookie ? { cookie } : {} },
      )
      const getPdf = (semesterId: string, query: string, cookie = ownerCookie) => fetchLocal(
        `${baseUrl}/api/reports/${semesterId}/pdf?${query}`,
        { headers: cookie ? { cookie } : { accept: 'application/pdf' } },
      )

      const unauthenticatedLayout = await getLayout(fixture!.semesterId, 'mode=month&month=2024-02', '')
      assert.equal(unauthenticatedLayout.status, 401)
      const unauthenticatedPdf = await getPdf(fixture!.semesterId, 'mode=month&month=2024-02&paper=f4', '')
      assert.equal(unauthenticatedPdf.status, 401)

      const layoutResponse = await getLayout(fixture!.semesterId, 'mode=month&month=2024-02')
      assert.equal(layoutResponse.status, 200)
      assert.equal(layoutResponse.headers.get('cache-control'), 'no-store')
      assert.equal(layoutResponse.headers.get('x-content-type-options'), 'nosniff')
      const bundle = await jsonResponse(layoutResponse) as Record<string, unknown>
      const legacyResponse = await getReport(fixture!.semesterId, 'mode=month&month=2024-02')
      assert.deepEqual((bundle.report as Record<string, unknown>), await jsonResponse(legacyResponse),
        'layout GET wraps the existing A report model without changing its content')
      assert.match(String(bundle.revision), /^[a-f\d]{64}$/)
      const secondBundle = await jsonResponse(await getLayout(fixture!.semesterId, 'mode=month&month=2024-02')) as Record<string, unknown>
      assert.equal(secondBundle.revision, bundle.revision, 'the same report creates a stable revision')
      const plans = bundle.plans as Record<string, Record<string, unknown>>
      assert.equal(Math.round(Number(plans.f4!.widthPt) * 10000) / 10000, 935.4331)
      assert.equal(Math.round(Number(plans.f4!.heightPt) * 10000) / 10000, 612.2835)
      assert.equal((plans.a4!.columnWidthsPt as unknown[]).length, 38)

      const invalidPaper = await getPdf(fixture!.semesterId, 'mode=month&month=2024-02&paper=legal')
      assert.equal(invalidPaper.status, 422)
      const staleRevision = String(bundle.revision).startsWith('a') ? 'b' : 'a'
      const stalePdf = await getPdf(fixture!.semesterId, `mode=month&month=2024-02&paper=f4&revision=${staleRevision.repeat(64)}`)
      assert.equal(stalePdf.status, 409)
      const badRevision = await getPdf(fixture!.semesterId, 'mode=month&month=2024-02&paper=f4&revision=old')
      assert.equal(badRevision.status, 422)

      const pdfResponse = await getPdf(fixture!.semesterId, `mode=month&month=2024-02&paper=f4&revision=${bundle.revision}`)
      assert.equal(pdfResponse.status, 200)
      assert.match(pdfResponse.headers.get('content-type') ?? '', /^application\/pdf(?:;|$)/i)
      assert.match(pdfResponse.headers.get('content-disposition') ?? '', /^attachment; filename="laporan-absensi-[a-f\d]{8}-2024-02\.pdf"$/i)
      assert.equal(pdfResponse.headers.get('cache-control'), 'no-store')
      assert.equal(pdfResponse.headers.get('x-content-type-options'), 'nosniff')
      const pdf = Buffer.from(await pdfResponse.arrayBuffer())
      assert.ok(pdf.length > 100)
      assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')

      const emptyLayoutResponse = await getLayout(fixture!.emptySemesterId, 'mode=semester')
      assert.equal(emptyLayoutResponse.status, 200, 'the layout route returns an empty report to preserve the UI message')
      const emptyBundle = await jsonResponse(emptyLayoutResponse) as Record<string, unknown>
      assert.equal((emptyBundle.report as Record<string, unknown>).months instanceof Array, true)
      assert.equal((emptyBundle.plans as Record<string, Record<string, unknown>>).f4!.pages instanceof Array, true)
      const emptyPdf = await getPdf(fixture!.emptySemesterId, 'mode=semester&paper=f4')
      assert.equal(emptyPdf.status, 422, 'PDF download is rejected when the full semester has no students')

      const foreignLayout = await getLayout(foreignSemester.id, 'mode=semester')
      assert.equal(foreignLayout.status, 404)
      const foreignPdf = await getPdf(foreignSemester.id, 'mode=semester&paper=f4')
      assert.equal(foreignPdf.status, 404)
    })

    const [afterReads] = await database<typeof beforeReads>`
      select (select count(*)::int from attendance_records) as attendance_count,
             (select count(*)::int from audit_events) as audit_count,
             (select count(*)::int from semester_archive_snapshots) as archive_count,
             (select count(*)::int from semester_memberships) as membership_count,
             (select count(*)::int from school_calendar_rules) as calendar_rule_count,
             (select count(*)::int from calendar_exceptions) as calendar_exception_count
    `
    assert.deepEqual(afterReads, beforeReads, 'protected GET report requests must not write attendance, archive, membership, calendar or audit data')
    await t.test('REP-D preserves archive logo identity, legacy null, revision conflicts and safe partial failure', async () => {
      const layout = async (id: string) => {
        const response = await fetchLocal(`${baseUrl}/api/reports/${id}/layout?mode=semester`, { headers: { cookie: ownerCookie } })
        assert.equal(response.status, 200)
        return await response.json() as import('../app/types/attendance-report.ts').AttendanceReportLayoutBundle
      }
      const pdf = (id: string, revision?: string) => fetchLocal(`${baseUrl}/api/reports/${id}/pdf?mode=semester&paper=a4${revision ? `&revision=${revision}` : ''}`, { headers: { cookie: ownerCookie } })
      assert.equal((await layout(archiveSemester.id)).report.semester.logo, null, 'legacy archive null does not fall back to active logo')
      const archived = await layout(semester.id)
      assert.equal(archived.report.semester.logo?.assetId, archivedLogoId)
      assert.equal(archived.logoStatus, 'ready')
      const active = await layout(emptySemester.id)
      assert.equal(active.report.semester.logo?.assetId, activeLogoId)
      await addStudentToSemester(database, { semesterId: emptySemester.id, schoolId: school.id, schoolClassId: schoolClass.id, studentId: studentOne.id, startsOn: '2024-07-01' })
      const current = await layout(emptySemester.id)
      assert.equal((await pdf(emptySemester.id, current.revision)).status, 200)
      await setActiveSchoolLogo(database, { schoolId: school.id, assetId: null })
      assert.equal((await pdf(emptySemester.id, current.revision)).status, 409)
      assert.equal((await layout(emptySemester.id)).logoStatus, 'none')
      assert.equal((await layout(semester.id)).report.semester.logo?.assetId, archivedLogoId)
      await setActiveSchoolLogo(database, { schoolId: school.id, assetId: activeLogoId })
      const activePath = path.join(logoRoot, `${activeLogoId}.jpg`)
      await rename(activePath, `${activePath}.held`)
      try {
        const unavailable = await layout(emptySemester.id)
        assert.equal(unavailable.logoStatus, 'unavailable')
        assert.ok(unavailable.report.months.some((month) => month.rows.length))
        const failed = await pdf(emptySemester.id)
        assert.equal(failed.status, 503)
        assert.equal(failed.headers.get('content-disposition'), null)
      } finally { await rename(`${activePath}.held`, activePath) }
      await writeFile(activePath, Buffer.from('tampered synthetic image'))
      assert.equal((await layout(emptySemester.id)).logoStatus, 'unavailable')
      assert.equal((await pdf(emptySemester.id)).status, 503)
      await writeFile(activePath, activeLogoBytes)
      assert.equal((await layout(emptySemester.id)).logoStatus, 'ready')
      assert.equal((await pdf(emptySemester.id)).status, 200)
    })
  } finally {
    if (server) await stopOwnedProcess(server)
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
    await database.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
    const resolvedLogoRoot = await realpath(logoRoot)
    if (path.dirname(resolvedLogoRoot).toLowerCase() !== (await realpath(testRoot)).toLowerCase() || !/^reports-logo-[A-Za-z0-9]+$/.test(path.basename(resolvedLogoRoot))) throw new Error('Unexpected report logo test root.')
    await rm(resolvedLogoRoot, { recursive: true })
  }
})
