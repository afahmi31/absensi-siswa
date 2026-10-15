# Acuan lanjut LAB-002 — uji lokal absensi

Status aktif — 16 Oktober 2026: OPS-001A CLOSED melalui penerimaan PM lokal setelah resume dengan GPT-6.1 Sol/low sesuai pilihan Ardy. Logo sekolah privat dan snapshot logo arsip selesai diuji lokal; lihat reports/LAB002-OPS-001A-pm-review.md. Tidak push/deploy atau perubahan data guru/cloud. Parent OPS masih terbuka untuk cadangan/pemulihan aset; integrasi logo laporan adalah tahap REP berikut. Provider storage production dan runtime Linux Vercel belum disiapkan/diverifikasi. Checkpoint STOP sebelumnya adalah riwayat; jangan restore atau mengulang A.

Checkpoint STOP historis, sudah di-resume dan diselesaikan: [STOP REP-001C — 15 Oktober2026](reports/LAB002-REP-001C-pause-2026-10-15.md). Status ON_HOLD atas permintaan Ardy; tidak ada proses aktif/kelanjutan otomatis. Empat berkas parsial disimpan tanpa commit, belum diverifikasi. Bagian lain di bawah adalah riwayat dan bukan instruksi melanjutkan selama stop.

## Izin GitHub — 13 Oktober 2026

Ardy menyampaikan data lokal sudah masuk dan aman, lalu meminta commit perubahan serta push ke https://github.com/afahmi31/absensi-siswa.git. Plugin GitHub memverifikasi repo publik, kosong, default branch main dan izin push tersedia. Remote origin diarahkan ke repo tersebut; branch publik main menggunakan riwayat lokal yang sudah ada, tanpa force push. Status operasi aktual diperiksa lewat Git setelah push. Data asli, database, backup, env dan script privat tetap di luar Git. Deployment Vercel/Supabase tetap menunggu pembahasan terpisah.

## Data guru sudah tersedia lokal — 13 Oktober 2026

Task LAB002-LOCAL-DATA-001 READY_FOR_ARDY_REVIEW: database percobaan diganti sesudah backup atas pilihan Ardy, cluster lama dipertahankan di app/.data/postgres-trial-20261013. Aplikasi http://127.0.0.1:3000 kini memakai 38 siswa dan 50 tanggal riwayat guru, 14 Juli–12 Oktober 2026, semester tetap aktif; kalender Senin–Sabtu dan libur diatur guru. PM HTTP membandingkan 1.900 pasangan seluruhnya cocok (1.810 terisi/90 kosong). Lihat reports/LAB002-LOCAL-DATA-001-pm-review.md. Akun sama, masuk ulang bila sesi lama dicabut. Perlu memperpanjang periode jika mengisi sesudah 12 Oktober. Data asli/backup/scripts tetap privat ignored. Runtime PID berubah; baca metadata aktual, jangan memakai PID historis di bawah. Deployment ditunda sampai Ardy membandingkan. Jangan ulang pemindahan atau menghapus titik pemulihan.

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

## Commit lokal selesai — 13 Oktober 2026

Commit: 682ace90364bcfc7d0b9491ce197268c24fffc7f — feat(attendance): add local calendar and daily attendance flow. Mencakup45file kalender/absensi/tes/dokumentasi dan catatan uji alur Ardy. Repo app bersih setelah commit; tidak ada remote/push/deploy. Nilai privat yang diperiksa tidak ditemukan pada staging. Snapshot dokumentasi di commit dibuat sebelum hash ini ditambahkan pada registry; git log menjadi acuan hash aktual.

## Titik lanjut online — 13 Oktober 2026

Bagian ini menggantikan batas/status historis di atas untuk pekerjaan sekarang. Data guru sudah dipindahkan ke database lokal dan diterima secara umum oleh Ardy; acuan rinci LOCAL-DATA-001 beserta review/panduan. Baseline Git terbaru main 2ac5cdb4b3f8ff365b57235c6417d8a5754b2f09; remote yang disetujui https://github.com/afahmi31/absensi-siswa.git. Ardy sudah mengizinkan commit/push. Jangan mengulang impor Excel atau memindahkan sesi perangkat ke cloud.

Ardy meminta persiapan Supabase/Vercel dilanjutkan. Project Supabase absensi-siswa/jkiewjlohgmsujcwerpi terverifikasi sehat PG17.11, publictables dan migrationhistory masih kosong pada pemeriksaan terbaru. Credential owner privat dan sertifikat CA tersedia; TLS/password serta transaksi/savepoint Session pooler berhasil diuji. Ardy memilih Session pooler satu koneksi per instance. Role aplikasi/migrator khusus belum dibuat. Jangan menaruh owner credential pada runtime/Vercel atau mencetak nilainya.

PRE-001: implementasi lokal diserahkan Executor dan pemeriksaan lokal PM PASS, status PM_VALIDATION. PM mengulang data13/13 dan auth14/14; typecheck/build staging dilaporkan PASS dan metadata nodejs24.x diperiksa. Source masih WIP belum commit. Runtime lokal login HTTP200 pada pemeriksaan terakhir dan masih build sebelumnya; jangan mengganti output aktif. Acuan reports/LAB002-PRE-001-pm-validation.md dan addendum reports/LAB002-PRE-001-preflight.md.

Task aktif CLOUD-DATA-001 ASSIGNED kepada handle online_preflight, Codex GPT-6-luna/MAX, tahap alat transfer/rehearsal lokal saja. Ownership scripts/tests/docs alat transfer; PM menangani registry/sync/Git. Tidak ada write cloud, transfer data nyata, deploy atau commit/push oleh Executor. Baca task dan delta laporan terlebih dahulu; jangan menduplikasi worker atau mengulang PRE-001 jika source tidak berubah. Setelah alat diserahkan, PM review guards/atomisitas/preservasi audit dan seluruh baris sebelum operasi PG17/transfer aktual.

Deployment Vercel tetap menunggu versi dan target konkret sesuai workflow. Project Vercel belum dibuat/tertaut dalam tahap ini. Source lokal/backup tetap dipertahankan sampai penerimaan data dan URL online; jangan menjalankan dua sumber data aktif tanpa keputusan cutover. Checkpoint ini mencatat posisi, bukan permintaan menghentikan pekerjaan yang sedang diizinkan.

## Snapshot Git dan keputusan cloud yang menunggu

Commit PRE-001: 6569819cd8463b644d14bca679643c6c94cfb587, sudah push main; hash remote diverifikasi melalui plugin GitHub. Snapshot mencakup fondasi Supabase/throttle, tes, dokumen/handoff dan .gitattributes agar newline migrasi konsisten. Salinan dokumentasi 66 berkas mempunyai hash copy yang cocok. Ini belum mencakup alat CLOUD-DATA-001 yang sedang dikerjakan.

Dialog menunggu keputusan Ardy untuk membuat role aplikasi/migrator, membatasi akses public/API dan menerapkan migration0001–0006 pada target Supabase yang ditetapkan dari commit tersebut. Belum izin transfer data nyata atau deployment Vercel. Executor tetap mengerjakan alat lokal sambil menunggu; PM belum menjalankan write cloud. Baca jawaban dialog dan delta worker sebelum tindakan berikutnya.

## Persiapan Supabase yang diizinkan berhasil

Ardy menyetujui role/skema0001–0006 dari commit6569819 melalui dialog. Bootstrap berhasil; migrator/app khusus dengan kredensial privat dan APIpublic dibatasi. CLI precheck42883 diperbaiki oleh Executor melalui helper JSONB; PM menguji positif/negatif padaPG17 dan check/up berhasil. Keenam migrasi diterapkan sebagai migrator, SQL tetap byte-identik dengan commit diizinkan. Seluruh tabel aplikasi/view dapat dibaca oleh app-role dan kosong; ledger ditolak42501. Tidak ada transferdata/deployment.

Commit koreksi dan laporan cloud d559e45348887ad83fb435683521539f60921224 sudah push main. Source report reports/LAB002-PRE-001-cloud-schema.md mencatat hasil dan advisors. Securityadvisor menyisakan19fungsi search_path unset; append_row_audit_event sudah pinned, sehingga20fungsi total. Perbaikan forward0007 belum dibuat/diizinkan untuk cloud. INFO ledgerRLS/no-policy disengaja. Platform rls_auto_enable EXECUTEAPI sudahdicabut, warningterkait hilang. Alat CLOUD-DATA masih WIP milik online_preflight, jangan commit/menjalankannya sebelum laporan dan PMreview. Sourceguru lokal dipertahankan.

## Revisi transfer lulus pemeriksaan PM

CLOUD-DATA-001 status PM_VALIDATION, tahap alat lokal PASS. PM mengulang Node24 rehearsal6→6 dan4→6: sebelas tabel/49baris sintetis setiap jalur, exit0. R1 pemisahan source/target ledger selesai; jangan mengubah database guru untuk menyamakan ledger. Report PM mencatat batas operasi nyata PG17/backup/data belum dilakukan.

SEC-001 disiapkan READY tahap lokal untuk migration0007, pin19fungsi search_path dan regresi TEMP relation; fungsi audit sudahpinned tetap. Sesuaikan guardtransfer target7 dan rehearsal4→7 tanpa source nyata/cloudwrite. Pilihan Luna/MAX mengikuti delegasi lokal, actualassignment dicatat ketika dikirim. Izin cloud lama hanya0001–0006; perlu izin terpisah setelah SQL7/commit konkret diperiksa. Jangan ulang PREbootstrap atau importExcel, jangan menulis cloud/teacherdata dari tools WIP.

## Snapshot alat transfer dan assignment penguatan

Commit1629d92f8038afbbf35eba5b2b426084a9a0146e sudahpushmain danhashGitHubdiverifikasi. Alat/revisiR1/panduan/tes/report PM tersimpan, tidakada transferguru/cloudwrite. SEC-001 kiniASSIGNEDonline_preflight Luna/MAX lokalonly, baselinecommit1629d92, newmigration7 danrehearsal4→7. PMreviewsebelumizincloud7; janganmengulang tooltransfer6yangsudahPASSkecuali guardtargetbaru/regresiyangdiminta. Owner Executor source/tests, PMregistry/sync/Git. Rootwaitinghasilpreflight/laporan, bukanberhentiatauclosuretask.

## Transfer nyata selesai
Ardy mengizinkan restore rehearsal snapshot nyata lalu transfer jika lulus. Rehearsal privat PG16 dan pembandingan penuh11tabel source PASS; targetPG17check/import atomik dan pembandingan penuhcloud PASS. Supabase kini38siswa1810absensi1947audit,sesi0. Backup/source tetap. Report reports/LAB002-CLOUD-DATA-001-transfer-result.md. Jangan importulang atau lanjutdeploy tanpa target/versi konkret. Periksa delta source sebelum cutover online; tidak ada deployment.


## Main bersih / develop lengkap
Ardy menyetujui polaGit mainrilisbersih developlengkap. Remote main7bf0dd3928ac0ead865cf9ce42bde0722103fae7 berisi64file runtime/build, remote developf114192c0f69734be0d5d3323db5320cc36f945c menyimpan docs/tes/alat/generator. Checkoutapp tetapdevelop, workingtreebersih. Config npm10.9.3wrapper install/builddiMain, cleaninstall/buildstagingPASS runtimeNode24. RemoteVercelretrybelumdiverifikasi, oldlog16167b9npm11tidakmewakilibaru. Report REL-CLEANPMreview. Jangan merge developlangsungmain atau checkoutmain diapp.data. TransferSupabase sudah38/1810/1947, envVercelbelumdipasang.

# Checkpoint aktif — 15 Oktober 2026

Ardy meminta melanjutkan task setelah konfirmasi penggunaan absensi online oleh guru pada 14 Oktober. Pilot tetap pada versi online terakhir yang tercatat c16bd4f. Tidak ada push/deploy/data cloud yang diubah pada kelanjutan ini.

PM menerima preflight REP-001. Executor /root/lab002_rep_preflight, Codex worker gpt-6-luna/max, mengerjakan model/API REP-001A pada develop. Suite laporan Executor dan PM independen 6/6; Executor melaporkan kalender5/5, absensi7/7, typecheck dan build Vercel PASS. PM memeriksa source read-only/owner/metadata dan output rute laporan runtime24/sin1. Lihat reports/LAB002-REP-001A-pm-review.md dan laporan Executor.

REP-001B kini CLOSED melalui delegasi PM: halaman /reports, nav, pilihan mode/periode/kertas, pratinjau dan cetak browser lokal telah diperiksa. Executor yang sama menyerahkan laporan dan typecheck/build final PASS; PM memeriksa browser1440/390/320, empty/error/stale/hydration serta keluaran A4/F4/Letter masing-masing2halaman untuk48siswa; semester6bulan12halaman Letter. Review reports/LAB002-REP-001B-pm-review.md. Tidak ada push/deploy/data cloud berubah.

Next owner PM: siapkan PDF nyata dan logo privat/snapshot arsip; task induk laporan belum selesai. Jangan mengulang transfer data guru atau checkout main pada direktori app. Implementasi berikutnya tetap lokal/data sintetis sesuai delegasi; deployment memerlukan target/versi yang disetujui terpisah. Fixture laporan sintetis ditutup setelah validation; bila perlu mengulang jalankan npm run fixture:reports dengan Node24, akun baru hanya untuk data sintetis ditampilkan oleh runner. Jangan memakai data guru pada fixture.

Catatan checkpoint lama di bawah dipertahankan sebagai riwayat, bukan instruksi aktif bila berbeda dari checkpoint ini.
