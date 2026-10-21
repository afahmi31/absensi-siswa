# Verifikasi operasional terbatas — OPS-001B

22 Oktober 2026. PM /root. Sumber otorisasi Ardy: dua jawaban dialog 'Lanjut probe identitas read-only lokal' dan 'Izinkan verifikasi dan stop cluster sintetis itu'. Baseline app develop34f7b95 bersih. Tidak assignment Executor baru atau perubahan kode.

## Probe guard managed aktual

PM memanggil managedSource untuk validasi metadata existing dan pg_ctl status, lalu membaca URI privat hanya dalam memory. Satu transaksi READ ONLY, statement timeout5s/idle60s, policy fixed .data/postgres,127.0.0.1:55432,lab002_local/lab002_migrator. beginManagedIdentity dan verifyManagedIdentity memakai helper final yang diuji sebelumnya; keduanya PASS, exit0. Koneksi ditutup. Metadata rahasia/URI/password tidak dicetak. Tidak query baris siswa/absensi/akun/logo, ledger/digests, migration, dump, grant atau backup. Ini membuktikan guard pengganti dapat membaca/mencocokkan identitas managed pada konteks Windows ini tanpa tambahan hak, bukan pembuktian backup data guru aktual.

## Pemulihan stop cluster sintetis lama

Target fixed .cache/local-backup-tests/cluster-65203884-22df-4637-8672-2871aaba5e4d/pg. PM memverifikasi dua kali root canonical/no-link/dev/ino, PG_VERSION16, postmaster.pid regular/hash/PID12840/epoch1792617467/port61450, pg_ctl status, CIM creation2026-10-21T21:17:47.3090050Z, executable PG16, Windows argv exact -D root -c config_file=root/backup-config.conf, dan satu listener127.0.0.1:61450 milikPID12840. Kedua snapshot identitas exact sama dan cocok laporan run gagal. Commandline hanya di memory; tidak diterima berdasar substring/namafolder/PID saja.

Atas izin pemulihan receipt lama yang spesifik itu, jalankan pg_ctl -D target -m fast -w -t30 stop. Exit0, postmaster.pid hilang; pemeriksaan OS sesudahnya menunjukkan0listener pada61450. Folder root tetap ada. Tidak recursive delete atau taskkill/process kill global; tidak mengubah cleanup guard pada tool.

Managed pg_ctl status sesudahnya tetap running, PID14384 dengan -D app/.data/postgres. Database guru tidak distop/restart. PID ini observasi saat laporan, bukan handle yang boleh dipakai tanpa verifikasi ulang kelak.

## Keputusan dan batas

Gabungan evidence: suite final Executor20/20, suite PM independen20/20, source hashes0mismatch dan probe identity-only aktual PASS. Revisi guard diterima secara teknis. OPS-001B READY_FOR_ARDY_REVIEW; tidak mengklaim CLOSED/approval akhir dari probe saja. Parent OPS/provider backup production/retensi/restore persisten tetap scope terpisah. Backup data guru belum dibuat; itu memerlukan keputusan owner tersendiri sebelum create membaca data privat. Tidak perlu mengulang suite tanpa perubahan source.

Tidak push/deploy/cloud/migration/grant atau perubahan kode/data bisnis. Startup managed dari izin sebelumnya tetap hidup. Tidak ada Executor aktif. Salinan build/acl-debug dan folder sintetis stopped lama retained ignored. Next owner Ardy untuk keputusan hasil task atau langkah operasional berikutnya; PM menyimpan checkpoint dan commit dokumentasi lokal.
