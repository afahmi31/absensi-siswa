# Laporan Executor — LAB002-AUTH-001

Tanggal: 12 Oktober 2026
Status Executor: **IMPLEMENTED — menunggu validasi PM**. Ini laporan hasil Executor, bukan acceptance PM atau persetujuan Ardy.
Next owner: PM untuk validasi independen dan pemeriksaan browser akhir.

Instruksi stop/pause Ardy pada 12 Oktober tetap tercatat sebagai riwayat di task dan [laporan stop tersimpan](<LAB002-AUTH-001-safe-stop-2026-10-12.md>). Task dilanjutkan setelah Ardy meminta resume. Perubahan dipertahankan; tidak ada commit, push, deployment, atau perubahan production.

## Hasil pekerjaan

- Menambahkan autentikasi lokal satu akun email/kata sandi dengan `nuxt-auth-utils` 0.5.31 dan scrypt (`@adonisjs/hash` 9.1.1). Tidak ada pendaftaran publik, reset email, OAuth, atau SDK auth cloud.
- Migration 0002 menambah hash kata sandi, versi akun, dan sesi server-side terpisah. Logout mencabut sesi pada perangkat itu saja. Reset kata sandi menaikkan versi akun dan mencabut sesi lama seluruh perangkat.
- API login, logout, status sesi, dan pemeriksaan akses default untuk endpoint bisnis masa depan. Request tulis memeriksa `Origin`; email/kata sandi yang tidak cocok memakai pesan umum. Hash dan rahasia sesi dikecualikan dari audit serta response publik.
- Menambahkan CLI owner untuk provision/reset, route guard, halaman login, dan home terlindungi. Copy home sekarang memakai heading “Absensi kelas” dan teks “Pengisian absensi belum tersedia.” Tidak ada alur atau status absensi palsu.
- Memperbaiki hitungan throttle setelah empat kegagalan awal dan menambahkan pemeriksaan blokir lima kali.
- Mengisolasi root Nuxt pada tes HTTP AUTH ke direktori sementara di `.data/tests/nuxt-root-*`, memakai junction dependency yang dilepas sebelum cleanup, timeout 5 detik pada setiap request, serta mengumpulkan output proses untuk diagnostik yang disanitasi. `npm test` kini menjalankan dua runner dengan `process.execPath`, tanpa memanggil npm bersarang dari PATH.
- Memperbarui README, panduan environment/build, smoke check copy, dan bukti build/tes.

## Pemeriksaan dan bukti

Runtime pemeriksaan: Node bundled `24.19.0`; npm CLI resmi `10.9.3`, dipanggil melalui Node bundled dan path CLI tetap `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`.

| Pemeriksaan | Hasil Executor | Bukti/batas |
|---|---|---|
| `npm run typecheck` | Lulus, exit 0 | Dijalankan setelah perubahan source/harness. PM juga melaporkan pemeriksaan independen terbaru lulus, exit 0. |
| `npm run test:auth` | Lulus, 12/12; 32,6 detik | HTTP berjalan pada PostgreSQL 16 sementara dan root Nuxt terisolasi. Mencakup throttle, redirect/API guard, Origin, field kosong, pesan kredensial umum, cookie, dua perangkat, reset/revocation, dan logout per perangkat. |
| `npm test` | Lulus, DATA 6/6 dan AUTH 12/12; exit 0 | [test-all.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/test-all.txt>). Rerun independen PM terbaru juga lulus DATA 6/6 dan AUTH 12/12; `pm-test-all.txt` adalah bukti PM. Rerun PM dilakukan setelah server development 3000 aktif, sehingga tidak perlu menghentikan server itu. |
| `npm run build` | Lulus, exit 0 | [build-vercel.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/build-vercel.txt>). `.vc-config.json` menunjukkan runtime `nodejs24.x`. Ada `DEP0155` dari pemetaan trailing-slash `@vue/shared`; build tetap selesai. |
| `npm run build:node` | Lulus, exit 0 | [build-node.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/build-node.txt>) berakhir dengan `Build complete`; `.output/server/index.mjs` tersedia. Perintah PowerShell gabungan sesudah build sempat berakhir exit 1 karena saya memakai nama file metadata yang keliru (`vc-config.json`); pembacaan `.vc-config.json` yang benar kemudian mengonfirmasi `nodejs24.x`. Ini kegagalan langkah pemeriksaan lanjutan, bukan kegagalan build. |
| `git diff --check` | Lulus | Tidak ada whitespace error. PowerShell hanya melaporkan peringatan konversi LF/CRLF untuk sejumlah file kerja. |
| HTTP smoke dan database persisten | Lulus pada pemeriksaan sebelumnya di task ini | [persistent-http-smoke.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/persistent-http-smoke.txt>), [persistent-migrate.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/persistent-migrate.txt>), dan [persistent-post-migration.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/persistent-post-migration.txt>). Login lokal, sesi, guard home, logout dan replay cookie diperiksa; migrasi ulang tidak mengubah checksum/ledger. |
| Login akun persisten sesudah perbaikan startup | Lulus: login 200, session 200, logout 200, replay sesi logout tetap 200 tetapi `authenticated=false` | [persistent-http-smoke-after-env-fix.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-AUTH-001/persistent-http-smoke-after-env-fix.txt>). Helper membaca file akun ignored hanya di memory proses dan tidak mencetak nilai rahasia. Tidak ada reset kata sandi atau perubahan data bisnis. |

Saya menjalankan `auth:account:provision` untuk akun lokal dan menyimpan kredensial hanya dalam `app/.data/teacher-account.json` serta environment privat `app/.data/auth-env.ps1`. Nilai kredensial tidak dicatat dalam laporan atau log. Data sekolah/kelas/semester/siswa/absensi tetap kosong. Reset kata sandi serta audit actor diuji melalui service integration test; saya tidak menjalankan CLI reset pada akun persisten agar tidak merotasi kredensial lokal setelah provisioning. File dan direktori `.data` diabaikan Git.

PM melaporkan pemeriksaan browser login/logout desktop dan 390×844 lulus, lalu mengonfirmasi anonymous redirect serta home terbaru dengan heading “Absensi kelas” lulus di browser. Bukti browser tetap pemeriksaan PM, bukan pengujian Executor.

## Acceptance criteria

| AC | Status Executor | Catatan |
|---|---|---|
| AC01 — login/logout dan sesi | Terimplementasi; API PASS | Suite HTTP lulus; alur browser sebelumnya dilaporkan PM lulus. |
| AC02 — guard, same-origin, rahasia, reset | Terimplementasi; HTTP PASS | Reset mencabut sesi lama semua perangkat; logout hanya sesi perangkat saat itu. |
| AC03 — CLI lokal, penyimpanan rahasia, audit | Sebagian terverifikasi | Provision CLI dijalankan; service reset, version bump, audit actor/redaksi diuji. CLI reset terhadap akun persisten belum dijalankan; PM merencanakan pemeriksaan lokal setelah login runtime diperbaiki. |
| AC04 — UI responsif dan state | Source PASS; browser PASS menurut PM | PM memeriksa login desktop/mobile dan home terbaru. |
| AC05 — tests/typecheck/build | PASS pada pemeriksaan Executor; PASS independen PM untuk suite dan typecheck | Tidak menyatakan kesiapan production/Vercel deployment. |
| AC06 — dokumentasi dan handoff | PASS dari sisi Executor | README, environment/build guide, evidence, dan laporan tersedia. Validasi akhir menjadi tanggung jawab PM. |

## Status runtime dan batas

- PostgreSQL proyek adalah binary existing PG16, loopback port `55432`, data di `app/.data/postgres`. Tidak menyentuh service PG18, Docker, atau cloud.
- Server development lokal yang saya mulai tetap aktif di `http://127.0.0.1:3000/`; listener PID `8244`, exec session `1454`. Server memakai environment privat lokal dan hanya bind loopback. PM boleh menghentikannya setelah pemeriksaan.
- Temuan runtime awal: proses dev pertama hanya memuat `.data/auth-env.ps1` dan tidak memuat `.data/local-env.ps1`, sehingga `NUXT_DATABASE_URL` kosong. Request login masuk ke penanganan DB error generik 503 pada login API. README dan panduan build/environment sudah meminta kedua file privat di-dot-source; tidak ada bug source atau kegagalan database. Saya menghentikan hanya proses dev milik saya, memulai ulang dengan kedua file, lalu memverifikasi akun persisten melalui login/sesi/logout/replay. Tidak ada perubahan source atau reset akun untuk memperbaikinya.
- Cluster sementara macet milik runner PM pada `app/.data/tests/cluster-9746adc3-ae1b-454b-872d-c29afb9ba151` dihentikan dengan PG16 `pg_ctl -m fast`; direktorinya sengaja dipertahankan. Direktori cluster sementara browser lama `cluster-2e2b48fb-06ec-476d-bda5-1f77b98004c9` juga dipertahankan setelah statusnya terhenti. Tidak ada recursive delete pada kedua direktori itu.
- Throttle saat ini disimpan dalam proses dan bukan jaminan pembatasan lintas worker/produksi. Tidak ada verifikasi deployment, layanan cloud, atau penggunaan sekolah nyata.

## Langkah PM berikutnya

PM memeriksa diff/scope, memvalidasi laporan serta evidence, mencoba CLI reset bila diperlukan dalam target lokal yang aman, dan memeriksa browser untuk home setelah login dengan copy terbaru. Task belum saya terima atau tutup sendiri.
