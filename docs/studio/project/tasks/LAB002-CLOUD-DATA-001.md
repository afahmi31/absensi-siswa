# LAB002-CLOUD-DATA-001 — Pemindahan data lokal ke Supabase

Tanggal: 13 Oktober 2026. Status: PM_VALIDATION; alat dan revisi R1 lulus pemeriksaan lokal PM, operasi nyata PG17/transfer tetap menunggu pemeriksaan serta izin tersendiri. Next owner PM.

Sumber: Ardy meminta persiapan kompatibilitas, koneksi, serta pemindahan data dilanjutkan setelah koneksi plugin Supabase berhasil. Target tetap project absensi-siswa/jkiewjlohgmsujcwerpi di Singapore. Source aplikasi lokal app/.data/postgres, bukan file Excel diimpor ulang. Jangan mencetak identitas/kredensial/payload audit.

Scope: backup konsisten source, schema/migration baru yang telah diperiksa, role cloud dan privasi akses, transfer baris aplikasi dengan UUID/relasi/audit dipertahankan. Snapshot terbaru harus dibandingkan, bukan mengandalkan jumlah dari handoff lama. Akun guru dan hash dipertahankan; session/cookie dan rahasia sesi lokal tidak dipindahkan. Ledger migrasi cloud menggunakan source checksum yang benar, bukan salinan ledger database lama.

AC: sebelum transfer pastikan target kosong/tidak ada data pengguna lain dan source snapshot konsisten; backup privat dengan restore rehearsal. Role runtime terbatas, TLS CA/hostname valid, no akses anon/authenticated/service_role. Impor atomik hanya ke project ditetapkan, constraint/FK tetap diverifikasi, sequence audit benar, seluruh objek trigger aktif sesudah transaksi dan rollback jika gagal. Audit tidak ditulis ulang seolah impor terjadi pada waktu absensi lama; restore harus mempertahankan audit existing dan tidak menambahkan catatan palsu. Jika guard memerlukan penanganan administratif saat restore, rehearsal dan laporan harus menjelaskan tepat operasi tersebut; tidak melemahkan guard runtime permanen.

PM membandingkan seluruh roster/status/audit antar-source/target secara privat dan output agregat saja. Uji autentikasi dan operasi pada data sintetis terisolasi atau rollback transaksi; jangan membuat catatan fiktif permanen pada kelas guru. Setelah pemindahan, tentukan Supabase sebagai source utama saat URL online diterima agar dua database tidak bercabang. Lokal/backup tetap tersedia untuk pemulihan. Next owner PM setelah PRE-001.

## Handoff tahap lokal

Dependency lokal PRE-001 diperiksa PM: suite data 13/13 dan auth 14/14 diulang mandiri, diff diperiksa, build staging dilaporkan lulus dan metadata Node24 diperiksa. Ini belum penerimaan migrasi PG17. Pilihan Executor memakai delegasi Ardy untuk pengelolaan pekerjaan dengan Codex subagent GPT-6-luna/MAX; tidak mengubah pilihan atau biaya layanan.

Ownership Executor: alat transfer terarah pada scripts/ dan tes pendukung, dokumentasi penggunaan tanpa secret, laporan rehearsal. Baca instruksi/source saat preflight. Tidak merombak auth/runtime atau mengubah migration0001–0006; laporkan jika perubahan diperlukan. Tidak sendirian dalam repo, pertahankan perubahan PRE-001 dan dokumen PM.

Tahap ini hanya membuat alat dan menguji pada dua cluster lokal disposable dengan data sintetis. Backup/source asli hanya dibaca jika diperlukan untuk memahami metadata; jangan mengambil data nyata ke fixture/log atau mengubah source. Tidak menulis cloud, membuat role cloud, menjalankan transfer nyata, mengganti runtime, commit/push atau deploy. Output dan kredensial privat di .data yang dilindungi dan diabaikan Git; guard path, target/ref, role/TLS, target kosong dan konfirmasi write eksplisit diperlukan.

AC alat: snapshot konsisten; allowlist tabel dan urutan FK; UUID/hash akun/audit/sequence dipertahankan, teacher_sessions/schema_migrations/throttle tidak disalin; transaksi restore atomik, USER triggers diaktifkan kembali sebelum commit dan FK tidak dimatikan; comparison seluruh baris secara privat bukan hanya jumlah; error/log tidak membocorkan data/URI/password. Jalankan rehearsal sukses dan rollback kegagalan, penolakan target tak sesuai/tidak kosong, cek audit persis, sesi kosong, constraint dan trigger aktif. Gunakan client PG16 yang tersedia bila kompatibel dengan tahap lokal; jangan pasang PG17 global atau menambah dependency tanpa kebutuhan terverifikasi. PG17 aktual tetap verifikasi operasional terpisah.

Deliverable: alat dengan mode prepare/check/rehearse/import yang jelas atau bentuk lebih kecil setara, panduan operasional/recovery konkret dan laporan hasil aktual. PM meninjau sebelum penggunaan cloud. Eskalasi jika membutuhkan superuser, mematikan FK, mengganti alur data/arsitektur, melemahkan kontrol permanen atau mengubah layanan/biaya. Next owner PM.

Preflight Executor diterima PM untuk implementasi lokal: sebelas tabel data allowlist, snapshot pg_dump data-only, rehearsal dua cluster sintetis, temporary staging tables untuk COPY, insert sesuai FK dengan audit identity dipertahankan, pembandingan EXCEPT ALL, USER triggers dipulihkan dan sequence restart transaksional. Pada Windows jangan memakai pg_restore -f - atau --file=-; capture stdout default setelah perilakunya diuji dengan archive sintetis. Batas cloud/source nyata tetap berlaku.
