# Checkpoint aktif LAB-002 — sesudah SEM

Tanggal: 12 Oktober 2026. Pengerjaan DITAHAN sesuai permintaan Ardy untuk berbicara sesudah LAB002-SEM-001 CLOSED. Tidak ada kelanjutan otomatis atau assignment berikutnya.

## Titik aman

UI001/SET001/UI002/DATA001/AUTH001/STUD001/SEM001 CLOSED. SEM diterima PM melalui delegasi lokal; laporan Executor dan review PM tersimpan. R01 deadlock close/edit membership dan R02 bantuan beranda diperbaiki. Source tidak mempunyai revisi SEM yang menunggu Executor. PM menyiapkan commit lokal perubahan SEM beserta dokumentasi; hash aktual tercatat sesudah commit pada registry.

Root registry D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa; root Git app pada subfolder app, branch master, tanpa remote. Baseline sebelum SEM465f865. Jangan reset/revert pekerjaan. Periksa git status/log untuk commit SEM aktual, jangan memakai baseline STUD sebagai HEAD terbaru.

## Bukti yang tidak perlu diulang tanpa perubahan

PM suite penuh sebelumnya DATA11/AUTH12/STUD-SEM8 exit0; sesudah fix R01 PM test:students final8/8 exit0. Executor full suite/typecheck/build Vercel+Node final lulus. Browser PM desktop1280x900/HP390x844: preview29hari/87sel/83kosong; close eksplisit menjadi arsip; create invalid mempertahankan input; create valid salin2siswa; period mengecualikan membership ditolak dan reload tetap. Browser fixture memakai output sebelum R01/R02; R01 diperiksa HTTP final dan R02 source/typecheck. Batas ini tertulis pada review; bukan tes guru/perangkat fisik.

Migration0003 sudah dibuat dan dites sementara; belum diterapkan pada cluster persisten app/.data/postgres. Sebelum membuka app persisten saat resume: muat env lokal DB dan auth, start hanya cluster proyek, jalankan migrasi versioned menurut README. Jangan ubah migration0001/0002 atau reset data. Cluster persisten tidak diberi data sekolah/kelas/siswa/absensi. Rahasia tetap ignored .data; jangan cetak atau commit.

## Runtime dan ownership

Fixture browser SEM terisolasi pada app/.data/pm-semester-browser-6cade822-f557-4e41-be2d-5e7b597e369b; browser sudah ditutup dan viewport direset. Executor diminta menghentikan hanya PID terdaftar Nuxt3512/PG16 17360, port3101/61138; hasil shutdown dicatat setelah verifikasi. Folder privat dipertahankan, tidak dihapus. Jangan mematikan PID lama tanpa pemeriksaan path/ownership. Tidak ada penulis aplikasi aktif setelah shutdown.

## Resume setelah pembahasan Ardy

Baca checkpoint ini, task/review SEM, local-delivery-contract-v1.md dan bagian dependency backlog. Periksa instruksi/delta yang berubah, jangan ulang setup/desain atau seluruh riwayat. CAL/ATT/IMP/OPS/REP/QA/REL masih ANALYSIS dan belum ditugaskan. PM menentukan readiness setelah keputusan pembahasan. Semua write CAL/ATT/IMP wajib mengikuti urutan lock penutupan dan regresi closed semester pada QA.

Otorisasi lokal tetap: PM mengelola keputusan/detail/assignment/validasi/acceptance/commit; Executor Codex gpt-6-luna/max. PM tidak menulis kode. Tanpa remote/push/cloud/resource/biaya/deploy/data siswa asli. Permintaan berhenti sekarang membatasi kelanjutan sampai Ardy meminta resume.

## Shutdown terverifikasi

Executor menghentikan hanya fixture-owned PID3512/17360 dan memverifikasi port3101/61138 tidak LISTEN. Fixture privat dipertahankan. Tidak ada Executor aktif atau assignment berikutnya.
