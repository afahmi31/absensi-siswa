# Pemeriksaan read-only managed — OPS-001B

22 Oktober 2026, PM. Ardy mengizinkan menyalakan cluster lokal lalu pemeriksaan read-only identitas/privilege melalui dialog. Tidak mengizinkan grant, dump, migrasi atau perubahan data bisnis.

Startup awal memakai log ops-start.log di dalam data_directory. PG sedang recovery setelah shutdown lama dan melaporkan sharing violation terhadap file log itu. PM menghentikan hanya cluster proyek secara fast/graceful, memindahkan hanya file log baru milik operasi ke .data/ops-start-first-20261022.log, lalu menyalakan kembali dengan log .data/ops-start-20261022.log di luar data_directory. Startup kedua exit0. Ini kesalahan penempatan log PM yang sudah dikoreksi, bukan perbaikan schema/data. Recovery otomatis PostgreSQL berlangsung sebagai bagian startup; tidak menjalankan SQL migrasi atau perbaikan manual.

Probe transaksi READ ONLY, statement timeout5s: role lab002_migrator; database lab002_local; host127.0.0.1; port55432; server_version_num160013; rolsuper=false; pg_has_role pg_read_all_settings=false. current_setting(data_directory) pada transaksi read-only terpisah ditolak SQLSTATE42501. Tidak membaca baris siswa/absensi/akun, tidak mencetak metadata rahasia/URI/password. Koneksi probe sudah ditutup. Cluster proyek dibiarkan menyala sesuai izin Ardy; tidak menjalankan server web.

Kesimpulan: kendala guard managed sekarang terbukti, bukan hanya inferensi source. Cadangan belum dibuat; hasil sintetis14/14 tetap. Task BLOCKED pada jalur managed, next owner Ardy untuk pilihan pendekatan verifikasi identitas tanpa hak tambahan versus pembahasan hak lokal. Tidak memberikan grant/mengurangi guard atau mengubah kode. Tidak push/deploy/cloud.
