# Git, Development, Staging dan Production

PM menyiapkan/merapikan pengelolaan Git dan panduan lingkungan dalam scope proyek yang disetujui. Ardy menjalankan deployment. Pengecualian Vercel mengikuti [workflow aktif](<studio-workflow.md>) dan keputusan khusus Ardy untuk deployment tersebut.

## Riwayat development dan paket server

| Area | Isi dan tujuan |
|---|---|
| Development di Git | Kode, PRD, requirement, flow/state/copy, keputusan, rencana, task, revisi dan catatan pengujian yang perlu ditelusuri. Data sensitif pada bukti harus disamarkan. |
| Paket staging | Versi aplikasi untuk uji server yang disetujui; hanya berkas/dependency yang diperlukan untuk menjalankan dan memeriksa aplikasi di lingkungan tersebut. |
| Paket production | Versi yang disetujui untuk pengguna, kebutuhan runtime dan konfigurasi operasional yang sesuai. |

Dokumen development, laporan pengujian, fixture, alat debug dan dependency development yang tidak diperlukan runtime tidak masuk paket server. Migrasi, aset, konfigurasi aman dan dependency yang diperlukan aplikasi tetap disertakan. Pemilahan berdasarkan kebutuhan aplikasi; jangan menghapus file yang dibutuhkan hanya karena namanya mengandung docs/test.

Dokumentasi development tetap terlacak di Git. Jangan memakai .gitignore untuk membuang dokumentasi yang memang harus disimpan. Secret dan .env berisi kredensial tetap di luar Git/paket publik; contoh konfigurasi memakai nilai contoh yang aman. Log/database/uploads lokal dan output besar tidak otomatis menjadi bahan commit.

## Rencana Git per proyek

Catat root repo kode serta docs, remote jika ada, branch/ref yang digunakan, versi yang akan dirilis, hubungan commit kode/dokumen, cara menghasilkan paket, dan isi yang disertakan/dikecualikan. Jika docs berada di repo terpisah, kedua repo tetap terlacak dan versi terkait ditautkan.

Pemisahan development/staging/production dapat memakai branch/ref dan paket build sesuai proyek. Jangan otomatis membuat tiga repository, menghapus dokumentasi dari riwayat, atau memilih strategi branch besar tanpa keputusan proyek. Paket server yang bersih tidak mensyaratkan hilangnya dokumentasi dari source repository.

PM boleh menyiapkan direktori dokumentasi, memeriksa/merapikan Git dan menulis panduan dalam scope. Perubahan kode/build/deployment configuration yang memerlukan implementasi menjadi task Executor. Git init/branch/commit mengikuti penugasan dan lokasi yang disetujui; izin commit tidak otomatis mengizinkan push. Persetujuan rencana development tidak otomatis mengizinkan remote, push, publication atau deployment.

Sebelum operasi Git, periksa branch, working tree dan perubahan existing. Pertahankan pekerjaan pengguna. Operasi yang menghapus data/riwayat atau force push memerlukan keputusan eksplisit. Root workspace studio tidak harus dijadikan repo baru sebagai efek samping pemeliharaan workflow.

## Lingkungan dan panduan deployment

Development, staging dan production mencatat konfigurasi, layanan, data dan akses masing-masing. Jangan menggunakan data/kredensial production untuk uji lokal tanpa keputusan. Staging dapat diperlukan lebih awal untuk integrasi; PM menjelaskan kebutuhan dan menunggu keputusan Ardy.

Panduan yang diserahkan PM menyebut:

1. Target lingkungan dan versi/ref yang dituju.
2. Prasyarat, konfigurasi tanpa nilai secret, dependency dan kebutuhan data.
3. Cara membangun paket, daftar isi paket dan pemeriksaan bahwa bahan development tidak ikut.
4. Langkah deployment, migrasi jika berlaku dan dampak yang perlu diketahui Ardy.
5. Langkah memeriksa fungsi/health, error handling, monitoring dan alert yang memang dikonfigurasi.
6. Backup/pemulihan atau rollback yang sesuai perubahan, serta kondisi untuk menggunakannya.
7. Bukti hasil setelah deployment dan hal yang belum diperiksa.

Selesainya panduan atau paket tidak berarti deployment telah dilakukan. Hasil lokal tidak membuktikan keadaan server. Checklist keamanan/monitoring menyebut kontrol, pemeriksaan dan batas bukti; jangan mengklaim aman atau terpantau hanya karena dokumen tersedia.

## Tindakan Vercel yang diotorisasi

Ardy menentukan proyek, lingkungan (termasuk preview bila dipakai) dan versi yang boleh dideploy. Periksa integrasi/akses dan instruksi yang tersedia. Jika tidak tersedia, kembalikan panduan dan keterbatasan; jangan mengganti layanan atau membeli akses.

Izin deployment Vercel tidak otomatis mengizinkan perubahan domain, secret, database, layanan berbayar atau infrastructure lain. Ikuti batas instruksi Ardy. Laporan tindakan mencatat sumber approval, versi, target, deployment/URL yang benar-benar dihasilkan, hasil pemeriksaan dan keterbatasan. Laporan coding tetap terpisah; jangan menyembunyikan deployment di balik field Production Actions: NONE.
