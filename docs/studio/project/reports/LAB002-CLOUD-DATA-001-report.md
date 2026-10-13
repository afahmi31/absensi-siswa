# LAB002-CLOUD-DATA-001 — Laporan Executor

Tanggal: 13 Oktober 2026. Status: implementasi alat dan rehearsal sintetis lokal selesai; menunggu pemeriksaan PM. Tidak ada import cloud.

## Hasil

Disiapkan alat transfer dengan mode `prepare`, `check`, dan `import`, serta rehearsal lokal terpisah. Snapshot menyertakan hanya sebelas tabel aplikasi yang disetujui dan menolak perubahan bentuk schema atau checksum migrasi. Target harus memakai project/Session Pooler, role migrasi khusus, PostgreSQL 17, schema/ledger yang tepat, ACL/RLS yang aman, trigger aktif, foreign key tervalidasi, dan tabel aplikasi, sesi, serta throttle kosong. URI dan TLS diperiksa dengan CA serta nama host; artifact dan SQL sementara hanya berada pada folder `.data` yang dibatasi ACL.

Restore menyalin ke tabel sementara dalam satu transaksi, mempertahankan ID/relasi/hash/audit/sequence, tidak memindahkan sesi, ledger migrasi, atau throttle, dan membandingkan seluruh baris sebelum commit. USER trigger dipulihkan sebelum commit, FK tidak dimatikan, dan kegagalan menggulung balik transaksi.

## Perubahan

- `app/scripts/cloud-data-transfer-core.mjs` — validasi target/source, snapshot/manifest privat, guard target, susunan SQL restore, komparator seluruh baris, dan runner PostgreSQL.
- `app/scripts/cloud-data-transfer.mjs` — perintah prepare/check/import dengan guard project dan konfirmasi tulis.
- `app/scripts/test-cloud-data-transfer.mjs` — rehearsal dua cluster disposable dengan data sintetis.
- `app/docs/cloud-data-transfer.md` — panduan tahap, persyaratan, dan pemulihan.

## Pemeriksaan

Pada Node.js 24.19.0, `scripts/test-cloud-data-transfer.mjs` lulus untuk dua rehearsal PostgreSQL 16 disposable: ledger tepat 0001–0006 ke 0001–0006, dan baseline source 0001–0004 ke target 0001–0006. Masing-masing memindahkan 11 tabel dengan 49 baris sintetis. Rehearsal membuktikan pemuatan manifest dengan ledger source/target terpisah, penolakan source ledger parsial tak disetujui dan target ledger lama, perbandingan baris penuh, sequence audit, trigger aktif, FK tervalidasi, sesi/throttle sintetis tidak disalin, rollback atomik pada data attendance invalid, serta penolakan import ulang ke target yang sudah berisi data. Guard URI dengan project salah atau TLS yang dilemahkan juga ditolak.

Pemeriksaan sintaks Node 24 dan whitespace pada seluruh file transfer yang berubah lulus. `git diff --check` juga lulus. Tidak ada dependency baru.

## Batas bukti dan langkah berikut

Tidak ada query pada data guru, backup source nyata, koneksi ke target cloud, penulisan cloud, penggantian runtime, staging build, commit, push, atau deploy dari task ini. Rehearsal PostgreSQL 16 bukan bukti perilaku pada PostgreSQL 17. `check` dan `import` belum dijalankan terhadap cloud; uji dua cluster tidak menggantikan pemeriksaan target dan pembandingan privat oleh PM. PM perlu meninjau perubahan alat serta panduan terlebih dahulu, lalu menentukan langkah operasional cloud sesuai otorisasi yang berlaku.

## Revisi setelah pemeriksaan PM

PM menemukan bahwa ledger source nyata yang diperiksa secara read-only berisi tepat migration 0001–0004, sedangkan target telah memakai 0001–0006. Pemeriksaan awal mengharuskan source dan target sama-sama memiliki ledger penuh saat ini, sehingga alat akan menolak snapshot source tersebut. Pemeriksaan itu kini memisahkan ledger source yang disetujui dari ekspektasi target: checksum baseline source 0001–0004 dipatok dan diverifikasi terhadap file migration saat ini; source penuh 0001–0006 hanya diterima sebagai set lengkap untuk mempertahankan rehearsal lama. Ledger/manifest target tetap harus cocok tepat dengan seluruh migration 0001–0006 terkini. Ledger lama tidak dipindahkan.

Rehearsal kedua membangun database source sintetis dari salinan privat runner serta hanya migration 0001–0004 tanpa mengubah migration aplikasi, lalu mentransfer fixture tertutup ke target sintetis 0001–0006. Kedua rehearsal lulus. Tidak ada query atau mutasi pada source guru nyata, cloud, atau runtime.
