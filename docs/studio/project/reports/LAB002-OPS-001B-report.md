# IMPLEMENTATION REPORT — LAB002-OPS-001B

Tanggal: 22 Oktober 2026. FROM Executor `/root/ops_backup_preflight`; TO / next owner PM. Model/reasoning sesuai assignment: Codex gpt-6.1-sol/medium. Status laporan: IMPLEMENTED untuk review PM, bukan task CLOSED atau acceptance Ardy.

## Hasil dan perubahan aktual

CLI owner lokal terpisah tersedia: `node --experimental-strip-types scripts/local-backup.mjs create` dan `restore-test --backup=<generated-id>`. Tidak ada target URL/path/force/public endpoint. Create managed belum dijalankan; seluruh pembuktian memakai cluster baru dan sekolah/siswa/logo sintetis.

Core memakai exported REPEATABLE READ READ ONLY snapshot yang sama untuk PG16 custom data-only dump, metadata12tabel, daftar seluruh aset immutable serta referensi aktif/arsip. Logo A/B diperiksa hash/bytes/decode/dimensi. Paket privat staging menjadi final melalui rename dan namespace lock tanpa overwrite; hash sidecar adalah deteksi korupsi, bukan tanda tangan.

Restore-test menolak input rusak, stage dump bytes privat dan parse COPY allowlist sebelum membuat target. Schema berasal dari migration lokal0001–0008 exact checksum, bukan SQL/DDL arsip. Target diterbitkan factory/capability in-process di `.cache/local-backup-tests`, loopback/freeport selain5432/55432; server data_directory, startup/PID-file, port, role/database/owner dan PG16 dicocokkan. USER triggers dinonaktifkan hanya pada fresh target dalam transaksi. School active pointer NULL sementara mengatasi siklus FK, lalu dikembalikan; FK internal/check tetap aktif. Seluruh kolom dibandingkan EXCEPT ALL dua arah sebelum commit, invariant domain diperiksa dan trigger diaktifkan kembali.

Sesudah import, row digests, descriptor aset/ref, ownership/ACL/RLS/trigger metadata dibandingkan. Library reset existing mengganti hash akun target, menaikkan session_version dan mencatat audit; ID/email dipertahankan. Audit asal diperiksa prefix-digest exact, bukan hanya jumlah; business tables lain tetap sama. Sessions/throttle/env/role passwords tidak masuk dump. Harness HTTP sintetis memakai H3 sealed cookie dan repository/library auth existing: password/cookie lama gagal, password baru dan cookie barunya berhasil. Ini harness teknis terarah, bukan pengujian browser atau deployment aplikasi.

## File milik Executor

Relatif root Git app:

- `scripts/local-backup-files.mjs`: canonical/no-link/filehandle guard, ACL verifikasi, duplicate JSON, receipt cleanup, publikasi atomik.
- `scripts/local-backup-postgres.mjs`: child sanitization/timeout, PG16 factory/capability/identity/teardown.
- `scripts/local-backup-core.mjs`: source guard, snapshot, manifest/asset verification, staging restore/invariants/reset.
- `scripts/local-backup.mjs`: CLI create/restore-test dan pesan aman.
- `scripts/test-local-backup.mjs`, `tests/local-backup.test.ts`, `tests/local-backup-validation.test.ts`: runner/fixture/tes terarah.
- `scripts/local-backup-checks.mjs`: salinan source terisolasi untuk typecheck/build, tanpa `.env`/`.data`; helper development saja.
- `docs/local-backup.md`: command, isi/privasi/batas/hasil serta managed belum diuji.

Registry: laporan preflight, checkpoint dan laporan ini. Tidak mengubah package/lock, source runtime/UI/auth/schema/migration, alat cloud, docs mirror/status/Git milik PM, dependency/global settings. Perubahan PM existing dipertahankan.

## AC self-check — expected dan observed

| Kontrak | Expected | Observed Executor |
|---|---|---|
| Parent03 / task B backup |12tabel + seluruh metadata/aset snapshot; data asal tetap; lengkap atau gagal | PASS sintetis:32audit asal, A PNG arsip/B JPEG aktif/legacyNULL,12tabel full rows identik, source sebelum/sesudah exact. Missing logo dan interupsi sebelum publish gagal tanpa paket baru; paket lama tetap. |
| Parent04 / target | Hanya target fresh loopback milik operasi, restore data/refs/bytes exact | PASS sintetis: factory target terisolasi; forged capability/CLI URL/path/remote/extra flag ditolak, occupied-port tidak attach/stop foreign listener; full row/model laporan/effective attendance dan bytes/hash A/B sama. Tidak menyentuh DB managed. |
| Parent04 / invariant/reset |FK dan immutable guards pulih, reset akun/sesi eksplisit, tanpa audit asal berubah | PASS sintetis: timezone invariant trigger-only rusak menyebabkan rollback semua rows dan trigger tetap enabled. Mutation audit/arsip/logo metadata ditolak; runtime tanpa pg_read_all_settings. Password lama/cookie source401, password baru/login200/protected200; session_version+1; audit asal exact +1 reset event. |
| Parent05 / safety/evidence | Privat, error aman, finite timeout, cleanup milik operasi | PASS subset terarah: ACL extra principal ditolak; symlink/hardlink/junction/path traversal/duplicate JSON/COPY injection/truncated SQL/metadata korup ditolak; swapped directory receipt menolak cleanup dan sentinel utuh; timeout/output-limit mematikan hanya child handle; cluster seluruh run final dibersihkan. Batas yang belum disimulasikan tercatat di bawah. |
| Snapshot concurrency | writer logo+closure setelah exporter tidak masuk paket pertama; paket berikut melihat commit | PASS barrier deterministik: writer commit setelah exporter dibuat dan sebelum pg_dump dilanjutkan; restored data paket pertama exact keadaan sebelumnya, paket berikut exact keadaan sesudah writer. Source sesudah dua restore tetap exact. Tidak mengunci/menulis domain untuk backup. |

Hasil di atas self-check Executor pada scope lokal sintetis. Managed create, penerimaan PM, acceptance Ardy, operasi data guru dan production tetap fakta terpisah; belum diklaim PASS.

## Verification aktual

Runtime Node24.19.0 bundled, PG16 existing; tidak install. Cwd root Git app.

| Command | Hasil / evidence |
|---|---|
| `node scripts/test-local-backup.mjs` | Exit0;14PASS/0FAIL/0SKIP,170.96detik. `.cache/OPS001B-tests.log`. Enam tes validation + main roundtrip + tujuh subtests. Durasi lebih lama ketika checks build berjalan paralel; tetap di bawah timeout test300s. |
| `node --experimental-strip-types --test tests/school-logo-storage.test.ts` |5PASS/0FAIL/0SKIP,0.28detik; `.cache/OPS001B-storage-regression.log`. |
| Node `--check` untuk keenam script baru | Exit0, termasuk core/files/postgres/CLI/checks/test runner. |
| `node scripts/local-backup-checks.mjs` | Typecheck PASS, build Vercel PASS, build Node PASS pada salinan tanpa env/data nyata. Log awal `.cache/OPS001B-typecheck.log`, `OPS001B-build-vercel.log`, `OPS001B-build-node.log`. Wrapper awal exit1 pada cleanup symlink Nitro; hasil compile terpisah dari cleanup. Run konfirmasi cleanup/log unik dicatat sesudah selesai di bawah. |
| `git diff --exit-code -- server scripts/cloud-data-transfer-core.mjs scripts/cloud-data-transfer.mjs` | Exit0; source runtime dan cloudtool tidak berubah. Tes juga membandingkan SHA256 cloud core sebelum/sesudah. |
| `git diff --check` | Exit0 pada tracked diff; hanya peringatan normalisasi LF/CRLF file dokumentasi PM. File source baru diperiksa Node dan suite di atas. |

Snapshot hash source final dan log disimpan pada `.cache/OPS001B-source-evidence.json` setelah dokumentasi akhir. Artefak ini berisi hanya path/hash source dan log sintetis, tidak credential atau dump.

## Kegagalan yang diselesaikan dan keputusan

- Import nama helper auth test awal tidak cocok export; diperbaiki pada test saja. Inet server address dinormalisasi dengan host() dan COPY parser menerima angka nama kolom seperti sha256. Fixture academicYear dibuat unik sesuai constraint. Assertions manifest membedakan nama kolom password_hash dari nilai hash yang memang tidak ada di manifest.
- Dua variasi launcher verifier ACL gagal, lalu Executor berhenti dan PM meminta keputusan. Ardy menyetujui dialog “Lanjutkan diagnosis terarah dan perbaikan” (diteruskan PM pada sesi task ini). Stderr terarah membuktikan Get-Acl gagal autoload Microsoft.PowerShell.Security akibat module path yang diwariskan. Menghapus PSModulePath **hanya pada child Windows PowerShell** memperbaiki verifier; guard tetap owner+SYSTEM. Tes extra principal membuktikan verifier masih menolak ACL lemah. Tidak mengubah konfigurasi global.
- pg_ctl startup awal membuat server tetapi pipe startup diwarisi proses PG sehingga close tidak selesai. Runner kini memakai stdio ignore untuk start/stop, dan timeout menutup pipe milik child. Run awal dihentikan hanya sesudah PID18784/data path/port63670 cocok dengan issued cluster; server stop dan process test selesai, root generated dibersihkan. Tidak menghentikan layanan PostgreSQL lain.
- PM mengizinkan `pg_read_all_settings` hanya pada migrator disposable baru untuk verifikasi data_directory, bukan pada role runtime, migrator managed atau production. Factory menerapkan dan memeriksa perbedaan ini setiap verifikasi target. Tidak mengubah source local-db atau migrations.
- Build check awal berhasil compile tetapi cleanup menolak symlink standar Nitro/Vercel. Guard backup/restore tidak dilonggarkan. Helper development kemudian melepas hanya symlink di output miliknya yang canonical target-nya di root checks yang sama, saat receipt asli masih hidup. Salinan run awal dipertahankan karena receipt lintas proses tidak diasumsikan.

## Batas dan risiko tersisa

- HIGH-risk operasi DB/data privat tetap memerlukan PM review independen. Tidak melakukan source managed create/privilege probe; metadata field/path dikonfirmasi dari `scripts/local-db.mjs:61–89,229–238`, bukan membaca local-db.json aktual. Source pengelola lokal membuat migrator nonsuperuser **tanpa pg_read_all_settings**; karena guard memerlukan pembacaan data_directory, create managed kemungkinan terblokir pada setup itu (inferensi source, belum probe aktual). **Command managed belum dinyatakan dapat dipakai atau tervalidasi.** Jangan menambah grant source sebagai workaround. Jalur sintetis tidak membuktikan privilege managed; PM menentukan keputusan/status/kelanjutan batas ini.
- Tidak ada pembuktian data guru, cloud/provider durable, Linux/Vercel runtime storage, server production, retensi/restore persisten, browser/printer atau acceptance Ardy. Output Vercel adalah artefak build, bukan deployment.
- Negatives yang benar-benar dijalankan adalah yang disebut tabel/log. Tidak menyimulasikan semua kondisi OS/disk (disk-full/power-loss), expiry overall5menit penuh, exporter disconnect, proses restore killed pada setiap instruksi, atau seluruh kombinasi invariant domain. Child timeout/output cap dan rollback invariant diuji representatif; jangan mengubahnya menjadi klaim bebas seluruh kegagalan.
- SHA256 tidak membuktikan autentisitas terhadap pengguna OS yang dapat menulis ulang seluruh paket. ACL membatasi principal biasa; bukan isolasi dari administrator/owner OS yang sengaja mengganti filesystem bersamaan.
- Dump/aset/SQL privat hanya berada di generated fixture yang sudah teardown. Log dan salinan build sintetis ignored dipertahankan seperti catatan cleanup; tidak disalin ke Git.

Production Actions Performed: NONE. Tidak commit/push/deploy/menutup task. Next owner **PM** untuk membaca source/evidence, menjalankan subset independen yang diperlukan, meminta revisi bila perlu dan mengurus status/mirror/Git sesuai kewenangan.

## Final checks dan cleanup

Run konfirmasi `node scripts/local-backup-checks.mjs`, session43225: **exit0**, typecheck PASS, buildVercel PASS, buildNode PASS dan root `checks-829c7c0e-d821-4bd3-92ef-92addeaa71a6` tidak ada lagi sesudah cleanup. Log unik: `.cache/OPS001B-typecheck-checks-829c7c0e-d821-4bd3-92ef-92addeaa71a6.log`, `OPS001B-build-vercel-checks-829c7c0e-d821-4bd3-92ef-92addeaa71a6.log`, `OPS001B-build-node-checks-829c7c0e-d821-4bd3-92ef-92addeaa71a6.log`. Typecheck stdout kosong pada run terakhir tetap exit0 dari runner; tidak menganggap file kosong sebagai PASS tanpa exit.

Seluruh cluster/database/HTTP server fixture Executor final sudah teardown oleh issued capability; source exact assertion dilakukan sebelum source teardown. Tidak meninggalkan layanan PG milik Executor. PM memulai suite independen sesudah suite Executor selesai; proses/folder milik run PM tidak diklaim atau dihentikan Executor. Artefak retained milik riwayat run ini: `.cache/local-backup-tests/acl-debug` dan salinan build awal `checks-30c0802f-6b3d-4fdf-8f48-0e001d628448` (ignored, tanpa env/data guru/credential DB). Folder ini dipertahankan untuk pemeriksaan PM karena receipt runtime awal sudah berakhir. Sentinel publication sintetis dari run awal dibersihkan secara nonrecursive setelah path persis, satu nama file dan isi literalnya diverifikasi; tidak menghapus folder historis lain.

Manifest evidence final `.cache/OPS001B-source-evidence.json` mencatat14hash source/dokumentasi dan5hash log; PM dapat membandingkan sebelum konsumsi evidence. Laporan ini tetap tidak menyatakan acceptance PM dari selesainya proses Executor.
