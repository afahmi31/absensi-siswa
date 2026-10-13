# IMPLEMENTATION REPORT

Task: LAB002-SEC-001 — Penguatan jalur pencarian fungsi database
Status: IMPLEMENTED — menunggu validasi PM
Tanggal: 13 Oktober 2026
Executor: Codex, local implementation only

## Hasil

Migration `0007_application_function_search_path` mengatur `search_path` untuk 19 fungsi aplikasi menjadi `pg_catalog, public, pg_temp`. Migration down menghapus hanya pengaturan `search_path` yang ditambahkan oleh migration ini. `append_row_audit_event()` tetap memakai konfigurasi yang sudah ada.

Migration tidak mengubah body, signature, owner, atau grant fungsi. Tidak ada migration `0001`–`0006` yang diubah. Tidak ada perubahan pada `public.rls_auto_enable()` atau objek platform Supabase.

PostgreSQL mendukung pengaturan dan reset konfigurasi fungsi lewat `ALTER FUNCTION`. Dokumentasi PostgreSQL 17 juga menerangkan bahwa `pg_temp` dicari pertama untuk relasi sementara kecuali disebut eksplisit; meletakkannya terakhir mempertahankan prioritas objek `public`. PostgreSQL tidak mencari schema temporary untuk fungsi atau operator. [ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html), [search_path](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-SEARCH-PATH).

## Fungsi yang dipin

Sebelum migration 0007, 19 fungsi berikut tidak memiliki konfigurasi `search_path` lokal. Sesudah migration, semuanya memiliki `search_path=pg_catalog, public, pg_temp`:

- `school_local_today(uuid)`
- `is_school_day(uuid, date)`
- `lock_school_calendar_date(uuid, date)`
- `lock_school_calendar(uuid)`
- `validate_school_time_zone()`
- `guard_semester_write()`
- `guard_membership_write()`
- `guard_student_identity_write()`
- `sync_active_membership_identity()`
- `guard_calendar_rule_write()`
- `guard_calendar_exception_write()`
- `guard_attendance_write()`
- `guard_audit_event_mutation()`
- `redact_audit_secrets(jsonb)`
- `lock_semester_scope_writes()`
- `guard_semester_period_change()`
- `require_semester_closure_confirmation()`
- `guard_semester_archive_snapshot_write()`
- `capture_semester_archive_snapshot()`

`append_row_audit_event()` tetap memiliki konfigurasi lama yang sama sebelum dan sesudah migration.

## Perubahan

- `app/server/database/migrations/0007_application_function_search_path.up.sql` — set path untuk 19 signature di atas.
- `app/server/database/migrations/0007_application_function_search_path.down.sql` — reset pengaturan path 19 signature tersebut.
- `app/scripts/cloud-data-transfer-core.mjs` — mematok dua ledger source yang diterima dengan checksum tepat: baseline 0001–0004 dan baseline lengkap 0001–0006. Ledger target tetap harus cocok dengan semua migration aplikasi saat ini.
- `app/scripts/test-cloud-data-transfer.mjs` — menambah pemeriksaan inventory, owner/grant/body, up/down/up, tabel temporary yang bertabrakan, penolakan ledger source parsial/tidak dikenal, dan rehearsal source 6→target 7 serta source 4→target 7.
- `app/docs/cloud-data-transfer.md` — memperbarui persyaratan target dan skenario rehearsal ke ledger 0001–0007.
- `app/tests/students.test.ts`, `app/tests/calendar.test.ts`, dan `app/tests/attendance.test.ts` — memisahkan provisioning akun guru sintetis ke koneksi migrasi disposable. Server HTTP serta pembuatan dan query data sekolah tetap menggunakan koneksi runtime `lab002_app`.

## Pemeriksaan

- Rehearsal `scripts/test-cloud-data-transfer.mjs`: **PASS** pada Node 24.19.0 dan PostgreSQL 16 disposable. Source 0001–0006→target 0001–0007 dan source 0001–0004→target 0001–0007 berhasil dengan 11 tabel dan 49 baris sintetis. Restore invalid rollback, ledger parsial/tidak dikenal, guard target kosong, FK, trigger, serta full-row comparison lulus.
- Rehearsal fungsi pada cluster yang sama: **PASS**. Tepat 20 fungsi aplikasi terinventarisasi; 19 mempunyai path baru, sedangkan `append_row_audit_event()` tidak berubah. Down memulihkan metadata hingga identik dengan baseline enam migration; up kembali menerapkan path. Body, owner, ACL, mode security, dan hak `CREATE` runtime/API pada schema `public` tetap sama.
- Konflik tabel temporary: **PASS**. `is_school_day()` membaca pengecualian kalender `public` walau ada baris berbeda pada `pg_temp`. Guard kalender dan absensi menolak perubahan pada semester tertutup meski tersedia tabel temporary yang mencoba menampilkan semester aktif dan tanpa absensi. Probe dibatalkan dengan rollback; digest tabel target tetap sama dengan source sintetis.
- `node --check` untuk `scripts/cloud-data-transfer-core.mjs` dan `scripts/test-cloud-data-transfer.mjs`: **PASS**.
- `git diff --check`: **PASS**.
- Suite HTTP STUD, CAL, dan ATT yang semula berhenti saat setup fixture mencoba menulis `teacher_accounts` melalui `lab002_app` kini **PASS** setelah setup saja dipindahkan ke migrator pada cluster disposable. Grant runtime dan kode produksi tidak diubah. Hasil run terpisah: STUD **8/8**, CAL **5/5**, ATT **7/7**.
- Rangkaian penuh `scripts/test-all.mjs` (script yang dipanggil oleh `npm test`): **PASS**. Database **13/13**, autentikasi **14/14**, STUD **8/8**, CAL **5/5**, ATT **7/7**. Semua memakai PostgreSQL sementara sintetis dengan URL persistent/remote dikosongkan.
- Typecheck/build **tidak dijalankan**; perubahan runtime build tidak termasuk task ini.

## Batas pemeriksaan dan risiko tersisa

- Semua database rehearsal memakai data sintetis pada PostgreSQL 16 lokal disposable. Source database guru nyata tidak dibaca atau diubah.
- Migration 0007 belum diterapkan ke Supabase. Tool transfer hanya diuji terhadap dua cluster sintetis; rehearsal PostgreSQL 17, pemeriksaan cloud, dan import data nyata tetap menunggu review PM serta izin Ardy terpisah.
- HTTP suite memverifikasi jalur aplikasi lokal dengan role runtime. Belum ada smoke test pada deployment Vercel atau database Supabase, dan belum ada uji import data nyata.
- Tidak ada dependency baru, perubahan kredensial, build/runtime swap, commit, push, atau deployment.

## Self-check AC

- [x] 19 signature aplikasi memakai path tetap; `append_row_audit_event()` tidak berubah.
- [x] Body, owner, ACL, dan hak akses runtime/API tidak berubah.
- [x] Down/up mengembalikan konfigurasi fungsi sesuai baseline lalu menerapkan kembali 0007.
- [x] Konflik relation temporary tidak menutupi relasi `public` atau melewati guard kalender/absensi.
- [x] Rehearsal transfer mempertahankan source 0001–0004 dan full 0001–0006 yang dipatok, menolak source partial/unknown, serta meminta target tepat 0001–0007.
- [x] Suite HTTP siswa/kalender/absensi penuh lulus dengan setup akun guru memakai koneksi migrasi disposable; server dan query fitur tetap memakai role runtime least-privilege.

Production actions performed: NONE
Next owner: PM untuk review diff dan validasi hasil; lalu PM menyiapkan keputusan Ardy yang terpisah sebelum migration 0007 dapat diterapkan ke Supabase.
