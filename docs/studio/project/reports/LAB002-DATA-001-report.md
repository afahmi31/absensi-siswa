# Laporan Executor — LAB002-DATA-001

Tanggal: 12 Oktober 2026  
Status Executor: implementasi dan pemeriksaan lokal selesai; menunggu pemeriksaan PM.  
Target berikutnya: Project Manager melakukan validasi mandiri dan mencatat revisi atau hasil review.  
Production/deployment: tidak dilakukan.

## Hasil

Fondasi persistence DATA-001 tersedia di `app/`: PostgreSQL 16 lokal yang dikelola dengan skrip aman, migration SQL ber-ledger dan checksum, koneksi privat server-only, repository bertipe, fixture sintetis, serta uji invariant database. Tidak ada HTTP bisnis, login, UI bisnis, koneksi cloud, atau data siswa nyata yang dibuat.

Cluster task dibuat di `app/.data/postgres` dari binary `C:\Program Files\PostgreSQL\16\bin`. Pemeriksaan mencatat service Windows `postgresql-x64-16` tetap `Stopped/Disabled` dan `postgresql-x64-18` tetap `Running/Automatic`; keduanya tidak dipakai untuk cluster task. Cluster task hanya melayani `127.0.0.1:55432`, memakai autentikasi password SCRAM-SHA-256 dan role migrator/runtime terpisah. Kredensial acak hanya disimpan di `.data/` yang diabaikan Git dan dibatasi ke akun Windows saat ini serta SYSTEM. Pemeriksaan ignore memastikan metadata, env privat dan direktori cluster tidak terlacak.

Untuk membuktikan migration final pada database persisten, saya memeriksa database task yang baru dibuat dan kosong dari data bisnis, lalu menjalankan rollback dengan flag konfirmasi kehilangan data secara eksplisit dan menerapkan migration lagi. Sesudahnya `db:migrate` melaporkan `Unchanged 0001_core`. `db:smoke` menghentikan dan menjalankan kembali cluster yang sama, memastikan marker sintetis tetap ada, lalu menghapus schema sementara. Cluster task saat laporan ditulis kembali berjalan dan tersedia untuk task berikutnya.

Perubahan R1 yang diminta PM juga dimasukkan ke pemeriksaan: attendance yang berada di luar tanggal membership/semester tidak muncul pada view efektif; tanggal akhir membership tidak dapat dipersempit melewati attendance yang sudah ada; perubahan calendar di semester tertutup ditolak termasuk perubahan catatan; perubahan holiday dan pengecualian seluruh attendance terkait berjalan dalam satu transaksi setelah konfirmasi; pengembalian hari sekolah tidak mengaktifkan status lama, dan input baru untuk membership/tanggal yang sama dapat dibuat sambil mempertahankan baris historis. Helper konteks audit bertipe dapat dipakai di dalam transaksi repository bertingkat dan membawa actor teacher ke tiga event audit perubahan holiday tersebut. Rincian batch/revision/konflik penyimpanan harian tetap menjadi cakupan ATT-001.

## Pemeriksaan dan bukti

Perintah dijalankan dari `app/` dengan Node bundled `24.19.0` dan npm CLI `10.9.3` yang ditentukan proyek. Pada mesin ini, pemanggilan dilakukan lewat `node.exe` runtime bundled dan `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`; saya tidak memakai npm `8.19.4` yang berada di PATH atau memasang dependency global.

| Perintah/pemeriksaan | Hasil |
|---|---|
| `npm ci` | Berhasil; 610 paket dipasang dari lockfile dan `nuxt prepare` selesai. npm menampilkan peringatan bahwa dependency `glob@10.5.0` deprecated. |
| `npm run typecheck` | Lulus setelah revisi R1 dan helper transaksi/audit. |
| `npm run test:data` | Lulus: 6 test (1 suite dan 5 subtest), 6 lulus, 0 gagal. Cluster PostgreSQL 16 sementara dibuat khusus di `.data/tests/` dan dibersihkan oleh test runner. |
| `npm run build` | Lulus dengan preset Vercel lokal; tidak dideploy. |
| `npm run build:node` | Lulus dengan preset Node server lokal. |
| `npm run db:rollback -- --confirm-local-data-loss`, lalu `npm run db:migrate` | Lulus pada database managed task yang telah dipastikan kosong dari data bisnis; hasil `Reverted 0001_core`, `Applied 0001_core`. |
| `npm run db:migrate` | Lulus; hasil `Unchanged 0001_core`, ledger/checksum mengenali migration yang telah diterapkan. |
| `npm run db:smoke` | Lulus; output menyatakan row sintetis bertahan setelah restart dan schema temporer dihapus. |
| `npm run db:status` | Lulus; cluster managed terverifikasi berjalan di `127.0.0.1:55432`. |
| Uji target remote untuk `npm run test:data` | Ditolak sebelum test tersambung; URL contoh `db.example.invalid` tidak diterima sebagai database test. |
| `git diff --check` dan `git check-ignore .data/local-db.json .data/local-env.ps1 .data/postgres` | Tidak ada whitespace error; ketiga path lokal terabaikan Git. Git menampilkan peringatan konversi LF ke CRLF untuk beberapa file Windows. |

Suite mencakup migration up/down/up dan ledger stabil; constraint overlap semester, satu semester aktif, snapshot identitas, nama duplikat/NIPD kosong, tanggal inklusif dan keunikan attendance efektif; inisialisasi aturan kalender lampau tanpa riwayat; konfirmasi holiday, perubahan attendance massal, rollback saat trigger sintetis gagal, dan pencatatan status baru setelah hari sekolah dipulihkan; guard semester tertutup, roster salinan tanpa attendance dan history yang tetap ada; serta actor audit, ketidakberubahan audit, rollback transaksi, penolakan insert audit langsung oleh role runtime, dan redaksi field rahasia dari audit lama/baru.

Kedua build menampilkan peringatan Node `DEP0155` dari dependency `@vue/shared` yang dibawa Nuxt. Build tetap selesai; dependency tersebut tidak diubah sebagai bagian task ini.

## Batas verifikasi

- Ini laporan Executor, bukan validasi independen PM atau approval Ardy.
- Belum ada browser/UAT, route HTTP bisnis, UI absensi, autentikasi/otorisasi, penyimpanan file, deployment Vercel, koneksi production, atau pengujian data nyata.
- Runtime database bersifat lokal dan hanya konek saat repository dipanggil; layar yang ada belum memanggilnya.
- Nilai rahasia lokal tidak disalin ke laporan. Database persisten berisi schema/ledger task, bukan fixture bisnis; seluruh fixture attendance/audit berada pada cluster sementara test.
- `app/.data` perlu dipertahankan untuk koneksi task berikutnya. `db:rollback -- --confirm-local-data-loss` menjatuhkan schema lokal; jangan jalankan kecuali data lokal memang boleh dihapus.

Pemeriksaan berikutnya: PM memeriksa perubahan dan mengulang validasi yang dipilihnya. Setelah review DATA-001, task AUTH-001 dapat memakai repository dan cluster lokal tersebut sesuai dependency/task plan.
