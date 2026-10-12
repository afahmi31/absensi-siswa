import assert from 'node:assert/strict'
import { test } from 'node:test'
import postgres from 'postgres'
import { runMigrations } from '../server/database/migrate.mjs'
import { addDays, createSchoolFixture, recordAttendance as recordFixtureAttendance } from './fixtures/school-fixture.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'
import { correctAttendance, listEffectiveAttendance, recordAttendance } from '../server/database/repositories/attendance.ts'
import { setCalendarException, setCalendarHoliday, setRoutineSchoolDay } from '../server/database/repositories/calendar.ts'
import { closeSemester, copyRosterFromPreviousSemester, createSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, endStudentMembership, createStudent, updateStudentIdentity } from '../server/database/repositories/students.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { listMigrationNames } from './support/migration-names.mjs'

async function expectSqlState(operation: PromiseLike<unknown>, code: string, message: string): Promise<void> {
  await assert.rejects(operation, (error: { code?: string }) => error.code === code, message)
}

async function prepareExplicitAllOffCalendar(database: postgres.Sql, fixture: Awaited<ReturnType<typeof createSchoolFixture>>): Promise<void> {
  for (let weekday = 0; weekday < 7; weekday += 1) {
    await setRoutineSchoolDay(database, {
      schoolId: fixture.schoolId,
      dayOfWeek: weekday,
      effectiveFrom: addDays(fixture.semesterStart, -1),
      isSchoolDay: false,
    })
  }
}

async function raceClosureWithWrite(
  database: postgres.Sql,
  fixture: Awaited<ReturnType<typeof createSchoolFixture>>,
  write: () => Promise<unknown>,
): Promise<{ closed: boolean; writeSucceeded: boolean }> {
  const preview = await getSemesterClosurePreview(database, {
    semesterId: fixture.semesterId,
    teacherId: fixture.teacherId,
  })
  assert.ok(preview)
  assert.equal(preview.calendarConfigured, true)
  const [closureResult, writeResult] = await Promise.allSettled([
    withAuditActor(database, fixture.teacherId, (transaction) => closeSemester(transaction, {
      semesterId: fixture.semesterId,
      teacherId: fixture.teacherId,
      previewToken: preview.previewToken,
      confirmed: true,
    })),
    write(),
  ])
  const closed = closureResult.status === 'fulfilled'
  const writeSucceeded = writeResult.status === 'fulfilled'
  assert.notEqual(closed, writeSucceeded, 'Closure and a concurrent semester write must serialize; both cannot succeed.')
  if (!closed) {
    assert.equal((closureResult.reason as { statusCode?: number }).statusCode, 409, 'Changed preview must block closure until reviewed again.')
  } else {
    assert.equal((writeResult.reason as { code?: string }).code, '55000', 'A write that loses to closure must be rejected by the closed-semester guard.')
  }
  const [current] = await database`select status from semesters where id = ${fixture.semesterId}`
  assert.equal(current.status, closed ? 'closed' : 'active')
  const [snapshotCount] = await database`
    select count(*)::int as count from semester_archive_snapshots where semester_id = ${fixture.semesterId}
  `
  assert.equal(snapshotCount.count, closed ? 1 : 0)
  return { closed, writeSucceeded }
}

test('local PostgreSQL schema preserves school, roster, attendance, calendar, and audit invariants', async (t) => {
  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const app = postgres(temporary.runtimeUrl, { max: 4, connect_timeout: 5 })

  try {
    await t.test('migration runs up, down, and up again with a stable ledger', async () => {
      const expectedNames = await listMigrationNames()
      const firstUp = await runMigrations(migrator, 'up')
      assert.deepEqual(firstUp.map((migration) => migration.name), expectedNames)
      assert.deepEqual(firstUp.map((migration) => migration.applied), expectedNames.map(() => true))
      const secondUp = await runMigrations(migrator, 'up')
      assert.deepEqual(secondUp.map((migration) => migration.name), expectedNames)
      assert.deepEqual(secondUp.map((migration) => migration.applied), expectedNames.map(() => false))
      const down = await runMigrations(migrator, 'down')
      assert.deepEqual(down.map((migration) => migration.name), [...expectedNames].reverse())
      assert.deepEqual(down.map((migration) => migration.applied), expectedNames.map(() => true))
      const finalUp = await runMigrations(migrator, 'up')
      assert.deepEqual(finalUp.map((migration) => migration.name), expectedNames)
      assert.deepEqual(finalUp.map((migration) => migration.applied), expectedNames.map(() => true))
      const ledger = await migrator`select name from public.schema_migrations order by name`
      assert.deepEqual(ledger.map((migration) => migration.name), expectedNames)
    })

    await t.test('duplicate names and blank student numbers stay separate; attendance has inclusive dates and one effective record', async () => {
      const fixture = await createSchoolFixture(app)
      await expectSqlState(
        createSemester(app, {
          schoolId: fixture.schoolId,
          academicYear: '2026/2027',
          term: 'genap',
          startsOn: fixture.today,
          endsOn: addDays(fixture.today, 2),
        }),
        '23P01',
        'A school may not have overlapping semester periods.',
      )
      await expectSqlState(
        createSemester(app, {
          schoolId: fixture.schoolId,
          academicYear: '2027/2028',
          term: 'ganjil',
          startsOn: addDays(fixture.semesterEnd, 1),
          endsOn: addDays(fixture.semesterEnd, 90),
        }),
        '23505',
        'A school may have only one active semester.',
      )
      const [sameNames] = await app`
        select count(*)::int as count from students where full_name = 'Siswa Contoh' and student_number is null
      `
      assert.equal(sameNames.count, 2)
      assert.notEqual(fixture.studentOneId, fixture.studentTwoId)
      assert.notEqual(fixture.membershipOneId, fixture.membershipTwoId)

      const ruleDate = addDays(fixture.today, -2)
      const ruleWeekday = new Date(`${ruleDate}T00:00:00Z`).getUTCDay()
      await setRoutineSchoolDay(app, {
        schoolId: fixture.schoolId,
        dayOfWeek: ruleWeekday,
        effectiveFrom: ruleDate,
        isSchoolDay: true,
      })

      await recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, fixture.membershipStart)
      await recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, fixture.membershipEnd)
      await recordFixtureAttendance(app, fixture.membershipTwoId, fixture.semesterId, fixture.membershipStart)
      await expectSqlState(
        endStudentMembership(app, fixture.membershipOneId, addDays(fixture.membershipEnd, -1)),
        '55000',
        'Membership end dates cannot exclude existing attendance history.',
      )
      await expectSqlState(
        recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, fixture.membershipStart),
        '23505',
        'A membership may have only one effective attendance record for a date.',
      )
      await expectSqlState(
        recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, addDays(fixture.membershipStart, -1)),
        '23514',
        'Attendance before membership must be rejected.',
      )
      await expectSqlState(
        recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, addDays(fixture.semesterStart, -1)),
        '23514',
        'Attendance outside the semester must be rejected.',
      )
      await expectSqlState(
        recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, addDays(fixture.today, 1)),
        '23514',
        'Attendance for a future school-local date must be rejected.',
      )

      const [snapshots] = await app`
        select count(*)::int as count
        from semester_memberships
        where semester_id = ${fixture.semesterId}
          and name_snapshot = 'Siswa Contoh'
          and student_number_snapshot is null
      `
      assert.equal(snapshots.count, 2)
      await updateStudentIdentity(app, fixture.studentOneId, {
        fullName: 'Nama Baru',
        studentNumber: null,
        gender: 'P',
      })
      const [snapshot] = await app`select name_snapshot from semester_memberships where id = ${fixture.membershipOneId}`
      assert.equal(snapshot.name_snapshot, 'Nama Baru')

      const [effective] = await app`
        select count(*)::int as count from effective_attendance where semester_id = ${fixture.semesterId}
      `
      assert.equal(effective.count, 3)
      await assert.rejects(migrator.begin(async (transaction) => {
        await transaction`alter table semester_memberships disable trigger semester_memberships_guard_write`
        await transaction`
          update semester_memberships set ends_on = ${fixture.membershipStart}
          where id = ${fixture.membershipOneId}
        `
        const [bounded] = await transaction`
          select count(*)::int as count from effective_attendance where semester_id = ${fixture.semesterId}
        `
        assert.equal(bounded.count, 2, 'The effective view must exclude attendance outside a membership date range.')
        throw new Error('rollback the deliberately inconsistent fixture row')
      }), /deliberately inconsistent fixture row/)
    })

    await t.test('past rules can initialize dates without history; confirmed holidays exclude without deleting history or restoring it', async () => {
      const fixture = await createSchoolFixture(app)
      const ruleDate = addDays(fixture.today, -2)
      const weekday = new Date(`${ruleDate}T00:00:00Z`).getUTCDay()
      await setRoutineSchoolDay(app, {
        schoolId: fixture.schoolId,
        dayOfWeek: weekday,
        effectiveFrom: ruleDate,
        isSchoolDay: true,
      })
      const exception = await setCalendarException(app, {
        schoolId: fixture.schoolId,
        date: ruleDate,
        kind: 'school_day',
        note: 'Fixture sintetis',
      })
      const attendanceId = await recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, ruleDate)
      const otherAttendanceId = await recordFixtureAttendance(app, fixture.membershipTwoId, fixture.semesterId, ruleDate)

      await fixtureHolidayWithoutConfirmation(fixture, ruleDate, app)
      const [correction] = await app`select status,version from effective_attendance where id = ${attendanceId}`
      assert.equal(correction.status, 'H')
      const corrected = await correctAttendance(app, {
        attendanceId,
        expectedVersion: 1,
        status: 'S',
      })
      assert.equal(corrected.version, 2)
      await assert.rejects(correctAttendance(app, {
        attendanceId,
        expectedVersion: 1,
        status: 'I',
      }), /changed or is no longer effective/)

      await expectSqlState(app.begin(async (transaction) => {
        await transaction`select set_config('app.calendar_change_confirmed', 'on', true)`
        await transaction`
          update attendance_records
          set version = version + 1,
              is_effective = false,
              exclusion_reason = 'calendar_holiday',
              excluded_at = clock_timestamp(),
              excluded_by_calendar_exception_id = ${exception.id}
          where id = ${attendanceId}
        `
      }), '55000', 'An attendance row cannot be excluded by a school-day exception.')

      await migrator.unsafe(`
        create function public.fail_data_test_attendance_update()
        returns trigger language plpgsql as $$
        begin
          raise exception 'synthetic attendance failure' using errcode = 'P0001';
        end
        $$;
        create trigger zz_data_test_fail_attendance_update
          before update on public.attendance_records
          for each row execute function public.fail_data_test_attendance_update();
      `).simple()
      try {
        await expectSqlState(setCalendarHoliday(app, {
          schoolId: fixture.schoolId,
          date: ruleDate,
          confirmedAttendanceImpact: true,
        }), 'P0001', 'A failed attendance exclusion must roll back the holiday update too.')
      } finally {
        await migrator.unsafe(`
          drop trigger if exists zz_data_test_fail_attendance_update on public.attendance_records;
          drop function if exists public.fail_data_test_attendance_update();
        `).simple()
      }
      const [rolledBackException] = await app`
        select kind from calendar_exceptions where id = ${exception.id}
      `
      const [rolledBackAttendance] = await app`
        select count(*)::int as count from effective_attendance
        where id in (${attendanceId}, ${otherAttendanceId})
      `
      const [rolledBackAudit] = await app`
        select count(*)::int as count from audit_events
        where entity_type = 'calendar_exceptions' and entity_id = ${exception.id} and event_type = 'update'
      `
      assert.equal(rolledBackException.kind, 'school_day')
      assert.equal(rolledBackAttendance.count, 2)
      assert.equal(rolledBackAudit.count, 0)

      const holidayChange = await withAuditActor(app, fixture.teacherId, (transaction) =>
        setCalendarHoliday(transaction, {
          schoolId: fixture.schoolId,
          date: ruleDate,
          confirmedAttendanceImpact: true,
        }))
      const holiday = holidayChange.exception
      assert.equal(holiday.id, exception.id)
      assert.deepEqual(
        holidayChange.excludedAttendance.map((record) => record.id).sort(),
        [attendanceId, otherAttendanceId].sort(),
      )
      const excludedRecord = holidayChange.excludedAttendance.find((record) => record.id === attendanceId)
      assert.ok(excludedRecord)
      assert.equal(excludedRecord.is_effective, false)

      const [excluded] = await app`select is_effective, version from attendance_records where id = ${attendanceId}`
      assert.equal(excluded.is_effective, false)
      assert.equal(excluded.version, 3)
      const [otherExcluded] = await app`select is_effective, version from attendance_records where id = ${otherAttendanceId}`
      assert.equal(otherExcluded.is_effective, false)
      assert.equal(otherExcluded.version, 2)
      const [actorEvents] = await app`
        select count(*)::int as count from audit_events
        where actor_teacher_id = ${fixture.teacherId}
          and event_type = 'update'
          and ((entity_type = 'calendar_exceptions' and entity_id = ${holiday.id})
            or (entity_type = 'attendance_records' and entity_id in (${attendanceId}, ${otherAttendanceId})))
      `
      assert.equal(actorEvents.count, 3, 'The nested holiday transaction must retain the authenticated teacher actor.')
      const [hidden] = await app`select count(*)::int as count from effective_attendance where id = ${attendanceId}`
      assert.equal(hidden.count, 0)

      await setCalendarException(app, {
        schoolId: fixture.schoolId,
        date: ruleDate,
        kind: 'school_day',
        confirmedAttendanceImpact: true,
      })
      const [stillExcluded] = await app`select is_effective from attendance_records where id = ${attendanceId}`
      assert.equal(stillExcluded.is_effective, false)
      const replacement = await recordAttendance(app, {
        membershipId: fixture.membershipOneId,
        semesterId: fixture.semesterId,
        date: ruleDate,
        status: 'H',
      })
      assert.notEqual(replacement.id, attendanceId)
      const [history] = await app`
        select count(*)::int as count from attendance_records
        where membership_id = ${fixture.membershipOneId} and attendance_date = ${ruleDate}
      `
      const [effective] = await app`
        select count(*)::int as count from effective_attendance
        where membership_id = ${fixture.membershipOneId} and attendance_date = ${ruleDate}
      `
      assert.equal(history.count, 2)
      assert.equal(effective.count, 1)
      const effectiveRecords = await listEffectiveAttendance(app, {
        semesterId: fixture.semesterId,
        from: fixture.semesterStart,
        through: fixture.semesterEnd,
      })
      assert.equal(effectiveRecords.length, 1)
      assert.equal(effectiveRecords[0].id, replacement.id)
    })

    await t.test('identity snapshots update only in the active semester; closure and roster copy preserve history', async () => {
      const fixture = await createSchoolFixture(app, { firstMembershipEnd: null })
      for (let weekday = 0; weekday < 7; weekday += 1) {
        await setRoutineSchoolDay(app, {
          schoolId: fixture.schoolId,
          dayOfWeek: weekday,
          effectiveFrom: addDays(fixture.semesterStart, -1),
          isSchoolDay: false,
        })
      }
      const ruleDate = addDays(fixture.today, -2)
      const weekday = new Date(`${ruleDate}T00:00:00Z`).getUTCDay()
      await setRoutineSchoolDay(app, {
        schoolId: fixture.schoolId,
        dayOfWeek: weekday,
        effectiveFrom: ruleDate,
        isSchoolDay: true,
      })
      await setCalendarException(app, {
        schoolId: fixture.schoolId,
        date: ruleDate,
        kind: 'school_day',
        note: 'Fixture sintetis',
      })
      const priorAttendance = await recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, ruleDate)

      await updateStudentIdentity(app, fixture.studentOneId, {
        fullName: 'Siswa Nama Baru',
        studentNumber: 'NIPD-TEST-001',
        gender: 'L',
      })
      const [activeSnapshot] = await app`
        select name_snapshot, student_number_snapshot, gender_snapshot
        from semester_memberships where id = ${fixture.membershipOneId}
      `
      assert.deepEqual(activeSnapshot, {
        name_snapshot: 'Siswa Nama Baru',
        student_number_snapshot: 'NIPD-TEST-001',
        gender_snapshot: 'L',
      })

      const preview = await getSemesterClosurePreview(app, {
        semesterId: fixture.semesterId,
        teacherId: fixture.teacherId,
      })
      assert.ok(preview)
      assert.equal(preview.calendarConfigured, true)
      assert.ok((preview.incompleteSchoolDayCount ?? 0) > 0, 'Incomplete school days remain visible before manual closure.')
      const closed = await withAuditActor(app, fixture.teacherId, (transaction) => closeSemester(transaction, {
        semesterId: fixture.semesterId,
        teacherId: fixture.teacherId,
        previewToken: preview.previewToken,
        confirmed: true,
      }))
      assert.equal(closed.semester.status, 'closed')
      const [archiveDetails] = await app`
        select school_name, class_name, academic_year, term, starts_on::text as starts_on, ends_on::text as ends_on
        from semester_archive_snapshots where semester_id = ${fixture.semesterId}
      `
      assert.deepEqual(archiveDetails, {
        school_name: 'Sekolah Contoh',
        class_name: 'Kelas Uji',
        academic_year: '2026/2027',
        term: 'ganjil',
        starts_on: fixture.semesterStart,
        ends_on: fixture.semesterEnd,
      })
      await expectSqlState(
        app`update semesters set status = 'active' where id = ${fixture.semesterId}`,
        '55000',
        'A closed semester cannot be reopened.',
      )
      await expectSqlState(
        endStudentMembership(app, fixture.membershipOneId, fixture.today),
        '55000',
        'Closed membership snapshots must be immutable.',
      )
      await expectSqlState(
        updateStudentIdentity(app, fixture.studentOneId, {
          fullName: 'Perubahan Arsip Ditolak',
          studentNumber: 'NIPD-TEST-001',
          gender: 'L',
        }),
        '55000',
        'Identity cannot be changed when there is no active semester membership.',
      )
      const [closedSnapshot] = await app`
        select name_snapshot, student_number_snapshot, gender_snapshot
        from semester_memberships where id = ${fixture.membershipOneId}
      `
      assert.deepEqual(closedSnapshot, activeSnapshot)

      const closedNoAttendanceDate = addDays(fixture.semesterStart, 1)
      const closedWeekday = new Date(`${closedNoAttendanceDate}T00:00:00Z`).getUTCDay()
      await expectSqlState(
        setRoutineSchoolDay(app, {
          schoolId: fixture.schoolId,
          dayOfWeek: closedWeekday,
          effectiveFrom: closedNoAttendanceDate,
          isSchoolDay: false,
        }),
        '55000',
        'A routine change cannot rewrite a closed-semester date, even without attendance.',
      )
      await expectSqlState(
        setCalendarException(app, {
          schoolId: fixture.schoolId,
          date: ruleDate,
          kind: 'school_day',
          note: 'Catatan arsip yang harus ditolak',
        }),
        '55000',
        'Any calendar edit inside a closed semester must be rejected, including note edits.',
      )
      await expectSqlState(
        setCalendarException(app, {
          schoolId: fixture.schoolId,
          date: closedNoAttendanceDate,
          kind: 'holiday',
          confirmedAttendanceImpact: true,
        }),
        '55000',
        'A calendar exception cannot be added inside a closed semester.',
      )
      await expectSqlState(
        setCalendarException(app, {
          schoolId: fixture.schoolId,
          date: ruleDate,
          kind: 'holiday',
          confirmedAttendanceImpact: true,
        }),
        '55000',
        'Confirmation cannot rewrite a calendar date in a closed semester.',
      )
      await expectSqlState(
        recordFixtureAttendance(app, fixture.membershipOneId, fixture.semesterId, ruleDate),
        '55000',
        'Attendance cannot be changed after the semester closes.',
      )

      const target = await createSemester(app, {
        schoolId: fixture.schoolId,
        academicYear: '2027/2028',
        term: 'ganjil',
        startsOn: addDays(fixture.semesterEnd, 1),
        endsOn: addDays(fixture.semesterEnd, 120),
      })
      const copied = await copyRosterFromPreviousSemester(app, {
        previousSemesterId: fixture.semesterId,
        targetSemesterId: target.id,
      })
      assert.equal(copied.length, 1)
      assert.equal(copied[0].student_id, fixture.studentOneId)
      assert.equal(copied[0].name_snapshot, 'Siswa Nama Baru')
      const [targetAttendance] = await app`
        select count(*)::int as count from attendance_records where semester_id = ${target.id}
      `
      const [targetEffective] = await app`
        select count(*)::int as count from effective_attendance where semester_id = ${target.id}
      `
      assert.equal(targetAttendance.count, 0)
      assert.equal(targetEffective.count, 0)
      const [sourceHistory] = await app`
        select count(*)::int as count from attendance_records
        where semester_id = ${fixture.semesterId} and id = ${priorAttendance}
      `
      assert.equal(sourceHistory.count, 1)
    })

    await t.test('audit records identify the actor, are immutable, redact auth secrets, and roll back with data', async () => {
      const fixture = await createSchoolFixture(app)
      const actorCreatedStudent = await withAuditActor(app, fixture.teacherId, (transaction) =>
        createStudent(transaction, { fullName: 'Siswa Audit Sintetis' }))
      const [actorEvent] = await app`
        select actor_teacher_id, actor_kind, occurred_at
        from audit_events
        where entity_type = 'students' and entity_id = ${actorCreatedStudent.id} and event_type = 'insert'
      `
      assert.equal(actorEvent.actor_teacher_id, fixture.teacherId)
      assert.equal(actorEvent.actor_kind, 'teacher')
      assert.ok(actorEvent.occurred_at instanceof Date)

      await migrator.unsafe(`
        create table public.audit_secret_probe (
          id uuid primary key default gen_random_uuid(),
          email text not null,
          password text,
          password_hash text,
          password_salt text,
          session_secret text,
          session_token text,
          reset_password_token text,
          api_key text,
          session_version integer not null default 1
        );
        create trigger audit_secret_probe_audit
          after insert or update or delete on public.audit_secret_probe
          for each row execute function public.append_row_audit_event();
      `).simple()
      const dummyPasswordHash = 'synthetic-password-hash-value'
      const dummySessionSecret = 'synthetic-session-secret-value'
      const [probe] = await app`
        insert into audit_secret_probe (
          email, password, password_hash, password_salt, session_secret,
          session_token, reset_password_token, api_key
        ) values (
          'audit-probe@example.invalid', 'synthetic-password', ${dummyPasswordHash},
          'synthetic-password-salt', ${dummySessionSecret}, 'synthetic-session-token',
          'synthetic-reset-token', 'synthetic-api-key'
        ) returning id
      `
      await app`
        update audit_secret_probe
        set password_hash = 'synthetic-password-hash-updated', session_secret = 'synthetic-session-secret-updated'
        where id = ${probe.id}
      `
      const [probeUpdate] = await app`
        select old_value, new_value from audit_events
        where entity_type = 'audit_secret_probe' and entity_id = ${probe.id} and event_type = 'update'
      `
      const secretField = /(session|password|passwd|secret|token|credential|api.?key|authenticator|otp|totp|recovery)/i
      assert.ok(Object.keys(probeUpdate.old_value).every((key) => key === 'session_version' || !secretField.test(key)), 'Audit old values must redact auth secrets.')
      assert.ok(Object.keys(probeUpdate.new_value).every((key) => key === 'session_version' || !secretField.test(key)), 'Audit new values must redact auth secrets.')
      assert.equal(probeUpdate.new_value.email, 'audit-probe@example.invalid')

      await expectSqlState(
        migrator`update audit_events set event_type = 'delete' where entity_type = 'audit_secret_probe' and entity_id = ${probe.id}`,
        '55000',
        'Audit events must reject updates.',
      )
      await expectSqlState(
        migrator`delete from audit_events where entity_type = 'audit_secret_probe' and entity_id = ${probe.id}`,
        '55000',
        'Audit events must reject deletion.',
      )
      await expectSqlState(
        app`insert into audit_events (actor_kind, entity_type, entity_id, event_type) values ('system', 'manual', ${probe.id}, 'insert')`,
        '42501',
        'The runtime role must not insert audit events directly.',
      )

      let rolledBackStudentId: string | undefined
      await assert.rejects(app.begin(async (transaction) => {
        const [student] = await transaction`
          insert into students (full_name) values ('Siswa Rollback Sintetis') returning id
        `
        rolledBackStudentId = student.id
        throw new Error('expected rollback from test')
      }))
      const [rollbackRows] = await app`
        select count(*)::int as count from students where id = ${rolledBackStudentId}
      `
      const [rollbackEvents] = await app`
        select count(*)::int as count from audit_events where entity_type = 'students' and entity_id = ${rolledBackStudentId}
      `
      assert.equal(rollbackRows.count, 0)
      assert.equal(rollbackEvents.count, 0)
    })

    await t.test('unset calendar differs from seven explicitly off days and a complete semester still requires closure confirmation', async () => {
      const fixture = await createSchoolFixture(app)
      const unsetPreview = await getSemesterClosurePreview(app, {
        semesterId: fixture.semesterId,
        teacherId: fixture.teacherId,
      })
      assert.ok(unsetPreview)
      assert.equal(unsetPreview.calendarConfigured, false)
      assert.equal(unsetPreview.schoolDayCount, null)
      assert.equal(unsetPreview.blankCellCount, null)

      await prepareExplicitAllOffCalendar(app, fixture)
      for (const date of [fixture.membershipStart, fixture.membershipEnd, addDays(fixture.today, 1)]) {
        await setCalendarException(app, { schoolId: fixture.schoolId, date, kind: 'holiday' })
      }
      const allOffPreview = await getSemesterClosurePreview(app, {
        semesterId: fixture.semesterId,
        teacherId: fixture.teacherId,
      })
      assert.ok(allOffPreview)
      assert.equal(allOffPreview.calendarConfigured, true)
      assert.equal(allOffPreview.schoolDayCount, 0)
      assert.equal(allOffPreview.eligibleCellCount, 0)
      assert.equal(allOffPreview.blankCellCount, 0)
      assert.equal(allOffPreview.incompleteSchoolDayCount, 0)
      await assert.rejects(
        closeSemester(app, {
          semesterId: fixture.semesterId,
          teacherId: fixture.teacherId,
          previewToken: allOffPreview.previewToken,
          confirmed: false,
        }),
        (error: { statusCode?: number }) => error.statusCode === 422,
        'A complete preview must not skip explicit teacher confirmation.',
      )
      const closed = await withAuditActor(app, fixture.teacherId, (transaction) => closeSemester(transaction, {
        semesterId: fixture.semesterId,
        teacherId: fixture.teacherId,
        previewToken: allOffPreview.previewToken,
        confirmed: true,
      }))
      assert.equal(closed.semester.status, 'closed')
    })

    await t.test('semester closure serializes against attendance, new students, and calendar changes', async (t) => {
      await t.test('attendance is included in a fresh preview or rejected after closure', async () => {
        const fixture = await createSchoolFixture(app)
        await prepareExplicitAllOffCalendar(app, fixture)
        const race = await raceClosureWithWrite(app, fixture, () => withAuditActor(app, fixture.teacherId, (transaction) =>
          recordAttendance(transaction, {
            membershipId: fixture.membershipOneId,
            semesterId: fixture.semesterId,
            date: fixture.membershipStart,
            status: 'H',
          })))
        const [attendance] = await app`
          select count(*)::int as count from attendance_records where semester_id = ${fixture.semesterId}
        `
        assert.equal(attendance.count, race.writeSucceeded ? 1 : 0)
        if (race.writeSucceeded) {
          const preview = await getSemesterClosurePreview(app, { semesterId: fixture.semesterId, teacherId: fixture.teacherId })
          assert.ok(preview)
          assert.equal(preview.filledCellCount, 1)
          assert.ok((preview.blankCellCount ?? 0) > 0)
        }
      })

      await t.test('new memberships are included before closure or rejected from the closed semester', async () => {
        const fixture = await createSchoolFixture(app)
        await prepareExplicitAllOffCalendar(app, fixture)
        const student = await createStudent(app, { fullName: 'Uji Balapan Siswa Baru' })
        const race = await raceClosureWithWrite(app, fixture, () => withAuditActor(app, fixture.teacherId, (transaction) =>
          addStudentToSemester(transaction, {
            semesterId: fixture.semesterId,
            schoolId: fixture.schoolId,
            schoolClassId: fixture.classId,
            studentId: student.id,
            startsOn: fixture.today,
          })))
        const [membership] = await app`
          select count(*)::int as count from semester_memberships
          where semester_id = ${fixture.semesterId} and student_id = ${student.id}
        `
        assert.equal(membership.count, race.writeSucceeded ? 1 : 0)
      })

      await t.test('calendar changes update the preview or are rejected after closure', async () => {
        const fixture = await createSchoolFixture(app)
        await prepareExplicitAllOffCalendar(app, fixture)
        const changedDate = addDays(fixture.today, -2)
        const race = await raceClosureWithWrite(app, fixture, () => withAuditActor(app, fixture.teacherId, (transaction) =>
          setCalendarException(transaction, {
            schoolId: fixture.schoolId,
            date: changedDate,
            kind: 'school_day',
            note: 'Perubahan kalender saat uji balapan',
          })))
        const [exception] = await app`
          select kind from calendar_exceptions
          where school_id = ${fixture.schoolId} and exception_date = ${changedDate}
        `
        assert.equal(Boolean(exception), race.writeSucceeded)
        if (race.writeSucceeded) assert.equal(exception.kind, 'school_day')
      })
    })
  } finally {
    await Promise.all([app.end({ timeout: 3 }), migrator.end({ timeout: 3 })])
    await temporary.cleanup()
  }
})

async function fixtureHolidayWithoutConfirmation(
  fixture: Awaited<ReturnType<typeof createSchoolFixture>>,
  date: string,
  database: postgres.Sql,
): Promise<string> {
  await expectSqlState(
    setCalendarException(database, {
      schoolId: fixture.schoolId,
      date,
      kind: 'holiday',
    }),
    '55000',
    'Changing a day with attendance requires an explicit confirmation.',
  )
  const [existing] = await database`
    select id from calendar_exceptions where school_id = ${fixture.schoolId} and exception_date = ${date}
  `
  assert.ok(existing?.id, 'The test date must already have a school-day exception.')
  return existing.id
}
