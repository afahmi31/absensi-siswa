# Backlog Delivery LAB-002 v1

Status aktif — 16 Oktober 2026: REP-001C CLOSED, diterima PM melalui delegasi lokal Ardy sesudah review source, browser, unduhan PDF dan runtime hasil build. Laporan PDF bulanan/semester A4/F4/Letter tersedia pada source develop. Lihat [review PM](reports/LAB002-REP-001C-pm-review.md) dan [laporan Executor](reports/LAB002-REP-001C-report.md). Tidak push/deploy atau mengubah website online/data guru. Parent REP-001 tetap terbuka untuk logo privat/arsip logo dan bukti printer fisik. Next owner PM untuk menyiapkan dependency OPS; jangan mengulang task A/B/C atau memulihkan snapshot stop.

## Riwayat kelanjutan — 15 Oktober 2026

Task aktif [REP-001C](tasks/LAB002-REP-001C.md) kini ON_HOLD atas permintaan STOP Ardy. Executor /root/lab002_rep_preflight gpt-6-luna/max sudah berhenti; perubahan parsial empat berkas dipertahankan tanpa commit, belum diverifikasi. [Checkpoint lengkap](reports/LAB002-REP-001C-pause-2026-10-15.md) mencatat salinan kode/hash, kontrak yang sudah diputuskan dan langkah resume. Tidak ada proses aktif atau kelanjutan otomatis. Main/website online tidak disentuh.

Kelanjutan terbaru: REP-001B UI/pratinjau/cetak browser lokal CLOSED berdasarkan delegasi penerimaan PM, setelah pengujian browser dan render tiga ukuran; lihat [review PM](reports/LAB002-REP-001B-pm-review.md). Semester enam bulan dan48siswa menghasilkan12halaman Letter, bulanan2halaman masing-masing ukuran. PDF nyata/logo dan bukti printer fisik tetap belum selesai. Task induk REP-001 tetap terbuka; status draft B dalam riwayat di bawah sudah digantikan hasil ini.

Ardy menyatakan guru sudah melakukan absensi online pada 14 Oktober tanpa masalah yang dilaporkan; lihat [catatan bukti](reports/teacher-pilot-confirmation-2026-10-14.md). Ini tidak menggantikan bukti per AC seluruh task historis.

Ardy meminta kelanjutan pada 15 Oktober. Prioritas PM: laporan bulanan/semester sesuai PRD. [Preflight REP-001](tasks/LAB002-REP-001-preflight.md) dan [REP-001A](tasks/LAB002-REP-001A.md) CLOSED melalui delegasi lokal setelah hasil Executor /root/lab002_rep_preflight, gpt-6-luna/max diperiksa. Model/API read-only lulus suite REP PM independen6/6, typecheck/build kode final; regresi Executor kalender5/5 dan absensi7/7. [Review PM](reports/LAB002-REP-001A-pm-review.md). [REP-001B](tasks/LAB002-REP-001B.md) masih ANALYSIS untuk UI/cetak. Task induk tetap mencakup UI, logo, cetak browser dan PDF, tidak dianggap selesai oleh model saja.

Checkout kerja develop; main rilis bersih tidak diubah. Pengembangan memakai data sintetis dan lingkungan lokal. Tidak ada izin deployment versi baru dari permintaan kelanjutan ini. Catatan status tanggal 12 Oktober di bawah adalah riwayat dan harus dibaca bersama laporan/task yang lebih baru.

Status aktif 12 Oktober 2026: UI001, UI002, SET001, DATA001 dan AUTH001 CLOSED. AUTH diterima PM berdasarkan delegasi lokal Ardy setelah pengujian independen dan browser. Bagian aktivitas lama di bawah dipertahankan sebagai riwayat; status aktif ini dan tabel menjadi acuan. STUD CLOSED; SEM CLOSED melalui delegasi PM; target terbaru uji lokal, CAL diterima teknis dan ATT PM_VALIDATION; runtime lokal aktif menunggu uji Ardy; task fitur setelahnya belum didispatch.

Pemilik: Project Manager. Tanggal: 2026-10-11.
Acuan: [rencana](development-plan-v1.md), [PRD](../../products/PROD-002-product-prd-v1.md), [keputusan terbuka](decisions-and-confirmations.md).

Status merupakan lifecycle protokol. Belum dipilih Executor berarti belum ASSIGNED. AC di bawah merupakan kriteria yang dibuktikan per task; evidence task CLOSED ada pada laporan/review dan local-progress. Uraian planning awal yang belum diperbarui adalah riwayat, bukan status aktif. Task ANALYSIS adalah breakdown konkret awal; PM melengkapi kontrak, path, dependency dan readiness sesudah keputusan yang disebut terpenuhi.

Semua task: satu active owner, scope terisolasi, tanpa production/dependency besar/commit-push yang tidak diotorisasi. PM menjadi active owner sampai assignment nyata. Root codebase/Git aktif berada di app dalam registry; implementasi aktual diperiksa pada preflight setiap task. Tests menggunakan data fiktif. Seluruh perubahan penting mengikuti flow PRD dan keputusan Ardy.

## Peta urutan dan status

| ID | Hasil/tahap | Status | Dependency wajib | Kebutuhan sebelum READY |
|---|---|---|---|---|
| LAB002-UI-001 | Desain login/absensi HP/laptop, design-only | CLOSED | PRD/izin planning sudah ada | Pilihan Executor/platform/model/reasoning sebelum ASSIGNED |
| LAB002-UI-002 | Desain siswa/impor/kalender/semester/laporan, design-only | CLOSED | Arah UI-001 disetujui; C03/C05/C06/C07 terkait | Semantik state utama jelas dan acuan desain tersedia |
| LAB002-SET-001 | Fondasi Nuxt lokal/config DB tanpa koneksi nyata | CLOSED | C01 baseline/C02 path disetujui | Pilihan Executor/platform/model/reasoning; preflight runtime saat assignment |
| LAB002-DATA-001 | Model data, constraints dan arsip | CLOSED | SET-001; C07/C08 | Kontrak perubahan data/audit disetujui; rencana migrasi non-production |
| LAB002-AUTH-001 | Akun khusus/login/logout dan akses | CLOSED | SET-001; C04 | Provisioning/reset/akses/keamanan jelas; desain login disetujui |
| LAB002-STUD-001 | Siswa/masa terdaftar/identitas kelas | CLOSED | DATA-001/AUTH-001; C07; UI-002 terkait | Kontrak batas tanggal/edit identitas, desain disetujui |
| LAB002-IMP-001 | Template Excel/preview/impor | ANALYSIS | STUD-001/SEM-001; C03; paket Excel dipilih | Format/validation/partial commit dan dependency dikunci |
| LAB002-CAL-001 | Hari rutin/pengecualian dan riwayat libur | PM_VALIDATION | DATA-001/AUTH-001/STUD-001/SEM-001; C07 | Kontrak restore libur/keanggotaan/periode; desain disetujui |
| LAB002-ATT-001 | Input harian/parsial/koreksi/riwayat | PM_VALIDATION | STUD-001/SEM-001/CAL-001/AUTH-001; C06/C08; UI-001 disetujui | Save/concurrency/audit jelas; lock kontrak SEM disepakati |
| LAB002-SEM-001 | Semester/penutupan/arsip/salin siswa | CLOSED | DATA-001/AUTH-001/STUD-001; C07/C08; UI-002 terkait | Data/report boundary jelas; lock backend dan closure confirm |
| LAB002-REP-001 | Tabel bulan/semester, browser/PDF | ANALYSIS | ATT-001/SEM-001/CAL-001/OPS-001; C05; UI-002 disetujui | Paket/render PDF dipilih, aturan blank/pagination jelas |
| LAB002-OPS-001 | Penanganan gangguan dan cadangan/pemulihan | ANALYSIS | STUD-001/SEM-001/DATA-001/AUTH-001; C04/C08 | Owner/retensi/akses disetujui; hanya non-production |
| LAB002-QA-001 | Regression integrasi lintas modul dan paket evidence | ANALYSIS | AUTH/STUD/IMP/CAL/ATT/SEM/REP/OPS | Modul selesai teknis dan kontrak aktif; fixture/repro steps |
| LAB002-REL-001 | Paket runtime dan panduan rilis/rollback | ANALYSIS | Versi hasil QA/uji/review; keputusan target/ref | Target versi/build disetujui; tanpa deploy otomatis |

Urutan aktif untuk UI fitur: STUD → SEM → CAL → ATT. IMP dan OPS sesudah STUD/SEM; REP sesudah ATT/SEM/CAL/OPS. Satu penulis aplikasi per tahap. SEM menguji closure menggunakan fixtures DATA; QA mengulang seluruh endpoint yang tersedia sesudah closure. Urutan ini menggantikan urutan planning awal dan tidak mengurangi AC.

## Kontrak task tahap mendatang

### LAB002-UI-002 — Pengelolaan dan laporan

Objective/scope: rancangan siswa/impor, kalender, semester dan report preview dengan bahasa guru. Out of scope: code, real data, aturan yang belum diputuskan.
AC-01: flow/state mengikuti keputusan C03/C05/C06/C07 yang sudah disetujui; nama sama ditambah/lewati, penutupan belum lengkap dikonfirmasi.
AC-02: laporan memuat struktur/logo/ukuran kertas/keluaran PRD; tidak menambah tanda tangan atau penanda kosong.
AC-03: rancangan HP/laptop beserta peta interaksi dan batas visual tersedia.
Verification: Executor self-check artefak; PM cocokkan PRD/keputusan; approval arah Ardy sebelum UI implementasi. Risiko: semantik report/arsip belum dipilih. Next owner saat ini: PM.

### LAB002-SET-001 — Setup lokal

Objective/scope: aplikasi minimal lokal pada lokasi/stack/database yang disetujui, script build/check/run dan konfigurasi contoh tanpa secret. Out of scope: fitur bisnis, target server, install global tak diizinkan.
AC-01: runtime/paket/lockfile/commands actual dicatat; aplikasi minimal berhasil dijalankan dan dibangun di lingkungan lokal yang ditetapkan.
AC-02: starter tidak mengekspos pendaftaran publik; konfigurasi contoh aman dan data lokal tidak masuk Git.
AC-03: struktur repo/code/docs sesuai keputusan C02; operasi Git yang dilakukan sesuai izin, tidak ada push.
Verification: Executor menjalankan checks stack actual; PM membaca diff/output/local prerequisites. Risiko: stack/runtime/path belum dipilih. Next owner: PM.

### LAB002-DATA-001 — Model data/arsip

Objective/scope: model konseptual diterjemahkan menjadi skema dan constraints termasuk siswa, keanggotaan/periode, kalender, absensi efektif dan riwayat. Out of scope: production migration atau mengubah arti periode yang belum disetujui.
AC-01: nama sama/NIPD kosong dapat dibedakan; satu record efektif per siswa/tanggal; status/batas periode valid sesuai kontrak.
AC-02: desain snapshot/riwayat menjaga identitas dan absensi periode lama saat daftar periode baru berubah.
AC-03: migrasi/rollback non-production diuji dengan fixture; tidak kehilangan data yang harus dipertahankan.
Verification: uji constraints/migrasi/arsip Executor dan review PM. Risiko: perubahan data dan audit; C07/C08 belum dipilih. Next owner: PM.

### LAB002-AUTH-001 — Akses guru

Objective/scope: akun khusus, login/logout, session dan proteksi seluruh data/output. Out of scope: register publik, Google login, multi-user atau reset yang belum disetujui.
AC-01: guru dapat masuk/keluar; akses unauthenticated ke halaman/write/report ditolak sesuai kontrak.
AC-02: upaya masuk/input invalid dan sesi kedaluwarsa ditangani tanpa membocorkan secret/detail akun.
AC-03: provisioning/reset mengikuti C04; tidak ada jalur signup/fitur auth ekstra tanpa requirement.
Verification: tests auth/authorization/security server Executor/PM; alur nyata login dua perangkat Ardy. Risiko: security HIGH, C04. Next owner: PM.

### LAB002-STUD-001 — Kelas dan siswa

Objective/scope: metadata sekolah/logo/kelas, tambah/edit siswa, masa terdaftar dan pilihan data periode. Out of scope: banyak kelas, hapus riwayat, migrasi daftar otomatis.
AC-01: hanya nama wajib; NIPD/JK optional; nama sama tidak overwrite siswa berbeda.
AC-02: tanggal masuk/keluar memenuhi C07 dan kewajiban absensi; identitas arsip lama tetap.
AC-03: validasi/logo/storage dan empty/error/success sesuai kontrak tanpa kehilangan input yang dijanjikan.
Verification: test validation/keanggotaan/arsip dan PM review; penggunaan siswa/logo Ardy. Risiko: identitas historis dan upload; C07. Next owner: PM.

### LAB002-IMP-001 — Impor Excel

Objective/scope: unduh template, upload/preview, keputusan baris nama sama, commit dan feedback kegagalan. Out of scope: mapping file arbitrary, sync spreadsheet langsung, overwrite otomatis.
AC-01: template dan kolom mengikuti C03; nama wajib; baris invalid/nama sama ditampilkan sebelum commit.
AC-02: setiap nama sama memerlukan tambah berbeda/lewati; tidak merge/overwrite tanpa keputusan guru.
AC-03: file invalid/ukuran/parser error/commit berulang ditangani menurut kontrak; hasil tidak menghasilkan siswa ganda secara tak sengaja.
Verification: fixtures Excel valid/error/nama sama/optional fields Executor/PM; workflow impor Ardy. Risiko: file parser/data; C03/paket. Next owner: PM.

### LAB002-CAL-001 — Kalender

Objective/scope: hari rutin, hari sekolah khusus/libur, konfirmasi perubahan berabsensi dan audit. Out of scope: integrasi kalender eksternal atau perubahan semester tertutup.
AC-01: kewajiban hari sekolah mengikuti routine+exception dan masa terdaftar/periode; libur tidak menjadi Alpa.
AC-02: perubahan berabsensi menjadi libur memerlukan confirm, riwayat tetap, record lama excluded dari rekap.
AC-03: restore libur dan perubahan aturan mengikuti C07; tidak ada status lama aktif otomatis tanpa keputusan.
Verification: tests tanggal/exception/riwayat Executor/PM; interaksi kalender Ardy. Risiko: perubahan makna data; C07. Next owner: PM.

### LAB002-ATT-001 — Absensi harian

Objective/scope: tanggal, status H/S/I/A, tandai hadir, perubahan pengecualian, simpan parsial dan koreksi sebelum tutup. Out of scope: offline/autosave/mata pelajaran.
AC-01: membuka layar tidak mencatat hadir; batch/parsial menghasilkan status efektif benar dan count belum diisi; simpan sukses bukan hanya perubahan UI.
AC-02: failure/navigation/concurrency mengikuti C06; tidak silent overwrite; riwayat koreksi sesuai C08.
AC-03: backend menolak write periode tertutup/tanggal di luar kewajiban sesuai kontrak; total valid dan tidak ganda.
Verification: tests transaction/status/locks/conflict Executor/PM; HP/laptop dan parsial nyata Ardy. Risiko: concurrency/data HIGH, C06/C08. Next owner: PM.

### LAB002-SEM-001 — Semester

Objective/scope: periode, pemeriksaan kelengkapan, tutup manual dan buat periode baru dari salinan/daftar baru. Out of scope: buka kembali periode, mengubah arsip tertutup.
AC-01: tanggal/ganjil-genap/tahun ajaran mengikuti kontrak C07; closure masih boleh saat incomplete dengan konfirmasi eksplisit.
AC-02: periode tertutup hanya baca/cetak; semua write relevan ditolak server, bukan hanya UI.
AC-03: salin daftar masih terdaftar atau daftar baru tidak mengubah identitas/absensi arsip lama; count incomplete menggunakan kewajiban yang benar.
Verification: tests closure/copy/arsip/regression dengan ATT Executor/PM; flow semester Ardy. Risiko: irreversible closure/data; C07/C08. Next owner: PM.

### LAB002-REP-001 — Laporan

Objective/scope: model laporan bulan/semester, layout/logo, browser print dan unduh PDF ketiga ukuran mendatar. Out of scope: tanda tangan, penanda incomplete report, data tambahan tak dipilih.
AC-01: rekap S/I/A tepat dari data efektif; incomplete kosong tidak menjadi A; aturan C05 untuk libur/di luar periode diterapkan identik browser/PDF.
AC-02: semua siswa/periode relevan tersedia dan pagination tidak kehilangan kolom/baris; format struktur/logo dan ketiga ukuran sesuai PRD.
AC-03: output hanya diakses guru; gagal generate direspons sebagai gagal tanpa sukses palsu/data leak.
Verification: fixtures total/pagination/periode dan render PDF Executor/PM; browser dan hasil cetak nyata Ardy menurut verification-plan. Risiko: perhitungan/layout/paket; C05. Next owner: PM.

### LAB002-OPS-001 — Gangguan dan pemulihan

Objective/scope: konfigurasi logging/health, akses output/storage, cadangan dan uji restore non-production sesuai keputusan. Out of scope: server/credential/deploy production atau pembelian layanan.
AC-01: gangguan utama tercatat tanpa secret/PII yang tidak diperlukan; kontrol akses/storage mengikuti kontrak auth.
AC-02: backup/restore data+logo benar pada lingkungan non-production yang diotorisasi; interval/retensi/owner sesuai C08.
AC-03: panduan gangguan/pemulihan menyebut batas evidence dan tindakan Ardy; tidak mengklaim produksi dipantau jika belum dikonfigurasi.
Verification: checks log/health/access dan restore drill Executor/PM; keputusan operasional Ardy. Risiko: kehilangan data/security; C04/C08. Next owner: PM.

### LAB002-QA-001 — Regression lintas modul

Objective/scope: jalankan suite integrasi terkait R01–R15, cek actual diff/data contract, dan paket langkah uji Ardy. Out of scope: klaim UAT/acceptance atau memperbaiki bug di luar task tanpa PM.
AC-01: seluruh skenario teknis verification-plan yang wajib punya output/expected; failure dipetakan ke AC dan owner task.
AC-02: nama sama, batas tanggal, libur, parsial, closure, arsip dan rekap lintas modul konsisten.
AC-03: paket evidence/versi/prasyarat/script fixture/skema uji Ardy jelas; pending browser/print tetap pending.
Verification: Executor suite non-production dan PM review independen; issue diturunkan menjadi revisi task asal atau follow-up. Risiko: dependencies/regression; seluruh modul. Next owner: PM.

### LAB002-REL-001 — Paket/panduan rilis

Objective/scope: build paket runtime/panduan target/ref/health/backup/rollback. Out of scope: deploy/domain/secret/server changes/push tanpa keputusan.
AC-01: package berisi kebutuhan runtime dan tidak kehilangan migrasi/aset/dependency yang dipakai; bahan development tetap di Git source bukan paket server.
AC-02: panduan mereproduksi build dan pemeriksaan/rollback untuk target/versi yang disetujui tanpa membocorkan secret.
AC-03: keterbatasan evidence/hasil uji/review dan production action sebenarnya tercatat; tidak menganggap paket berarti deployed.
Verification: inspect package/build dan simulasi non-production sesuai target; PM meninjau evidence; Ardy mengambil keputusan deploy. Risiko: target/env belum dipilih. Next owner: PM.

## Aktivitas pengujian dan review setelah implementasi

Aktivitas berikut belum task Executor READY dan tidak didispatch otomatis:

- Uji Ardy/guru: jalankan [skenario](verification-plan.md), rekam perangkat/browser/versi/expected-observed serta cetak fisik. Task fitur yang menunggu bukti wajib tetap PM_VALIDATION. PM memeriksa hasil/revisi lalu menyiapkan final review.
- Review Product Manager: cocokkan goal, flow, UX/copy dan bukti PRD; kesimpulan perlu revisi/bukti belum cukup/layak uji publik bukan izin publish. Temuan kembali kepada PM.
- Keputusan Ardy: approval hasil/closure/deployment/publikasi terpisah. Brief branding baru disiapkan bila hasil review memadai dan diminta; tidak menjadi fitur aplikasi atau kewajiban publish otomatis.

## Readiness dan rekomendasi sekarang

UI-001 memenuhi Definition of Ready untuk **artefak desain saja** pada folder docs yang diketahui. Task ini tidak perlu stack/database/production/codebase. AC, verification, constraint/area dan dependency ada pada [spec](tasks/LAB002-UI-001.md). Ardy telah memilih Codex subagent gpt-6.1-sol/high; task ASSIGNED dengan handle /root/lab002_ui001. ACK dan preflight diterima PM; hasil desain dan verification belum tersedia.

Task lain berstatus ANALYSIS karena dependency/keputusan belum selesai. Belum ada task selesai, approval desain, test lulus, code atau environment siap. PM akan meninjau readiness lagi setelah C01–C08 dan evidence dependency terkait tersedia.

Pembaruan UI-001: sembilan visual diterima dan diperiksa PM; READY_FOR_ARDY_REVIEW, approval Ardy belum tersedia. [Review PM](reports/LAB002-UI-001-pm-review.md). Tidak ada task implementasi didispatch.

Approval terbaru: UI-001 APPROVED oleh Ardy dan CLOSED setelah validation PM; Sumber: jawaban dialog Ardy “Setujui arah desain”, 11 Oktober 2026. Persetujuan hanya arah login dan absensi harian HP/laptop; bukan assignment implementasi. Task lain tetap ANALYSIS; belum didispatch.

## Target Vercel dan evaluasi stack — 11 Oktober 2026

Vercel ditetapkan Ardy sebagai hosting. C01 sedang dievaluasi ulang melalui [perbandingan Nuxt/Vue dan Laravel](stack-vercel-comparison.md); Laravel belum digantikan. Setup/implementation yang bergantung pada stack tetap menunggu keputusan. UI-001 sudah CLOSED dengan approval desain; tidak terpengaruh evaluasi ini. Provider database/storage, paket, biaya dan izin deploy belum ditetapkan.

## Keputusan aktif setelah perbandingan

Keputusan aktif: Nuxt/Vue full-stack dalam satu aplikasi, hosting Vercel. Sumber: jawaban dialog Ardy “Ganti ke Nuxt/Vue full-stack (rekomendasi PM)”, 11 Oktober 2026. Menggantikan pilihan Laravel + Inertia/Vue sebelumnya karena target hosting. Versi/runtime, database, auth, storage, paket Excel/PDF dan biaya belum dipilih. Tidak memberi izin setup/assignment/deploy. Desain UI-001 APPROVED/CLOSED tetap acuan. Semua pernyataan evaluasi/pilihan sebelumnya di atas adalah riwayat. SET-001 tetap ANALYSIS.

## Baseline SET-001 — keputusan 11 Oktober 2026

Sumber: dua dialog lokasi/database, kemudian penyedia/baseline. Ardy menyetujui root app di folder registry, salinan terarah docs development dalam repo dan Git init lokal; commit/push tetap terpisah. App belum ada saat diperiksa PM.
Nuxt 4 stabil + TypeScript, Node 24, npm/lockfile dan aplikasi minimal tanpa login/absensi/Excel/PDF disetujui. Rekomendasi patch Nuxt 4.6.1 diperiksa sumber resmi; preflight wajib kompatibilitas.
Supabase dipilih untuk PostgreSQL; pemilihan Auth/Storage, provisioning/reset/akses C04 dan backup C08 tetap terbuka. Tidak ada layanan dibuat, region/plan/biaya/kredensial ditetapkan.
[SET-001](tasks/LAB002-SET-001.md) READY untuk fondasi lokal/config placeholders tanpa koneksi DB nyata. Tidak ASSIGNED. Provider credentials/ORM/schema bukan dependency scope ini, tetap dependency DATA/AUTH/OPS terkait. C02 path/Git lokal APPROVED; remote/branch strategy/commit/push belum diotorisasi.

## Approval dan closure SET-001 — 11 Oktober 2026

Ardy menjawab dialog “Setujui hasil setup lokal”. APPROVED untuk hasil fondasi lokal yang diperiksa PM. Task CLOSED karena seluruh deliverable/AC setup selesai dan tidak ada delivery action tersisa. Tidak memberi izin commit/push/deploy, koneksi layanan, atau assignment task berikutnya. Next owner PM untuk merinci readiness DATA-001/AUTH-001 dan keputusan terkait. Pernyataan pending review sebelumnya merupakan riwayat sebelum approval ini.

Aktif 12 Oktober: DATA-001 ASSIGNED /root/lab002_data001 gpt-6-luna/max. [Kontrak lokal](local-delivery-contract-v1.md) memutuskan C03–C08 melalui delegasi PM. Root repo app lokal saja.

Pengerjaan lokal ditahan atas permintaan Ardy12Oktober. UI002/DATA001 CLOSED dengan acceptance PM; AUTH001 ON_HOLD, belum selesai/commit. Task berikut tetap ANALYSIS dan tidak didispatch.



## Dependency aktif untuk seluruh delivery lokal

12 Oktober 2026, PM memperjelas urutan sesuai bagian “Urutan delivery lokal setelah DATA validated” dalam rencana: STUD → SEM → CAL → ATT. IMP sesudah STUD/SEM; OPS sesudah STUD/SEM menyediakan logo sebelum REP. REP menunggu ATT/SEM/CAL/OPS. QA menunggu semua modul dan mengulang pemulihan pada schema akhir; REL menunggu QA. Satu penulis aplikasi pada satu waktu. SEM memakai fixture DATA untuk closure sebelum UI ATT tersedia; pengujian lintas endpoint setelah closure tetap wajib pada QA. Tidak ada lingkaran ATT↔SEM; dependency lama diuraikan sebagai riwayat, tabel terbaru menjadi acuan.

STUD sudah ASSIGNED /root/lab002_stud001 Luna/max setelah preflight siap. Detail brief lanjutan sedang dirapikan; task tersebut belum READY/ASSIGNED. C06 draft kosong dan revisi hari memperjelas koreksi menurut delegasi lokal, tanpa menghilangkan riwayat.

## Prioritas pra-rilis guru online — 12 Oktober 2026

Ardy memilih URL Vercel HP/laptop, Supabase baru paket gratis, langsung data siswa sebenarnya. Acuan prioritas aktif: pre-release-teacher-pilot.md. CAL kemudian ATT didahulukan; laporan/impor ditunda dari pra-rilis, PRD lengkap tetap. Kesiapan online/login/backup minimum serta QA wajib sebelum akses guru. Resource/target deployment belum tersedia; tidak ada deploy/biaya/remote/push pada keputusan ini.


## Target terbaru: uji lokal dahulu

Ardy meminta aplikasi siap diuji pada komputer lokal. Acuan aktif local-trial-priority.md. CAL lalu ATT dilanjutkan dengan Executor Luna/max; online Vercel/Supabase dan pembahasan Git ditunda sampai hasil uji Ardy. Tidak ada commit baru, remote/push/deploy/cloud. Setelah alur absensi lokal siap, PM menyerahkan URL/runtime/panduan uji dan menunggu hasil Ardy.
