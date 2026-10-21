Kelanjutan22Oktober2026: kajian identitas tanpa tambahan hak selesai dan diterima PM sebagai rancangan revisi. Implementasi belum diizinkan; menunggu keputusan Ardy. Baca reports/LAB002-OPS-001B-managed-identity-pm-review.md dan kontrak A–D/verification pada laporan preflight. Config task sama gpt-6.1-sol/medium. Tidak ada Executor aktif; cluster lokal menyala, tanpa dump/grant/perubahan data bisnis/push/deploy.

Status terkini22Oktober2026: OPS-001B BLOCKED pada guard managed; pembacaan data_directory ditolak42501, migrator tidak memiliki pg_read_all_settings. Ardy sudah mengizinkan startup dan probe read-only; hasil di reports/LAB002-OPS-001B-managed-probe.md. Cluster lokal menyala, probe ditutup, tidak ada Executor aktif. Menunggu keputusan pendekatan identitas; tanpa grant/dump/migrasi/push/deploy.

# LAB002-OPS-001B — Cadangan dan pemulihan lokal dengan aset logo

Tanggal: 22 Oktober 2026. Status: PM_VALIDATION; handoff Executor diterima, pengujian sintetis PASS, jalur create managed belum terverifikasi. Pilihan Ardy: Codex gpt-6.1-sol/medium, jawaban dialog22Oktober2026. Implementasi mengikuti kontrak PM di bawah. Sumber permintaan Ardy: “lanjtukan task”, setelah REP-001D selesai dan langkah berikutnya cadangan/pemulihan aset disampaikan. Root registry LAB-002; root Git app, branch develop, HEAD a1cab2d. Working tree bersih saat diperiksa, ahead3 terhadap origin/develop. Commit a1cab2d dari pekerjaan lain dipertahankan. Tidak push/deploy/cloud/data guru.

## Tujuan dan sumber

Lengkapi parent OPS-001 AC03/04 serta bagian AC05: cadangan on-demand berisi PostgreSQL custom dump, manifest/checksum migrasi dan aset logo aktif maupun historis yang dirujuk; pemulihan hanya ke target lokal baru yang terisolasi. Kontrak lokal C08 tetap berlaku. OPS-001A dan REP-001A–D sudah selesai, tidak diulang. PM menggunakan studio-task-brief; implementasi tetap oleh Executor setelah preflight diterima dan pilihan assignment Ardy tersedia.

## Tahap preflight

Baca instruksi/protokol/workflow aktif, parent OPS, kontrak lokal, review OPS-A dan REP-D. Periksa source alat transfer lama, migrasi0008, metadata/storage logo, runner PostgreSQL sementara, mekanisme akun/session/reset serta pengemasan runtime secukupnya. Jangan membaca env privat, backup nyata, database guru atau asset asli di .data. Tidak menjalankan alat transfer cloud, dump data asli, migration persisten, atau restore.

Tulis reports/LAB002-OPS-001B-preflight.md dengan:

1. Peta kemampuan alat existing dan kesenjangan. Alat cloud-data-transfer memiliki scope/schema lama dan jalur cloud; jangan menganggap sudah mendukung tabel/aset logo atau mengubahnya diam-diam. Usulkan reuse helper yang aman versus alat lokal terpisah, dengan alasan minimal.
2. Kontrak command on-demand owner, parameter yang diizinkan dan default penolakan target berbahaya. Buktikan desain tidak dapat menimpa DB managed yang sudah ada, remote, production atau path arbitrer. Tidak ada endpoint restore publik atau background job.
3. Konsistensi snapshot database dan daftar aset immutable: sebut bagaimana pg_dump PG16 memakai snapshot yang sama dengan pembacaan referensi logo aktif/arsip, termasuk perubahan logo atau penutupan semester bersamaan. Jangan memblokir/merusak data domain untuk mempermudah backup.
4. Manifest versi, daftar/checksum migrasi, hash dump/aset, path relatif aman, metadata dan aturan kompatibilitas. Tidak memuat password/URI/session plaintext. Tentukan apakah material autentikasi masuk dump, bagaimana menjaga privasi, dan reset akun/sesi setelah restore; jangan mengubah kontrak auth aplikasi.
5. Penyimpanan atomik, gagal tanpa paket sukses palsu, akses privat/ACL, tidak menimpa backup lama, serta cleanup berkas milik operasi. Tolak symlink, traversal, duplikat/path bermasalah dan manifest/hash rusak sebelum restore. Semua recursive cleanup memeriksa canonical path dan ownership.
6. Verifikasi fixture sintetis sekolah/siswa/kalender/absensi/audit/arsip/logoA historis dan B aktif, perbandingan data serta hash gambar setelah restore; kasus negatif dan concurrency yang berarti. Uji browser hanya bila alur pengguna berubah; CLI owner tidak menambah UI tanpa requirement.

Tidak memasang dependency atau coding sebelum PM menerima preflight. Tidak memutuskan provider production atau biaya. Binary PG16/Node24 dan dependency existing diprioritaskan; laporkan jika ada kebutuhan baru.

## Kriteria hasil setelah kontrak implementasi ditetapkan

- Backup lengkap atau gagal atomik, hash dan manifest benar, mencakup seluruh logo yang dirujuk snapshot aktif/arsip. Tanpa secret di log/manifest; artefak privat di luar Git.
- Restore hanya cluster sintetis baru di loopback dengan role/ownership aman, target persisten/remote ditolak. Tidak menggunakan .data guru atau port managed sebagai target fixture.
- Baris bisnis, status efektif, metadata arsip, audit dan byte logo sama setelah pemulihan. Akun/sesi mengikuti keputusan reset yang dikunci; tidak mengaktifkan kredensial backup diam-diam.
- Tes berbahaya/korup/partial, timeout dan cleanup mempunyai expected/observed; final typecheck/build bila source terkait berubah. Dokumen pemakaian dapat diulang. PM menilai bukti independen sebelum penerimaan.

Scope tidak mencakup provider cloud, backup production/retensi otomatis, deployment, impor Excel, atau printer fisik. Laporan final reports/LAB002-OPS-001B-report.md. Executor tidak commit/push/deploy atau menutup task; PM memiliki Git/status dan review. Pilihan platform/model/reasoning untuk task baru diminta kepada Ardy menurut AGENTS workspace terbaru sebelum assignment. Next owner Executor untuk implementasi dan handoff; PM memeriksa hasil.

## Kontrak implementasi PM — 22 Oktober 2026

Preflight diterima. Status ASSIGNED untuk implementasi kepada /root/ops_backup_preflight, Codex gpt-6.1-sol/medium sesuai pilihan Ardy pada task ini. Ini pelaksanaan lokal dengan data sintetis; tidak memberi izin mencadangkan data guru sekarang.

1. Setujui CLI lokal terpisah: create dan restore-test dengan ID paket generated, tanpa target URL/path atau --force. Cloud transfer lama dan kode runtime/schema/auth/UI tidak diubah. Tidak ada dependency/provider baru. Tambahkan dokumentasi command owner dan scripts/test terarah; semua artefak privat ignored. Jika source managed butuh privilege yang belum tersedia, jangan menambah grant atau melemahkan pemeriksaan; laporkan blocker dan lanjutkan jalur sintetis yang independen.
2. Setujui snapshot REPEATABLE READ READ ONLY yang diekspor untuk pg_dump16 data-only/custom dan metadata/logo dari snapshot yang sama. Sertakan seluruh12tabel bisnis termasuk aset, seluruh baris metadata aset dan bytesnya (superset logo aktif/arsip); jangan menyalin filesystem orphan. Exporter harus hidup hingga selesai. Missing/tamper/decode salah/DDL mismatch gagal paket, tidak mengubah sumber. Sequence bukan MVCC; rows harus exact, next audit ID aman di atas maksimum dan state dump tervalidasi.
3. Format lokal baru lab002-local-backup/v1, schema fresh dari migration lokal0001–0008 exact checksum, bukan DDL dari arsip. Private manifest tidak membawa email/nama siswa/URI/password/hash akun/session. Dump berisi hash akun dan data pribadi, sehingga wajib ACL privat. Exclude sessions/throttle/env/rolepassword. Hash sidecar hanya deteksi korupsi, jangan klaim tanda tangan. Tolak unknown/missing/extra/duplicate descriptor, path, tabel/kolom/migration/SQL sesuai preflight sebelum target write.
4. Restore fresh melalui factory/capability lokal dalam proses yang sama, generated root.cache/local-backup-tests, portloopback bebas selain5432/55432; tidak menerima target buatan klien. Verifikasi proses, canonical data_directory/identity/port/database/role sebelum write. Tidak attach existing cluster, tidak mengubah managed sentinel/servis. Hapus inherited connection overrides dari child. PG binaries absolut, shell:false, windowsHide, tanpa rahasia pada argumen/log.
5. Setujui staging COPY allowlist, generated SQL lokal, disable USER triggers hanya pada target disposable dalam transaksi; FK internal/check tetap aktif. School pointer awalNULL, akun/sekolah sebelumaset, pointer dikembalikan lalu data sesuai dependency. Tidak DISABLE ALL, session_replication_role atau menjalankan DDL/SQL arsip. Re-enable triggers dan periksa enabled state, validated FKs, pemilik/privilege/RLS, serta invariant domain yang biasanya dilindungi USER triggers sebelum target ready. Setiap kegagalan rollback/teardown target sendiri.
6. Setujui reset akun menggunakan library existing, bukan CLI managed. Bandingkan seluruh data bisnis/audit exact sebelum reset, kemudian ganti hash dengan password acak target saja dan naikkan session_version, sessions kosong. ID/email tetap, delta reset/audit diperiksa eksplisit. Jika reset baru bisa dilakukan sesudah transaksi import commit karena bentuk helper, target tetap private/not-ready, belum ada server aplikasi/output akses hingga reset dan verifikasi selesai; jika gagal target dihentikan/dibersihkan. Jangan modifikasi library auth production. Uji password/cookie lama gagal dan password baru berhasil pada harness sintetis. Tidak ada credential target di Git/log/chat.
7. Setujui batas paket/timeout yang diusulkan: manifest1MiB, dump/extractedSQL masing256MiB, perlogo2MiB, totalaset256MiB/max10000, connect/lock5s, child120s, overall5min. Batas ini milik alat lokal, bukan kapasitas produk sekolah. Input di-stage privat dan diverifikasi ulang, filehandle bytes yang dihash sama dengan yang dipakai. Tolak duplicate JSON keys/ID/path, symlink/junction/hardlink/ADS/casealias/traversal/extra files. ACL owner+SYSTEM tanpa mengubahACLfolderdata guru. Publication final atomik pada volume sama tanpa overwrite; cleanup harus receipt/canonical/ownership yang terbukti.
8. Restore-test bersifat rehearsal: memulihkan, membandingkan, reset/verifikasi, lalu teardown. Tidak membuat server guru/persisten baru. Dokumentasi harus jelas command create managed belum diuji pada data guru dalam task ini. Operasi nyata/pemulihan produksi/retensi/cloud tetap keputusan terpisah.
9. Verifikasi mengikuti kelompok preflight, utamakan happy roundtrip dan failure yang dapat merusak target/data: snapshot barrier writer/closure, foreign/forged/occupied target, corruption/COPY injection, rollback, ACL/pathswap/cleanup/collision dan finite timeout. Jangan mengganti assert dengan check implementation string saja. Buat milestone roundtrip awal, kemudian negatives. Tes data seluruhkolom dua arah, report efektif/logo hash, serta delta reset. Read-only source sebelum/sesudah harus sama. Uji alat cloud sourcehash tetap, regression hanya yang tersentuh. Jika perlu perubahan helper shared, laporkan sebelum memperluas ownership.
10. Ownership Executor: scripts/local-backup*.mjs, test runner/fixture/support khusus B, tests/local-backup*, docs/local-backup.md dan package scripts/lock jika benar-benar perlu tanpa install. PM memiliki task/status/mirror/report review/Git. Tidak mengubah source produk atau migration lama. Handoff reports/LAB002-OPS-001B-report.md dengan AC expected/observed, commands/exit, artefak/hash sintetis yang aman, remaining/limits dan prosescleanup. Tidak commit/push/deploy/menutup task sendiri.

Next owner Executor implementasi dalam kontrak ini, lalu PM review independen. Jika ada konflik/batas baru di luar delegasi lokal, tahan bagian terkait dan laporkan; jangan memperluas task.

## Keputusan diagnosis ACL — 22 Oktober 2026

Dua variasi subprocess pemeriksa ACL gagal tanpa kemajuan; Executor menahan percobaan dan PM meminta keputusan menurut aturan dua percobaan. Ardy memilih dialog: 'Lanjutkan diagnosis terarah dan perbaikan (Rekomendasi)'. Diizinkan membaca keluaran error pemeriksa pada folder sintetis dan memperbaiki penyebab terbukti dalam task yang sama. Tidak mengurangi perlindungan folder atau mengakses data guru/cloud. Hasil diagnosis dan tes ulang wajib dicatat; task belum diterima.


## Handoff dan review PM

Laporan Executor dan reports/LAB002-OPS-001B-pm-review.md tersedia. PM suite independen14/14PASS exit0. Hasil sintetis diterima teknis; task belum CLOSED karena identitas/privilege managed belum diuji. Tidak ada Executor aktif. Next owner Ardy untuk batas pemeriksaan read-only managed, lalu PM. Implementasi dipertahankan pada develop tanpa push/deploy.

## Keputusan Ardy — kelanjutan ditunda, 22 Oktober 2026

Ardy memilih dialog: 'Cukup simpan hasil sintetis; bahas langkah berikutnya nanti'. Pemeriksaan read-only koneksi/identitas/privilege database lokal aktual tidak dilakukan. Hasil sintetis dan review tersimpan pada commit lokal develop 9ef0d5f. Task ON_HOLD atas pilihan Ardy; hasil teknis sintetis PASS tetap berlaku, kesiapan create managed belum terverifikasi. Tidak ada Executor aktif atau kelanjutan otomatis. Next owner Ardy untuk pembahasan langkah berikutnya. Tidak push/deploy atau akses data guru.

Keputusan lanjutan Ardy22Oktober2026: kaji verifikasi identitas tanpa tambahan hak. Assigned preflight-only /root/ops_backup_preflight, Codex gpt-6.1-sol/medium sesuai pilihan task yang sama. Tidak implementasi sebelum review PM; tidak membaca metadata/data aktual atau mengubah privilege. Output reports/LAB002-OPS-001B-managed-identity-preflight.md.
