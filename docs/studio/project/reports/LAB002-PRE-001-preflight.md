# PREFLIGHT REPORT — LAB002-PRE-001

FROM: Executor `/root/online_preflight`
TO: Project Manager
PROJECT: LAB-002 / Website Absensi Siswa
TASK: LAB002-PRE-001
STATUS: PREFLIGHT COMPLETE; implementasi lokal selesai dan menunggu tinjauan PM. Belum ada penulisan cloud, transfer data, deploy, atau release.
Tanggal: 13 Oktober 2026. Assignment: Codex gpt-6-luna / max, sesuai payload task.

Catatan: bagian awal dokumen ini merekam preflight sebelum implementasi disetujui. Keputusan implementasi sesudah review PM dan bukti akhirnya dicatat pada addendum di bagian akhir.

## Repository dan batas pemeriksaan

- Root app: `Labs/LAB-002-website-absensi-siswa/app`.
- Branch `main`, commit `2ac5cdb`; working tree bersih pada pemeriksaan ini. Remote app terpasang ke `afahmi31/absensi-siswa`.
- Stack: Nuxt 4.6.1, Nitro Vercel `nodejs24.x`, PostgreSQL, `postgres` 3.4.9. Node dan npm dipin melalui `engines`; package manager ditentukan sebagai `npm@10.9.3`.
- Instruksi yang dibaca: `AGENTS.md` workspace; seluruh Protokol PM–Executor v1.0; studio-workflow; workflow-decisions; user-facing-copy; git-and-environments; discovery-and-doc-sync; vibe-coding-from-project-docs; skill `studio-executor-work`; skill Supabase.
- Acuan LAB-002 yang diperiksa: task ini, PRD/rencana/keputusan, README/environment/build-verification app, migrasi database, auth, dan kontrak data lokal. Pencarian instruksi tidak menemukan `AGENTS.md`/`AGENT.md` tambahan di bawah root LAB-002 atau app.
- Pemeriksaan hanya membaca source dan dokumentasi resmi. Tidak menjalankan query cloud, build/test, migrasi, perpindahan data, atau perubahan aplikasi/runtime. Berkas rahasia lokal tidak dibuka; laporan tidak memuat nilai kredensial atau data guru/murid.

## Relevant files

| File | Bukti terkait preflight |
|---|---|
| `app/nuxt.config.ts` | Konfigurasi Nitro `nodejs24.x`; `databaseUrl` dan `session.password` berada pada `runtimeConfig` privat server. |
| `app/package.json`, `app/.npmrc`, `app/package-lock.json` | Node `>=24.15.0 <25`; npm `>=10.9.3 <11`; `packageManager: npm@10.9.3`; `engine-strict=true`; dependency PostgreSQL dipin `postgres@3.4.9`. |
| `app/server/database/client.ts` | Singleton lazy yang server-only; `max: 5`; belum menetapkan `prepare`, TLS/CA, atau verifikasi hostname. |
| `app/server/database/transaction.ts`, `app/server/database/audit-context.ts` | Kode memakai transaksi/savepoint serta `set_config(..., true)` yang harus tetap berada di transaksi yang sama. |
| `app/server/database/migrate.mjs`, `app/server/database/migrations/0001_core.up.sql`–`0004_attendance_manual_clear.up.sql` | Migrator memakai advisory **transaction** lock, ledger/checksum, dan multi-statement SQL; skema punya trigger audit/guard dan beberapa advisory transaction locks. Migrasi 0001 sudah memberi akses luas pada seluruh tabel, sequence, fungsi dan default privilege `lab002_app`; 0002/0003 menambah grant. Jangan mengubah file migrasi lama karena checksum sudah menjadi kontrak migrator lokal. |
| `app/server/database/migrations/0001_core.up.sql` | View `effective_attendance` memakai default view security; `append_row_audit_event()` adalah `SECURITY DEFINER` dengan `search_path = pg_catalog, public, pg_temp`; trigger audit mengisi tabel audit. |
| `app/server/api/auth/login.post.ts`, `app/server/auth/login-throttle.ts` | Batas saat ini 5 kegagalan per jendela 15 menit, blokir 15 menit, disimpan dalam `Map` per proses dan hanya dipakai saat bukan production. Login membaca IP melalui `getRequestIP(..., { xForwardedFor: false })`. |
| `app/scripts/db-migrate.mjs`, `app/scripts/auth-account.mjs` | Tool migrasi dan administrasi akun dikunci untuk PostgreSQL lokal `127.0.0.1:55432`; jangan melonggarkan guard atau memakai script lokal untuk cloud. |

## Temuan dan rekomendasi

### Koneksi PostgreSQL dan transaksi

**Fakta source:** koneksi sekarang menetapkan lima koneksi per instance dan tidak menetapkan `prepare: false` atau TLS. Repositori menjalankan transaksi, savepoint, transaction-local context, dan advisory transaction locks. Tidak ditemukan pemakaian advisory lock berbasis sesi pada pemeriksaan source ini.

**Bukti resmi:** Supabase meminta client serverless dibuat sekali di module scope, pool aplikasi dimulai dari satu koneksi per instance, prepared statements dimatikan untuk transaction pooler, dan SSL diwajibkan. Namun transaction pooler tidak mendukung pipeline. Dokumentasi `postgres.js` Supabase menyebut driver ini melakukan pipeline secara default; tidak ada opsi langsung yang bekerja untuk mematikannya, dan `max_pipeline: 0` merusak `sql.begin()`.

**Rekomendasi paling sedikit mengubah kode:** untuk pilot pertama, gunakan shared **session pooler** yang sudah disiapkan privat PM, dengan role aplikasi terbatas dan `max: 1` per warm Vercel instance. Session mode mendukung fitur sesi/transaksi yang diperlukan, termasuk pipeline/prepared statement, sehingga lebih cocok dengan driver saat ini. Ini belum otomatis siap skala produksi: PM perlu mengonfirmasi batas koneksi paket Supabase dan menguji jumlah koneksi terhadap scale Vercel. Jika wajib memakai transaction pooler, perlakukan penggantian/penyesuaian driver dan uji transaksi sebagai keputusan implementasi terpisah; `prepare: false` saja tidak menyelesaikan pipeline.

**TLS:** AC butuh pemeriksaan sertifikat dan hostname. `ssl: 'require'` hanya memastikan enkripsi, bukan identitas server. Implementasi harus menggunakan sertifikat CA database Supabase dan mode `verify-full` atau konfigurasi TLS setara dengan `rejectUnauthorized: true`; verifikasi perlu membuktikan koneksi dengan CA benar sukses, sedangkan CA/hostname salah gagal. Jangan mematikan verifikasi sertifikat.

Rujukan: [Supabase Postgres.js](https://supabase.com/docs/guides/database/postgres-js), [Supabase koneksi PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase SSL](https://supabase.com/docs/guides/platform/ssl-enforcement), [opsi TLS Postgres.js](https://github.com/porsager/postgres#ssl).

### Hak akses dan API

**Fakta source:** SQL yang ada memakai `public`, nama objek tak berkualifikasi, view `effective_attendance`, audit `SECURITY DEFINER`, serta memberi `lab002_app` hak `SELECT, INSERT, UPDATE` di semua tabel, `USAGE/SELECT` semua sequence, dan `EXECUTE` semua fungsi. Migrasi juga membuat default privilege untuk objek mendatang. Akses `INSERT/UPDATE/DELETE/TRUNCATE` ke audit memang dicabut setelah grant luas.

**Fakta cloud dari PM:** target masih kosong pada pemeriksaan awal; role `lab002_app` dan `lab002_migrator` belum ada. Role `postgres` bukan superuser, tetapi mempunyai `CREATEROLE` dan `BYPASSRLS`. `anon` dan `authenticated` tercatat `NOLOGIN`. Catatan `NOLOGIN` sendiri bukan bukti aman dari Data API karena API dapat memakai role non-login melalui pergantian role.

**Rekomendasi:** pertahankan skema `public` untuk menghindari perubahan massal pada query/migrasi lama, lalu buat migration **forward-only** untuk ACL yang sempit. Nonaktifkan Data API karena app menggunakan PostgreSQL langsung dan tidak memakai Supabase REST/GraphQL/client library. Verifikasi pula privilege objek dan default ACL dari semua role pembuat Supabase; sebelum deploy, cabut grant efektif `PUBLIC`, `anon`, `authenticated`, dan `service_role` pada tabel, sequence, dan fungsi app. Jangan bergantung pada perubahan default platform yang baru akan diberlakukan ke semua project pada 30 Oktober 2026.

Role runtime baru harus server-only, tanpa `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, atau membership yang mewariskan hak admin; role ini tidak boleh memiliki `CREATE` pada schema. Beri hak hanya pada tabel yang dipakai route/repository, sequence yang dibutuhkan, dan objek login/throttle yang nanti dibuat. Jangan berikan app DML ke `audit_events` atau hak ke `schema_migrations`. Role migrasi terpisah saja yang mendapat hak DDL dan credential migrasi; jangan memasukkan URL migrasi ke Vercel runtime. Pertahankan audit function sebagai trigger internal hanya bila rehearsal membuktikan hak owner-nya cukup; cabut `EXECUTE` langsung dari role API/PUBLIC dan pastikan tidak ada role tak tepercaya yang dapat `CREATE` di `public`, karena fungsi memakai `SECURITY DEFINER`.

Pada migration baru, set `effective_attendance` menjadi `security_invoker = true` sebagai defense-in-depth (PG17 mendukungnya) sambil tetap memberi hak SELECT app pada view dan tabel dasar yang diperlukan. Ini tidak mengganti autentikasi aplikasi atau menjadi alasan membuka akses klien. Pastikan semua table/view/function tidak dapat dibaca atau dipanggil melalui Data API oleh role anonim/signed-in.

Rujukan: [Supabase mengamankan Data API](https://supabase.com/docs/guides/api/securing-your-api), [Supabase view](https://supabase.com/docs/guides/database/views), [PostgreSQL view security](https://www.postgresql.org/docs/17/sql-createview.html), [keamanan fungsi PostgreSQL](https://www.postgresql.org/docs/17/perm-functions.html), [Supabase changelog breaking changes](https://supabase.com/changelog?types=breaking-change).

### Migrasi schema dan role cloud

**Penilaian kompatibilitas statis:** SQL saat ini menggunakan tipe dan fitur inti Postgres (UUID, JSONB, identity, trigger, view, constraint, advisory transaction lock); pencarian tidak menemukan `CREATE EXTENSION`. Tidak tampak alasan source yang langsung memblokir PG17, tetapi ini **belum** membuktikan migrasi berhasil pada target. Jalankan migrasi yang sama ke database/snapshot PG17 kosong sebelum cloud write dan periksa checksum/role grants. Jangan mengedit migrasi 0001–0004; perubahan keamanan/perilaku baru harus migration tambahan.

Pertahankan migrator cloud terpisah dan jelas guard-nya. `server/database/migrate.mjs` dapat menjadi basis karena checksum dan lock-nya transaction-scoped, tetapi `scripts/db-migrate.mjs` saat ini memang dibatasi ke local PG16. Jangan menghapus guard lokal untuk membuat koneksi cloud bekerja. Credential migrasi adalah input lokal privat `SUPABASE_MIGRATION_DATABASE_URL` yang dikelola PM; jangan tampilkan atau masukkan ke runtime app. Untuk koneksi migrasi, gunakan direct/session connection yang mempertahankan state transaksi, bukan mengasumsikan transaction pooler sesuai untuk kerja DDL.

Rujukan: [PostgreSQL 17 dump/restore untuk major upgrade](https://www.postgresql.org/docs/17/upgrading.html), [pg_restore data-only, sequence, dan batas `--disable-triggers`](https://www.postgresql.org/docs/17/app-pgrestore.html).

### Perlindungan login lintas instance

Saat ini throttle hanya ada di memori proses dan sengaja tidak aktif di production. Jadi batas online lintas Vercel instance belum ada.

Opsi tanpa layanan/dependency baru: simpan counter sementara pada tabel server-only, lakukan increment/check secara atomik di database dan pertahankan kebijakan 5 kegagalan/15 menit lalu blokir 15 menit. Simpan HMAC/hash dari kunci sumber, bukan email/IP mentah; gunakan secret terpisah, masa retensi terbatas, dan cleanup. Vercel menyatakan `x-forwarded-for` ditulis ulang oleh platform dan menyediakan `x-vercel-forwarded-for`; saat ini handler meminta `getRequestIP` tanpa mempercayai `x-forwarded-for`, sehingga sumber IP socket yang diterima di Vercel belum dibuktikan. Implementasi harus memakai sumber Vercel yang dipercaya dan uji header spoofing/akses preview. Jangan mengasumsikan `unknown` bisa menjadi key global karena dapat memblokir guru yang berbeda bersama-sama.

Rujukan: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Supabase API security dan rate-limit pattern](https://supabase.com/docs/guides/api/securing-your-api).

### Build Vercel

Runtime `nodejs24.x` dan engines app sudah searah secara major. Risiko ada pada npm: app mensyaratkan npm `<11`, tetapi pengumuman Node24 Vercel menyebut Node24 build/functions dibundel dengan npm 11. Dokumentasi Vercel juga menjelaskan `packageManager` baru diikuti jika Corepack aktif.

Saat project Vercel dibuat, set `ENABLE_EXPERIMENTAL_COREPACK=1` agar `packageManager: npm@10.9.3` dihormati; jangan menurunkan atau melonggarkan engines diam-diam. Setelah project tersambung, tinjau log install untuk memastikan Node minimal `24.15` dan npm `10.9.3` sebelum menyebut build kompatibel. Build Vercel belum diperiksa pada task ini karena project belum tertaut.

Rujukan: [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Node.js 24 di Vercel](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions), [Vercel Corepack](https://vercel.com/docs/builds/configure-a-build#corepack), [Vercel package managers](https://vercel.com/docs/package-managers).

### Pemindahan data lokal (rencana; belum dijalankan)

1. Pertahankan backup yang sudah ada. Di task transfer terpisah, hentikan penulisan aplikasi sementara atau ambil backup konsisten saat tidak ada perubahan. Simpan archive terenkripsi di lokasi privat di luar Git, workspace, log, dan dokumentasi.
2. Terapkan schema dari migration 0001–0004 ke cloud kosong memakai role migrasi. Jangan menyalin DDL/ledger `schema_migrations` lokal; biarkan cloud mencatat migrasi sendiri dengan checksum source saat ini.
3. Gunakan logical `pg_dump` client versi 17 untuk membaca sumber PG16, lalu restore data-only terpilih ke schema PG17 yang sudah dibuat. Pertahankan semua UUID dan urutan dependensi FK; bawa baris audit yang ada dan identitas sequence `audit_events`. Salin hash akun guru yang sudah ada tanpa membuka nilainya; jangan memindahkan tabel `teacher_sessions`, cookie, sesi perangkat, atau secret session lokal. Login online tetap memakai auth model aplikasi.
4. Trigger bisnis, audit, dan guard semester akan bereaksi pada `COPY FROM`. Untuk restore yang mempertahankan audit persis, perlu rehearsal transaction tunggal yang menonaktifkan hanya **user triggers** selama impor sebagai owner tabel lalu mengaktifkannya kembali sebelum commit. PostgreSQL menyatakan `USER` tidak mematikan trigger internal FK; `pg_restore --disable-triggers` justru memerlukan superuser, dan target `postgres` tidak memilikinya. Jika rehearsal gagal atau restore harus melewati verifikasi constraint, berhenti dan buat importer khusus; jangan memaksa restore.
5. Setelah restore, verifikasi jumlah baris per tabel, seluruh FK/check constraint, sequence audit di atas nilai tertinggi, total audit, dan autentikasi guru tanpa mengeluarkan nama, email, ID, hash, atau payload audit ke log. Jalankan `ANALYZE`; lakukan smoke login, baca, perubahan absensi, dan audit pada cloud. Hasil build tidak menggantikan pemeriksaan ini.

Rujukan: [pg_restore data-only dan trigger](https://www.postgresql.org/docs/17/app-pgrestore.html), [COPY identity dan trigger](https://www.postgresql.org/docs/17/sql-copy.html), [ALTER TABLE `USER` triggers](https://www.postgresql.org/docs/17/sql-altertable.html), [PG17 migration guide](https://www.postgresql.org/docs/17/upgrading.html).

## Usulan langkah implementasi setelah review PM

1. PM mengonfirmasi ACL/default ACL aktual, Data API dimatikan, resource limit/plan, dan mode pooler yang akan dipakai. Dari opsi sekarang, rekomendasi saya session pooler shared + `max: 1` sebagai transisi paling kecil; pindah ke transaction pooler memerlukan jalur teknis lain.
2. Tambahkan konfigurasi app-role/TLS yang server-only dan forward-only hardening migration. Jalankan ke PG17 uji kosong; buktikan ACL anonim, query view, audit, semua transaksi, savepoint, serta lock lintas koneksi.
3. Tambahkan throttle database yang atomik dengan sumber IP Vercel terverifikasi; pertahankan copy/state autentikasi sekarang.
4. Sambungkan project Vercel baru, pin npm melalui Corepack, periksa build log dan environment privat preview. Release target/versi tetap persetujuan terpisah.
5. Kerjakan transfer data dan smoke cloud dalam task terpisah dengan backup utuh dan laporan hitungan agregat saja.

## Files expected to change (catatan saat preflight)

Tidak ada file aplikasi atau migrasi yang diubah pada tahap preflight. Perkiraan ini bersifat historis; file yang benar-benar berubah setelah PM menyetujui implementasi lokal dicatat pada addendum.

## Tests / verification (tahap preflight)

- Selesai: pemeriksaan statis pada file yang tercantum di atas; git branch/status/hash; penelusuran penggunaan transaksi, advisory lock, view, trigger, grant, dan guard lokal; pembacaan dokumentasi resmi Supabase, Vercel, PostgreSQL 17, dan Postgres.js.
- Belum dijalankan sesuai batas preflight-only: build/typecheck/test; koneksi atau query cloud; migrasi/role/ACL update; test sertifikat, throttle multi-instance, API/Data API, restore data, online smoke, atau UAT.

## Risiko dan blockers

- **Blocker sebelum pemilihan implementasi:** transaction pooler tidak kompatibel dengan pipeline Postgres.js saat ini, sedangkan shared session pooler memiliki batas koneksi yang harus dicocokkan dengan tier Supabase dan skala Vercel.
- **Blocker sebelum pemindahan data:** belum ada rehearsal import PG16 → PG17; import harus mempertahankan riwayat audit dan menekan trigger aplikasi tanpa menonaktifkan FK; dump berisi data pribadi dan perlu penanganan privat.
- **Belum terverifikasi:** ACL dan default ACL efektif Supabase, sertifikat TLS yang akan dipakai, batas koneksi paket, IP yang diterima handler Nuxt di Vercel, konfigurasi Data API, serta install/build log Vercel. Pembacaan/konfigurasi cloud tetap pada PM.
- **Bukan blocker preflight, tetapi gate release:** project Vercel belum ditautkan; secret runtime, TLS penuh, migrasi, restore, hitungan data, login lintas instance, dan smoke online belum dikerjakan/dibuktikan.

## Preflight decision

PREFLIGHT COMPLETE — minta PM meninjau rekomendasi session-pooler, ACL/Data API, dan mekanisme rate limit sebelum menugaskan implementasi. Preflight ini tidak menyetujui cloud write, pemindahan data, deployment, atau release.

## Addendum — implementasi lokal untuk tinjauan PM (13 Oktober 2026)

PM menerima preflight dan menugaskan persiapan kode lokal. Keputusan yang dipakai: pertahankan Postgres.js dan auth aplikasi; mode Supabase memakai Session pooler, maksimal satu koneksi per instance, CA serta hostname TLS diverifikasi. Tidak ada package/dependency baru. Migration 0001–0004 tidak diubah.

### Perubahan yang dibuat

- Koneksi/config: `app/server/database/client.ts`, `app/nuxt.config.ts`, `app/.env.example`, `app/docs/environment.md`. Validasi membatasi mode ke `local`/`supabase`, memastikan role dan host project, membuang opsi SSL query-string yang dapat melemahkan TLS, dan mensyaratkan CA serta hostname untuk Supabase. Koneksi lokal loopback tetap tersedia.
- Akses database: migration baru `app/server/database/migrations/0005_private_runtime_access.up.sql` dan `.down.sql` membatasi ACL runtime, mencabut akses API publik efektif, mengaktifkan RLS tanpa policy publik, mempertahankan akses baca view yang dibutuhkan dan menjadikan view `security_invoker`; migration `0006_shared_login_throttle.up.sql` dan `.down.sql` menambah penyimpanan throttle privat. Migrator cloud terpisah berada di `app/scripts/supabase-migrate.mjs`, dengan guard target/role dan konfirmasi eksplisit sebelum menulis. Ia tidak mengimpor data dan belum dijalankan terhadap cloud.
- Login dan sesi: `app/server/auth/shared-login-throttle.ts`, `app/server/api/auth/login.post.ts`, `app/server/database/repositories/teacher-accounts.ts`. Throttle online menggunakan counter database atomik dan HMAC, bukan menyimpan IP/email mentah; hanya branch Vercel yang mempercayai `x-vercel-forwarded-for`. Pemeriksaan serentak diserialisasi per kunci HMAC dalam transaksi. Pembuatan/lookup sesi menolak versi akun yang sudah direset tanpa memberi hak UPDATE pada tabel akun kepada runtime.
- Pengujian: `app/tests/auth.test.ts`, `app/tests/database.test.ts`, `app/tests/fixtures/school-fixture.ts`, `app/tests/support/temporary-postgres.mjs`; package script migrator ditambahkan di `app/package.json` tanpa menambah dependency.

### Verifikasi yang tersedia

- PostgreSQL 16 disposable: suite data **13/13 lulus**, diulang mandiri oleh PM. Cakupan termasuk migrasi up/down/up, penolakan akses role API, hak minimum runtime, audit/view, closed-semester, throttle lintas koneksi, serta expiry/reset.
- HTTP auth pada dua server sementara yang memakai database uji bersama: suite **14/14 lulus**, diulang mandiri oleh PM. Delapan percobaan serentak menghasilkan lima respons `401` sebelum batas throttle dan tiga `429`; alur login, pembuatan dan lookup sesi, logout, serta penolakan sesi versi lama sesudah reset tercakup. Header IP sintetis menguji branch Vercel pada fixture lokal, bukan perilaku proxy Vercel sebenarnya.
- Nuxt typecheck: lulus di salinan staging terisolasi dengan Node 24. Build `nuxt build --preset vercel`: lulus di staging dalam 55,5 detik. `.vercel/output/functions/__fallback.func/.vc-config.json` melaporkan `nodejs24.x`. Build tidak menimpa `.output` runtime utama.
- Folder staging yang diperiksa: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app\.data\tests\verify-a26def44-c1ff-4227-8c6e-c2d8c4d965ff-RdmPh1`. Metadata runtime: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app\.data\tests\verify-a26def44-c1ff-4227-8c6e-c2d8c4d965ff-RdmPh1\.vercel\output\functions\__fallback.func\.vc-config.json`.
- `git diff --check`: lulus. Pemeriksaan pencarian memastikan mode `supabase-test` tidak diterima kode aplikasi; kemunculannya hanya pada tes yang memastikan mode itu ditolak.
- Bukti terpisah dari pemeriksaan baca-saja PM: endpoint Session pooler menerima CA+hostname yang benar; koneksi tanpa CA dan hostname yang salah ditolak. Pemeriksaan metadata cloud terakhir PM menemukan PostgreSQL 17.11 sehat, tanpa tabel aplikasi atau ledger migrasi pada schema `public`.

### Batas dan tindak lanjut PM

- Belum ada write/query perubahan ke cloud, penerapan migration, transfer data guru/murid, deployment, project Vercel yang tertaut, atau smoke pada deployment. Data asli dan runtime lokal aktif tidak dibuka/diubah.
- PG17 rehearsal sebagai `lab002_migrator` masih diperlukan. Role tersebut harus disiapkan PM dengan hak minimum yang diperiksa tool; migration tidak boleh dijalankan sebagai owner `postgres`. Jangan anggap pemeriksaan metadata kosong sebagai bukti bahwa migrasi berhasil.
- Build dilakukan memakai dependency lokal yang tersedia, bukan instalasi remote Vercel. Versi npm aktual pada build Vercel/Corepack dan log install masih perlu diperiksa sesudah project disiapkan. Perilaku penulisan ulang/spoof header pada proxy Vercel dan smoke login online juga belum diverifikasi.
- Import data, hitungan agregat hasil restore, pemeriksaan constraint/sequence/audit, dan smoke online tetap pekerjaan terpisah sesudah PM meninjau perubahan ini. Migrator yang ditambahkan hanya menerapkan migration dengan target guard; ia bukan alat restore.
- Working tree app berisi perubahan lokal yang belum di-commit. Executor tidak membuat commit/push dan menyerahkan review perubahan kepada PM.

Next owner: Project Manager untuk meninjau diff serta menentukan bila dan kapan dilakukan rehearsal PG17. Build/test lokal yang lulus belum merupakan penerimaan PM, persetujuan Ardy, pemindahan data, atau izin release.
