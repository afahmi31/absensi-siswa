# Uji lokal Website Absensi Siswa

## Pemeriksaan data guru — 13 Oktober 2026

Data guru sudah dipakai database lokal. Buka http://127.0.0.1:3000 dan masuk kembali dengan akun yang sama. Periksa sekolah/kelas II, semester ganjil 2026/2027 (14 Juli–12 Oktober 2026), 38 siswa, dan tanggal absensi pada periode sumber. PM telah membandingkan 1.900 pasangan melalui API aplikasi, seluruhnya cocok. Detail pada reports/LAB002-LOCAL-DATA-001-pm-review.md.

Pada 28 Juli dan 2 Oktober dipakai kiriman dengan Timestamp terbaru, sesuai pilihan Ardy; formula tabel bulanan file sumber mungkin memilih kiriman pertama. 90 status kosong tetap belum diisi. Hari rutin Senin–Sabtu, libur nasional belum diatur. Semester tetap aktif; untuk mengisi setelah 12 Oktober, perpanjang periode lewat website. Backup dan cluster percobaan lama dipertahankan. Deployment menunggu perbandingan Ardy.

PID historis di bawah tidak lagi menjadi acuan; gunakan app/.data/local-trial-runtime.json dan listener aktual.

Versi uji lokal berjalan pada http://127.0.0.1:3000. Buka alamat itu di Chrome atau Edge pada komputer ini. Server Node24 PID17520 dan PostgreSQL16 proyek port55432 dibiarkan aktif untuk uji Ardy. Bukan URL online dan tidak dapat diakses dari HP lain memakai127.0.0.1.

## Masuk dan mencoba

Email/kata sandi akun lokal ada pada file privat:
D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app\.data\teacher-account.json

Buka file itu pada komputer untuk membaca akun; tidak perlu menyalin kata sandi ke chat. Akun existing dipertahankan, tidak direset. Database persisten tidak diberi seed data sekolah/siswa dari fixture PM.

1. Masuk, lalu isi Data sekolah (sekolah/kelas/zona waktu).
2. Buat Semester yang mencakup tanggal uji hari ini. Tambahkan beberapa siswa melalui Siswa; nama wajib, NIPD/jenis kelamin boleh kosong.
3. Atur Kalender dan tanggal mulai berlakunya hari sekolah. Pastikan tanggal absensi yang dipilih termasuk hari sekolah dan masa siswa terdaftar.
4. Buka Absensi, pilih tanggal. Tandai semua hadir lalu ubah pengecualian H/S/I/A; klik Simpan absensi.
5. Buka kembali/reload dan periksa isian. Coba simpan sebagian, koreksi, kosongkan satu status, dan lihat Riwayat perubahan.
6. Jika mencoba dua tab, perubahan lama harus ditolak bila data sudah berubah. Periksa apakah draft masih terlihat, lalu pilih muat ulang jika ingin membuang draft.

Untuk awal gunakan data contoh. Uji tutup semester hanya pada semester contoh: setelah ditutup tidak dapat dibuka kembali. Laporkan langkah/tanggal/halaman serta hasil yang terlihat jika ada kendala; jangan sertakan kata sandi. Git/commit baru, Supabase dan Vercel baru dibahas setelah Ardy menguji dan menyatakan tidak ada kendala.

## Bukti dan batas

PM test:calendar5/5 dan test:attendance7/7 independen lulus. Executor fullsuite DATA11/AUTH12/STUD-SEM8/CAL5/ATT7, typecheck dan Nodebuild lulus. PM source/API review, kalender laptop+viewportHP, login/API/halaman absensi pada runtime persisten200 selesai. Migration0001/2/3 unchanged,0004 applied tanpa reset; backup privat sebelum0004 tersedia di app/.data/backups.

Browser absensi: PM melihat3siswa eligible kosong, siswa masuk setelah tanggal uji tidak tampil; Tandai semua hadir hanya draft3H sementara tab kedua masih kosong. Percobaan meninggalkan halaman memicu dialog native. Alat CUA tidak dapat menangani dialog itu, sehingga simpan/koreksi/clear/riwayat/conflict dan viewport absensi lengkap belum diterima lewat browser PM, walaupun tesHTTPnya lulus. Bagian tersebut menjadi uji Ardy. Task ATT tetap PM_VALIDATION; tidak mengklaim seluruh AC interaksiPASS atauCLOSED. Laporan PM/Executor mencatat batas ini. Gunakan browser komputer sendiri untuk uji, bukan tab fixture3101 yang tertahan.

ImporExcel, cetak/PDF/logo dan sisa PRDv1 belum tersedia dalam uji ini. Tidak ada cloud, deployment, remote/push atau commit baru.

## Menjalankan ulang jika server sudah berhenti

Jika URL masih terbuka, perintah ini tidak diperlukan. Bila server berhenti, buka PowerShell dan jalankan:

```powershell
Set-Location 'D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app'
$localNode = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$env:PATH = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
& $localNode scripts/local-db.mjs start
& $localNode scripts/db-migrate.mjs up
. .\.data\local-env.ps1
. .\.data\auth-env.ps1
$env:PORT = '3000'
& $localNode scripts/start-node.mjs
```

Jangan jalankan server kedua pada port yang sudah dipakai. Perintah terakhir berjalan di terminal; Ctrl+C menghentikan server. Jangan menjalankan db:rollback, reset, atau menghapus.data untuk memulai ulang. Build Node sudah disiapkan; tidak perlu instal ulang dependency hanya untuk membuka website.

Metadata runtime awal pada app/.data/local-trial-runtime.json; log privat di app/.data/local-trial-runtime/. PID bisa berubah bila server dijalankan ulang; jangan mematikan proses berdasarkan PID lama tanpa memeriksa executable/path.

## Pembaruan hasil uji

13 Oktober 2026: Ardy sudah mencoba alur lokal dan melaporkan tidak ada masalah. Commit lokal diizinkan. Rincian seluruh kasus/perangkat tidak dilaporkan; batas bukti PM di atas tetap berlaku. Vercel/Supabase dan remote/push belum dilakukan.
