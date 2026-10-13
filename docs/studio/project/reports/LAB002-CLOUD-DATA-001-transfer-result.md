# Hasil pemulihan snapshot dan transfer nyata

13 Oktober 2026. Ardy mengizinkan pemeriksaan pemulihan snapshot nyata, lalu transfer langsung jika tidak ada masalah. Target tetap Supabase absensi-siswa/jkiewjlohgmsujcwerpi. Snapshot privat snapshot-20261013T090150Z-8b1a7f9f-d817-4ae2-bb18-f79881b18980.json,3844baris/11tabel.

PM memulihkan archive ke cluster PG16 sementara privat dengan migration1–7. Target guard, restore satu transaksi, FK aktif, USER triggers diaktifkan kembali, sequence dan pembandingan penuh internal lulus. Sesudah restore, PM membandingkan JSONB canonical seluruh baris di11tabel dengan database lokal aktual, hanya di memori privat: seluruhnya sama. Sumber tidak berubah sebelum cloudimport. Cluster rehearsal dihentikan dan dibersihkan melalui helper ownedpath; archive asli tetap tersedia.

TargetPG17 diperiksa kosong/ledger7/ACL/RLS/shape/TLS sebelum write. Restore cloud sebagai lab002_migrator melalui psqlclient memakai CAverify-full dan password environment, satu transaksi dan guard yang sama. Sesudah commit seluruh baris11tabel dibandingkan lagi dengan baseline source: PASS. Siswa38, absensi1810, audit1947, sesi0. Hash akun/UUID/relasi/audit dipertahankan tanpa dicetak. Tidak memindahkan ledger lokal atau throttle/sesi perangkat.

Hasil operasi: PASS exit0. Database lokal/source dan snapshotbackup dipertahankan. Ini belum uji login/runtimeVercel atau UATguru. Jangan importulang target berisi data; jika membutuhkan pemulihan tinjau baseline/target terlebih dahulu. Perubahan source lokal setelah snapshot tidak otomatis sinkron ke cloud; sebelum cutoverURL lakukan pemeriksaan perubahan lagi dan tentukan sumber utama bersamaArdy. Tidak ada deploymentVercel.

Next owner PM untuk mencatat Git/dokumentasi dan menyiapkan target/versi/envdeployment konkret; Ardy untuk keputusan deployment dan UAT setelah smoke. Tidak menyatakan seluruh proyekCLOSED.
