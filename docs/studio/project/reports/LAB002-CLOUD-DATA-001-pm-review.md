# CLOUD-DATA-001 — Pemeriksaan PM dan revisi pertama

13 Oktober 2026. Hasil kesiapan transfer aktual: REVISION_REQUIRED. Executor selesai pada tahap alat/rehearsal sintetis; ini belum penerimaan PM atau izin import cloud.

PM membaca laporan, panduan, source guard ledger dan kondisi repo. PM mengulang rehearsal Node24 pada dua cluster PG16 disposable: PASS, sebelas tabel/49 baris sintetis, rollback serta penolakan target non-kosong. Database guru/cloud tidak menjadi target rehearsal.

Temuan R1: source lokal nyata diperiksa baca-saja dan ledger berisi tepat0001–0004. Target Supabase sudah0001–0006 sesuai izin Ardy. verifySourceLedger mensyaratkan semua migration di source kode; manifest kemudian mensyaratkan ledger sama dengan target. Dengan kondisi nyata ini prepare ditolak. Rehearsal sebelumnya menguji source dan target sama-sama enam migration, sehingga belum mencakup transisi aktual.

Expected: source baseline0001–0004 diterima hanya bila semua checksum tepat, target tetap seluruh migration yang sudah diperiksa dan checksum tepat, shape/data tabel transfer tetap dibandingkan ketat. Pisahkan metadata ledger sumber dan target; jangan menyalin ledger. Tambahkan rehearsal4→6 sintetis dan pertahankan kasus6→6/rollback/nonempty/ACL. Unknown ledger atau schema tidak boleh dilonggarkan.

Larangan: jangan menerapkan migration5/6 pada source guru sebagai jalan pintas, mengganti output/runtime, membaca data nyata menjadi fixture, atau menulis cloud. Runtime lokal aktif masih build sebelumnya dan perubahan hak akun dapat memengaruhi login build tersebut. SQL migration lama tidak diubah.

Revision diserahkan kepada online_preflight dengan pilihan Executor existing GPT-6-luna/MAX; pemilik berikut Executor untuk revisi, PM untuk pemeriksaan ulang. Tooling belum commit/push dan transfer cloud belum diizinkan. Persiapan penguatan19fungsi search_path melalui migration tambahan serta deployment tetap langkah terpisah setelah artefak konkret diperiksa.

## Pemeriksaan ulang revisi R1

PM memeriksa source ledger baseline yang dipatok, pemisahan sourceMigrations/targetMigrations pada manifest, guard checksum/shape target dan guard transaksi restore. Guard target tidak diperlonggar menjadi menerima prefix sembarang. Pembandingan dua arah EXCEPT ALL, pemulihan USER triggers dan sequence transaksional dipertahankan. Password client PostgreSQL hanya melalui environment privat, sementara output tool/error disaring dan artefak diproteksi ACL.

PM mengulang scripts/test-cloud-data-transfer.mjs dengan Node24.19.0: PASS, exit0, source6→target6 dan source4→target6, masing-masing sebelas tabel/49 baris sintetis; rollback, manifest invalid dan target tidak kosong tetap diuji. SQL migration0001–0006 tidak diubah. Runtime/database guru dan cloud tidak menjadi target pengujian.

Keputusan PM: tahap alat/rehearsal lokal PASS; temuan R1 selesai. Status task PM_VALIDATION karena AC operasi nyata PG17, backup source nyata/restore rehearsal, perbandingan data guru dan pemindahan cloud belum diperiksa/dijalankan. Tidak mengklaim task CLOSED atau memberi izin import. Next owner PM untuk persiapan operasional; Executor tugas penguatan fungsi lokal terpisah sebelum meminta izin migration tambahan. Dokumen/alat disimpan terarah di Git setelah pemeriksaan snapshot.
