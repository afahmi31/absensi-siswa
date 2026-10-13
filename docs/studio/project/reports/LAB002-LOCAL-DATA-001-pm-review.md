# Pemeriksaan PM — pemindahan data guru lokal

Tanggal: 13 Oktober 2026. Status: READY_FOR_ARDY_REVIEW. Tidak menyatakan persetujuan hasil pemeriksaan Ardy.

Ardy mengizinkan pemindahan daftar siswa dan riwayat Excel ke lokal, memilih Timestamp terbaru pada dua tanggal ganda, hari rutin Senin–Sabtu, periode mengikuti sumber, serta penggantian data percobaan setelah backup. Deployment menunggu perbandingan Ardy.

Hasil: database guru kini dipakai aplikasi lokal pada http://127.0.0.1:3000. Semester ganjil 2026/2027 tetap aktif, 14 Juli–12 Oktober 2026. Tidak ada libur nasional yang ditambahkan; guru mengatur melalui website. Awal keanggotaan mengikuti awal semester karena sumber tidak memuat tanggal masuk/keluar. Untuk mengisi setelah 12 Oktober, periode perlu diperpanjang.

Pemeriksaan teknis:

- Backup database percobaan 93.246 byte dibuat, dipulihkan pada lingkungan terpisah dan dibandingkan terhadap seluruh tabel public pada rehearsal kandidat. Pemeriksaan tambahan tepat sebelum pengalihan tidak dipakai sebagai bukti: argumen pg_restore --file=- menghasilkan file literal bernama '-' pada Windows. PM memindahkan file tersebut ke .data privat tanpa membaca/mencetak isinya. Executor melaporkan tidak mengubah database lama sebelum pengalihan; cluster lama juga dipertahankan utuh. Tidak mengklaim pembandingan tambahan itu lulus.
- PM menjalankan verifier kandidat secara mandiri: exit 0, roster/gender/snapshot, status absensi, marker sumber JSONB object dan hash sumber cocok. Akun login dipertahankan; sesi perangkat tidak disalin sehingga masuk ulang diperlukan. Role bootstrap nonaktif dan akses loopback/SCRAM diperiksa.
- Setelah pengalihan, PM menjalankan pemeriksaan melalui HTTP aplikasi yang terautentikasi: dua halaman roster berisi 38 siswa cocok nama/NIPD/jenis kelamin, 50 tanggal menghasilkan 1.900 pasangan cocok seluruhnya. 1.810 status terisi: H 1.659, S 103, I 24, A 24. 90 status kosong tetap kosong.
- Halaman absensi, siswa, semester dan kalender mengembalikan HTTP 200. Ini pemeriksaan HTTP/API, bukan klaim pemeriksaan tampilan browser atau uji guru.
- Runtime akhir diperiksa melalui executable proses pada port 3000: bundled Node 24.19.0. PM mengulang pencocokan HTTP seluruh 1.900 pasangan setelah restart Node 24; hasil tetap PASS. Port PostgreSQL persisten 55432, port fixture 55433/55434 nonaktif.
- Tidak ada perubahan kode aplikasi/build, remote/push/resource cloud/deployment. Data siswa, script privat, backup dan cluster tetap ignored di app/.data atau file privat Downloads.

Titik pemulihan: backup app/.data/backups/LAB002-LOCAL-DATA-001-before-transfer-20261013.dump dan cluster lama app/.data/postgres-trial-20261013 dipertahankan. Pengalihan menggunakan cluster baru, tidak menonaktifkan guard untuk menghapus audit lama. Scratch pertama disimpan nonaktif setelah ditemukan encoding marker JSON yang salah; hasil itu tidak dipromosikan. Kandidat baru diperiksa dengan encoding object yang benar sebelum dipakai.

Riwayat sumber dipetakan ke audit sistem pada waktu pemindahan aktual. Timestamp kiriman dan baris sumber dipertahankan dalam marker provenance per tanggal, bukan dipakai untuk memalsukan waktu pencatatan aplikasi. Script satu kali menolak target yang sudah ada; tidak mengklaim fitur impor umum atau retry idempotent sudah tersedia.

Next owner: Ardy membandingkan data melalui website dengan sumber, khusus dua tanggal ganda mengikuti pilihan kiriman terbaru (28 Juli dan 2 Oktober), bukan formula laporan sumber yang dapat memilih kiriman pertama. PM menangani selisih jika ditemukan. Pembahasan deployment baru dilanjutkan setelah hasil pemeriksaan Ardy.

## Respons Ardy sesudah handoff

13 Oktober 2026: Ardy menyampaikan “oke sih sudah aman data sudah masuk” lalu menanyakan penambahan siswa baru melalui flow yang ada. Ini mencatat penerimaan hasil pemindahan lokal secara umum; tidak menambahkan klaim skenario/browser/perangkat yang tidak dilaporkan. Ardy kemudian mengizinkan commit perubahan dan push proyek ke repo afahmi31/absensi-siswa. Izin Git tidak mencakup deployment Vercel atau migrasi Supabase.
