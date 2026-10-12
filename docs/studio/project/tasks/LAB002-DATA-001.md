# TASK LAB002-DATA-001 — PostgreSQL lokal, schema dan invariant

Status: CLOSED
Active owner: PM untuk taskberikut
Tanggal: 2026-10-12
Tahap: implementasi lokal
Root app: D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app
Acuan: PRD, SET-001 CLOSED, local-delivery-contract-v1.md, AGENTS/protokol/workflow/keputusan/delegasi lokal. Platform gpt-6-luna/max dipilih Ardy berlaku tugas lokal.

Objective: persistence PostgreSQL lokal yang benar, schema/invariants dan repositories/data test sebelum UI bisnis. Ownership Executor app/server database/domain only, app/db SQL, app/scripts local-db/migrate/test-data, package/lock/config env docs/evidence data terkait, reports/LAB002-DATA-001-report.md. Jangan ubah halaman UI atau PM registry/PRD/task. PM edits source docs; jangan revert orang lain.

Scope: inspect runtime/binaries; isolated PG16 cluster under .data port55432 loopback SCRAM password random ignored, never existing service/global config/cloud. start/stop/status reusable commands, env ignored local no secrets in output; non-production guard deny remote db for test/reset. Pin postgres.js runtime + TS test runner jika diperlukan setelah source resmi kompatibilitas; npm lockfile. SQL versioned migration up/down and runner transaction/advisory protection, empty DB bootstrap and existing no destructive reset implicit. Tables teacher auth placeholders (no real auth yet), school/class, semester, student, membership snapshot with dates, calendar routine/exceptions, effective attendance/status/version, audit, sessions placeholder if needed only contract AUTH later. PostgreSQL FKs/uniqueness/status/date validation and closed-semester write guards (server/database layers chosen documented). Preserve audit, no blanket cascade history loss. Implement typed data/service APIs supporting creation and checks—not public HTTP business routes. transaction corrections/calendar exclusion/restore blank/closure/semestercopy rules need test coverage or mapped repository methods for downstream tasks. Only schema/contracts/repo behavior, no business frontend or login.

AC01: binary path/version/port/loopback/auth/ignored secret actual documented; cluster own path checked, existing service unchanged; restart persists fictitious rows.
AC02: migrations up/down/up test isolated throwaway DB/schema own data only, constraints name-same optionalNIPD, unique student/date, enum/date/FK and single active/no overlap tested; migration ledger handles rerun safely.
AC03: data-domain tests effective attendance/calendar exclusions/membership inclusive/identity snapshot/immutable closed semester/audit transaction rollback, code does not expose empty asA; evidence expected+observed and gaps honestly.
AC04: private connection server-only, no secret tracked/public/log; test command refuses remote/prod targets; runtime no SQL request until actual allowed.
AC05: clean install if dependency changes, typecheck, Vercel and node builds pass; direct local DB smoke, no deploy/cloud; docs env/start/migrate/test/stop examples safe reproducible.
AC06: report actual files/versions/checks/AC/risk/ProductionNONE/nextPM; no self closure/commit. PM can commit per user approval.

Stop: cannot run isolated binaries/nonlocal required/data destructive/existing files conflict; report PM promptly. Do not install global/docker or touch PG18. Current binaries PG16 installed, service16 stopped/service18running observed PM; no credentials or DB inspected. Verification Executor technical DB/build tests; PM independent reruns/inspect/local browser later. Source/output no existing data students. Not READY for cloud or auth/UI; return report PM for validation. All AC pending.

Dispatch aktual collaboration.spawn_agent worker fork none, gpt-6-luna/max; handle /root/lab002_data001. Sumber izin delegasi 12 Oktober dan “oke lanjutkan pengerjaan dari sekarang”.

PM accepted underdelegation12Oktober; independentrerun6/6/typecheck/build/status dan R1 resolved. CLOSED; reviewreport tersedia.
