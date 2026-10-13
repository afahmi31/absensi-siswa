# Acuan lanjut LAB-002 — uji lokal absensi

Status aktif: Ardy melaporkan alur lokal tanpa kendala pada 13 Oktober 2026 dan mengizinkan commit lokal. Node17520 pada3000 dan managedPG55432 aktif. CAL diterima teknis; ATT PM_VALIDATION dengan browsersebagian. Commit lokal diizinkan; remote/push dan Vercel/Supabase menunggu pembahasan terpisah. Lihat local-trial-guide.md dan reviewATT.

## Checkpoint SEM sebelumnya (riwayat)

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


## Commit selesai

Commit lokal SEM: ecee50ecc3de87bcd6a2e3344d0d3ef4d6e21bad. Repo app bersih sesudah commit; tidak ada remote. Snapshot Git checkpoint dibuat sebelum hash ini ditambahkan pada registry. Pengerjaan tetap ditahan, tanpa assignment berikutnya.


## Arah terbaru setelah pembahasan

Stop sesudah SEM telah selesai. Ardy meminta pra-rilis absensi online Vercel, Supabase baru gratis, data siswa sebenarnya. Persiapan dan delivery independen dilanjutkan sesuai pre-release-teacher-pilot.md; tidak ulang task CLOSED. CAL menjadi task berikut, cloud/deploy menunggu target/ref/akses konkret.


## Target terbaru: uji lokal dahulu

Ardy meminta aplikasi siap diuji pada komputer lokal. Acuan aktif local-trial-priority.md. CAL lalu ATT dilanjutkan dengan Executor Luna/max; online Vercel/Supabase dan pembahasan Git ditunda sampai hasil uji Ardy. Tidak ada commit baru, remote/push/deploy/cloud. Setelah alur absensi lokal siap, PM menyerahkan URL/runtime/panduan uji dan menunggu hasil Ardy.

## Titik lanjut sesudah handoff

Jangan mengulangsetup ataufixture lama. Baca hasil ujiArdy, reviewATT dan gitdiff WIP CAL/ATT. Commitbaselineecee50e; perubahanbaru belumcommit sesuaiArdy. Source final dikompilasiNode, runtimeaktif denganmetadata privat. TidakmenyatakanATT CLOSED. Tindaklanjuti kendalaArdy perrevision, atau bahasGit/online setelahujiterima. No otomatisassignmentfitur lain.
## Hasil uji Ardy dan izin commit lokal — 13 Oktober 2026

Ardy: “commit dulu saja. aku sudah coba untuk flow tidak ada masalah”. Ardy melaporkan uji alur lokal tanpa kendala dan memberi izin commit lokal. Tidak ada rincian skenario/perangkat yang dilaporkan, sehingga catatan ini tidak menyatakan setiap kasus konflik409, kegagalan jaringan atau dialog telah diuji satu per satu. Bukti teknis dan batas uji browser PM sebelumnya tetap dipertahankan.

PM memeriksa 18 file runtime yang berubah terhadap snapshot final fixture ATT: semuanya sama. Tidak ada perubahan kode untuk commit ini dan tidak perlu mengulang suite hanya untuk pencatatan/Git. Commit mencakup kalender, absensi harian, migration0004, regresi penambahan siswa/penutupan semester, tes dan dokumentasi. Rahasia, database, backup, log runtime dan hasil build tetap di luar Git. Tidak ada izin remote/push atau deployment dari pesan ini.
