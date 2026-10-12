# Rencana Development — Website Absensi Siswa v1

Pemilik: Project Manager (PM), diperankan agent utama dalam chat produk
Tanggal: 2026-10-11
Kondisi: Nuxt/Vue full-stack dan hosting Vercel dipilih; UI-001 CLOSED, desain disetujui; setup belum READY.

## Acuan dan posisi proyek

Penugasan planning: pesan Ardy “Gunakan peran Project Manager dan jalankan planning dari handoff LAB-002”, 11 Oktober 2026. PM menerima [handoff](<product-to-pm-handoff.md>) pada chat yang sama; tidak ada dispatch subagent PM. Persiapan/Labs sudah disetujui pada [registry](<README.md#persetujuan>).

Source of truth kebutuhan: [PRD R01–R15](<../product/PROD-002-product-prd-v1.md>) dan [riwayat keputusan produk](<../product/PROD-002-website-absensi-siswa.md>). Keputusan teknis dan rincian baru mengikuti [daftar konfirmasi](<decisions-and-confirmations.md>), bukan asumsi implementasi.

Instruksi berlaku: [AGENTS](<../governance/instructions.md>), [workflow](<../governance/studio-workflow.md>), [keputusan workflow](<../governance/workflow-decisions.md>), seluruh [protokol](<../governance/pm-executor-handoff-protocol-v1.0.md>), [copy](<../governance/user-facing-copy.md>), dan [Git/lingkungan](<../governance/git-and-environments.md>). Tidak ditemukan AGENTS/AGENT tambahan di folder LAB-002 saat planning.

Root docs: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa`. Codebase belum ditentukan; belum ada aplikasi, dependency terpasang, test suite, repo aplikasi atau runtime aplikasi yang diperiksa. Root studio bukan Git menurut pemeriksaan registry. Dokumen planning tersedia lokal; belum terlacak melalui commit Git.

Stack: Nuxt/Vue full-stack dalam satu aplikasi; hosting Vercel. [C01](<decisions-and-confirmations.md#c01--stack-aplikasi>) memuat approval penggantian Laravel. Versi/runtime, route, skema, database/auth/storage dan paket Excel/PDF belum dikunci.

## Peta dokumen

| Dokumen | Peran |
|---|---|
| PRD dan catatan produk | Tujuan, flow dan pilihan Ardy; PM tidak menggantikan requirement |
| Rencana ini | Cakupan sampai hasil v1, dependency, aturan lintas bagian |
| [Backlog task](<tasks.md>) | ID/status, scope/AC, dependency dan readiness tiap task |
| [Konfirmasi](<decisions-and-confirmations.md>) | Pilihan, rekomendasi, dampak dan owner keputusan |
| [Rencana verification](<verification-plan.md>) | Skenario/bukti yang diperlukan dan pemiliknya |
| [Task desain READY](<tasks/LAB002-UI-001.md>) | Kontrak siap dipilih Executor untuk design-only |
| [Pilihan assignment](<tasks/LAB002-UI-001-assignment.md>) | Pilihan Ardy, handle dispatch dan pengembalian hasil |

## Hasil versi dan batas

Satu guru/satu kelas mengabsen online dari HP/laptop; data siswa disiapkan lewat template Excel/tambah/edit; kalender/semester/riwayat terjaga; laporan bulanan/semester dicetak atau diunduh PDF. Hasil tercapai setelah bukti teknis, uji Ardy dan review produk tersedia sesuai AC, bukan karena rencana/task dibuat.

Batas fitur mengikuti PRD. Tidak menambah multi-guru/sekolah, mata pelajaran, QR/GPS, WhatsApp, portal orang tua, nilai/rapor, pembayaran, sinkronisasi spreadsheet langsung, offline, autosave atau buka kembali semester. Tidak memasukkan data siswa dari PDF referensi sebagai seed/data uji.

## Pemetaan requirement ke flow, task dan bukti

| Requirement | Flow/state/copy utama | Area/kontrak konseptual | Task | Pemeriksaan/pemilik bukti |
|---|---|---|---|---|
| R01 | Masuk → data pribadi guru; satu kelas; HP/laptop | Akun/sesi/akses | SET-001, AUTH-001, UI-001, UI-002 | Akses/sesi: Executor/PM; penggunaan dua perangkat: Ardy |
| R02 | Unduh template → unggah → periksa → impor; nama sama ditambah/lewati | Siswa, import preview/commit | DATA-001, STUD-001, IMP-001 | Validasi/impor: Executor/PM; penggunaan: Ardy |
| R03 | Tanggal masuk/keluar; kewajiban absensi hanya selama terdaftar | Keanggotaan kelas-periode | DATA-001, STUD-001, ATT-001, REP-001 | Batas tanggal dan riwayat: Executor/PM |
| R04 | H/S/I/A; libur/belum diisi berbeda dari Alpa | Status dan kewajiban harian | CAL-001, ATT-001, REP-001 | Perhitungan: Executor/PM; keterbacaan: Ardy |
| R05 | Belum diisi → tandai hadir → ubah → simpan; parsial boleh | Input, hasil simpan, konflik | UI-001, ATT-001 | State/transaction: Executor/PM; kenyamanan HP/laptop: Ardy |
| R06 | Hari rutin/pengecualian; tanggal berabsensi jadi libur setelah konfirmasi | Kalender/audit/rekap | CAL-001, ATT-001, REP-001 | Riwayat dan exclusion: Executor/PM |
| R07 | Koreksi sebelum ditutup; riwayat perubahan | Koreksi/audit | ATT-001, SEM-001 | Perubahan sebelum/sesudah: Executor/PM |
| R08 | Tahun ajaran, ganjil/genap, batas tanggal oleh guru | Periode | DATA-001, SEM-001 | Batas/validasi: Executor/PM |
| R09 | Tutup manual → hanya lihat/cetak | Lock periode | SEM-001, REP-001 | Penolakan write backend: Executor/PM; flow: Ardy |
| R10 | Belum lengkap → konfirmasi → tutup | Closure | SEM-001 | Konfirmasi dan lock: Executor/PM; uji Ardy |
| R11 | Struktur/logo, siswa × tanggal, rekap S/I/A | Model laporan/layout | UI-002, REP-001 | Total: Executor/PM; bentuk cetak: Ardy |
| R12 | Semester → kumpulan tabel bulan | Filter periode/komposisi output | REP-001, SEM-001 | Pemilihan periode: Executor/PM; hasil: Ardy |
| R13 | A4/F4 21,6×33/Letter mendatar, cetak/PDF | Render output | UI-002, REP-001 | PDF/render: Executor/PM; browser/print fisik: Ardy |
| R14 | Data belum diisi berupa sel kosong; tidak masuk Alpa | Laporan incomplete | ATT-001, REP-001 | Tidak ada penanda tambahan: Executor/PM/Ardy |
| R15 | Semester baru: salin daftar terdaftar/daftar baru; arsip tetap | Snapshot/keanggotaan periode | DATA-001, SEM-001 | Arsip sebelum/sesudah: Executor/PM; flow: Ardy |

## Modul dan kontrak lintas bagian

Ini model konseptual untuk planning, bukan skema/API yang sudah disetujui atau dibangun:

- Akun dan sekolah/kelas: identitas guru dan logo; data hanya terkait satu akun/satu kelas aktif sesuai v1. Cara provisioning/reset/akses operator menunggu C04.
- Siswa: identitas internal harus membedakan nama sama meskipun NIPD kosong; jangan memakai nama sebagai kunci update. Riwayat identitas periode lama harus tetap, cara teknis dipilih setelah C01/C07.
- Periode dan keanggotaan: semester/tanggal masuk-keluar membatasi kewajiban; aturan batas inklusif dan perubahan periode masuk C07.
- Kalender: hari rutin + pengecualian tanggal; status libur bukan absensi. Perubahan berabsensi menjadi libur menghasilkan riwayat dan exclusion rekap. Pengembalian menjadi sekolah menunggu C07.
- Absensi: satu catatan efektif per siswa/tanggal; status hanya H/S/I/A atau belum diisi. Simpan sebagian dan operasi batch tidak boleh membuat catatan ganda. Penanganan konflik/update/atomicity dirinci setelah C06.
- Riwayat: perubahan status/kalender/closure harus dapat ditelusuri sesuai R06/R07; field/retensi/akses menunggu C08. Catatan riwayat tidak dihitung sebagai catatan efektif.
- Impor: template kolom tetap → preview valid/error/nama sama → commit keputusan guru. Tidak overwrite/merge otomatis. Kolom/partial commit menunggu C03.
- Laporan: satu aturan pemilihan data yang sama untuk browser/PDF; hitung S/I/A dari status efektif dan kewajiban relevan, tidak dari sel kosong. Jangan menjumlahkan riwayat sebagai absensi aktif.

Kontrak implementasi harus mencantumkan input/output, validasi, status/error, otorisasi, transaksi, concurrency, serta copy pengguna. Route dan tabel aktual ditentukan hanya setelah pilihan stack dan keputusan terkait; jangan membangun API terpisah tanpa kebutuhan/approval.

## State dan copy sejak development

| Area | Keadaan yang perlu ditangani | Copy/tindakan |
|---|---|---|
| Login | Belum masuk, isian wajib, kredensial tidak cocok, sedang masuk | Email, Kata sandi, Masuk; pesan ringkas tanpa membocorkan keberadaan akun; reset bukan otomatis fitur |
| Daftar siswa | Kosong, tambah/edit, kesalahan nama | Belum ada siswa; Tambah siswa/Impor Excel; Nama siswa wajib diisi |
| Absensi | Belum diisi, perubahan belum tersimpan, menyimpan, berhasil, gagal | Tandai semua hadir/Simpan; jumlah belum diisi; berhasil hanya setelah respons simpan sukses |
| Impor | Preview valid/error/nama sama | Tampilkan baris bermasalah dan pilihan tambah berbeda/lewati; jangan diam-diam overwrite |
| Kalender | Perubahan tanggal dengan catatan | Konfirmasi dampak riwayat/exclusion sebelum perubahan |
| Semester | Aktif, belum lengkap sebelum tutup, tertutup | Konfirmasi bahwa sesudah tutup tidak bisa koreksi; lihat/cetak tetap ada |
| Laporan | Memuat, hasil kosong, berhasil, gagal membuat PDF | Cetak/Unduh PDF; error tidak memberi file sukses palsu; sel belum diisi tetap kosong tanpa penanda |

Kalimat final kecil dapat dirapikan PM/Executor sesuai acuan copy. Janji autosave/retry otomatis, reset akun, pemulihan konflik, pengiriman email atau layanan baru bukan keputusan wording kecil dan menunggu C04/C06.

## Tahap dan dependency

| Tahap | Hasil | Dependency wajib | Task | Bukti akhir |
|---|---|---|---|---|
| P0 Keputusan/persiapan PM | Stack/lokasi dan kontrak terbuka dirinci; peta approval | PRD/izin persiapan sudah ada; C01–C08 bertahap | PM merawat keputusan | Jawaban Ardy dan dokumen tersinkron |
| P1 Desain | Desain login/absensi lalu pengelolaan/laporan | UI-001 independen; UI-002 perlu C03/C05/C07 + review arah UI-001 | UI-001, UI-002 | Artefak desain, pemeriksaan PM, approval arah Ardy |
| P2 Fondasi | Repo/env/app lokal, model dasar, akses | C01/C02 sebelum setup; C04/C07/C08 sesuai modul | SET-001, DATA-001, AUTH-001 | Preflight/runtime/checks/kontrak aktual |
| P3 Data/kalender | Pengelolaan siswa, impor, kalender | Fondasi, C03/C07 | STUD-001, IMP-001, CAL-001 | Uji nama sama/tanggal/validasi |
| P4 Absensi/semester | Input parsial, koreksi/riwayat, closure/salin semester | Fondasi + siswa/kalender + C06/C07/C08; desain disetujui | ATT-001, SEM-001 | Backend rules dan alur teruji |
| P5 Laporan | Bulanan/semester, browser/PDF | UI-002 disetujui; ATT/SEM/C05 | REP-001 | Total/render benar; uji cetak pending Ardy |
| P6 Operasi dan verification | Akses/kegagalan/cadangan/pemulihan, regression | Semua modul, C04/C08, target ops disetujui | OPS-001, QA-001 | Evidence teknis dan restore non-production |
| P7 Uji dan review | Uji nyata Ardy, revisi, review Product Manager | Bukti teknis + lingkungan uji diotorisasi | UAT-001, REVIEW-001 | Evidence AC, keputusan Ardy dan review produk |
| P8 Panduan rilis | Paket runtime/panduan/rollback; deployment Ardy | Kelayakan hasil + keputusan target/ref | REL-001 | Panduan/paket diperiksa; bukan klaim deployed |

Dependency rinci di tasks.md. Pekerjaan independen yang dapat dipersiapkan: UI-001 bersamaan dengan keputusan PM; STUD dan CAL setelah fondasi dapat dikerjakan pada area berbeda; OPS direncanakan sejak awal. Actual parallel assignment hanya setelah owner/area/task dan pilihan Ardy jelas. Tidak melakukan dispatch paralel sekarang.

## Keamanan, kegagalan dan operasi

Kebutuhan perencanaan berdasarkan risiko akun/data siswa:

- AUTH: autentikasi/otorisasi sisi server, perlindungan write/session, pembatasan upaya masuk, tidak ada register publik. Kebijakan reset/provisioning menunggu C04; starter kit tidak boleh menambah fitur signup otomatis.
- DATA/ATT/SEM: validasi server, transaksi, uniqueness, lock periode, snapshot arsip, konflik dua perangkat. Menonaktifkan tombol saja tidak membuktikan lock.
- IMP: pembatasan file sesuai paket terpilih, preview sebelum commit, sanitasi input, kegagalan per baris jelas. Jangan menyimpan Excel siswa dalam Git atau publik.
- REP: output hanya untuk akun yang berhak; penyimpanan/masa hidup PDF dan akses logo ditetapkan pada kontrak; tidak ada URL publik laporan tanpa approval.
- OPS: logging gangguan tanpa password/identitas siswa yang tidak diperlukan; health check, pemilik respons gangguan, cadangan database+logo dan bukti restore perlu keputusan target/retensi/akses. Tidak membeli monitor atau mengonfigurasi server produksi dalam planning.

Kegagalan tidak boleh dianggap sukses; input yang belum tersimpan/concurrency membutuhkan C06. Monitoring, backup dan recovery dinilai dari kontrol nyata/evidence, bukan keberadaan checklist.

## Git dan lingkungan

C02 meminta lokasi codebase dan repo docs/kode. Rekomendasi awal: satu repo khusus proyek yang melacak code serta dokumentasi perjalanan. Folder registry studio tetap menjadi pointer; jangan otomatis Git init root studio atau menyalin dokumen sampai strategi disetujui.

SET-001 perlu mencatat runtime/versi actual PHP/Node/Composer/database jika stack PHP dipilih. Akses CLI paket, script/checks dan target non-production diverifikasi preflight, bukan diasumsikan dari adanya tools umum.

Development memakai data fiktif. Staging/production, target/ref dan biaya menunggu Ardy. Paket runtime harus memuat aset/dependency/migrasi yang memang diperlukan dan mengecualikan bahan development yang tidak dibutuhkan runtime; dokumen tetap terlacak di source Git. REL-001 menyiapkan panduan build/deploy/health/rollback. Git init/commit/push dan deployment mengikuti keputusan lokasi/tindakan masing-masing; belum dilakukan sekarang.

## Pengujian dan penyerahan

Gunakan [verification-plan](<verification-plan.md>). Executor menguji scope task, PM memeriksa actual changes/AC/regression, Ardy menguji penggunaan browser/perangkat/cetak. Product Manager mereview goal/UX/copy setelah bukti memadai. Jika bukti wajib Ardy masih pending, task terkait tetap PM_VALIDATION, bukan READY_FOR_ARDY_REVIEW atau CLOSED.

## Keputusan, readiness dan next action

Rencana ini merinci pekerjaan PM dalam scope yang disetujui. Ardy memilih Laravel + Inertia/Vue setelah perbandingan; versi/database/paket/hosting tetap perlu diputuskan. Pilihan stack tidak mengizinkan setup atau biaya/desain sepihak. Keputusan penting masuk daftar konfirmasi; PM memperbarui source terkait sebelum melanjutkan bagian terdampak.

Task READY pertama: **LAB002-UI-001, design-only login dan absensi harian HP/laptop**. Scope sengaja tidak menyentuh reset akun, laporan, impor, closure atau konflik data yang masih perlu keputusan. Task setup/backend tetap ANALYSIS sampai dependencies/keputusan lengkap.

Next owner: Executor /root/lab002_ui001 untuk desain/laporan UI-001, lalu PM untuk validation. Ardy menyetujui Codex subagent gpt-6.1-sol/high pada 11 Oktober 2026; ACK dan preflight diterima. PM merawat planning dan keputusan implementasi yang masih terbuka. Belum ada code, test aplikasi, desain selesai, Git init/commit/push, atau deployment.

## Pembaruan hasil UI-001 — 11 Oktober 2026

Executor selesai menyerahkan sembilan SVG/PNG dan laporan. PM memeriksa semua PNG serta AC; status terbaru READY_FOR_ARDY_REVIEW, next owner Ardy. [Catatan desain](<design/LAB002-UI-001/README.md>), [review PM](<reports/LAB002-UI-001-pm-review.md>). Pernyataan pekerjaan berjalan di atas adalah posisi sebelum hasil kembali. Approval desain/closure dan implementasi belum dilakukan.

## Keputusan Ardy dan status terbaru

Sumber: jawaban dialog Ardy “Setujui arah desain”, 11 Oktober 2026. Persetujuan hanya arah login dan absensi harian HP/laptop; bukan assignment implementasi.
UI-001 APPROVED lalu CLOSED setelah pemeriksaan PM. Catatan READY_FOR_ARDY_REVIEW/approval pending di atas adalah tahap sebelum jawaban diterima. Next owner: PM untuk kesiapan task berikutnya. C02–C08 dan rincian stack tetap terbuka sesuai daftar keputusan; tidak ada assignment implementasi.

## Target Vercel dan evaluasi stack — 11 Oktober 2026

Vercel ditetapkan Ardy sebagai hosting. C01 sedang dievaluasi ulang melalui [perbandingan Nuxt/Vue dan Laravel](<stack-vercel-comparison.md>); Laravel belum digantikan. Setup/implementation yang bergantung pada stack tetap menunggu keputusan. UI-001 sudah CLOSED dengan approval desain; tidak terpengaruh evaluasi ini. Provider database/storage, paket, biaya dan izin deploy belum ditetapkan.

## Baseline SET-001 — keputusan 11 Oktober 2026

Sumber: dua dialog lokasi/database, kemudian penyedia/baseline. Ardy menyetujui root app di folder registry, salinan terarah docs development dalam repo dan Git init lokal; commit/push tetap terpisah. App belum ada saat diperiksa PM.
Nuxt 4 stabil + TypeScript, Node 24, npm/lockfile dan aplikasi minimal tanpa login/absensi/Excel/PDF disetujui. Rekomendasi patch Nuxt 4.6.1 diperiksa sumber resmi; preflight wajib kompatibilitas.
Supabase dipilih untuk PostgreSQL; pemilihan Auth/Storage, provisioning/reset/akses C04 dan backup C08 tetap terbuka. Tidak ada layanan dibuat, region/plan/biaya/kredensial ditetapkan.
[SET-001](<tasks/LAB002-SET-001.md>) READY untuk fondasi lokal/config placeholders tanpa koneksi DB nyata. Tidak ASSIGNED. Provider credentials/ORM/schema bukan dependency scope ini, tetap dependency DATA/AUTH/OPS terkait. C02 path/Git lokal APPROVED; remote/branch strategy/commit/push belum diotorisasi.

## Assignment SET-001 — 11 Oktober 2026

Ardy meminta assignment ke Codex subagent gpt-6.1-sol/high. [SET-001](<tasks/LAB002-SET-001.md>) ASSIGNED, handle aktual /root/lab002_set001, tahap fondasi lokal sesuai brief; hasil/preflight belum tersedia saat dispatch. [Handoff](<tasks/LAB002-SET-001-assignment.md>). Next owner Executor lalu PM untuk validation. Tidak ada izin commit/push/deploy/resource layanan.

## Hasil SET-001 — 11 Oktober 2026

Fondasi Nuxt lokal selesai menurut laporan Executor, diperiksa PM terhadap AC dengan HTTP independen; status READY_FOR_ARDY_REVIEW. [Laporan Executor](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/reports/LAB002-SET-001-report.md>), [review PM](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/reports/LAB002-SET-001-pm-review.md>), [README aplikasi](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/README.md>). Next owner Ardy, approval PENDING. Repo app sudah init lokal; source/docs untracked, tanpa commit/remote/push/deploy. Supabase belum terhubung. Salinan docs app perlu sync keputusan/status sebelum task berikutnya; registry tetap authority.

## Approval dan closure SET-001 — 11 Oktober 2026

Ardy menjawab dialog “Setujui hasil setup lokal”. APPROVED untuk hasil fondasi lokal yang diperiksa PM. Task CLOSED karena seluruh deliverable/AC setup selesai dan tidak ada delivery action tersisa. Tidak memberi izin commit/push/deploy, koneksi layanan, atau assignment task berikutnya. Next owner PM untuk merinci readiness DATA-001/AUTH-001 dan keputusan terkait. Pernyataan pending review sebelumnya merupakan riwayat sebelum approval ini.

## Delegasi pengelolaan lokal — 12 Oktober 2026

Sumber: pesan Ardy mempercayakan keputusan dan validasi kepada PM, meminta Executor GPT-6 Luna/reasoning MAX, serta batas sampai dapat dijalankan dan diuji lokal. Delegasi khusus LAB-002, bukan perubahan workflow global studio.

PM boleh merinci/memilih keputusan implementasi dan aturan terbuka yang diperlukan dalam tujuan PRD v1, menyiapkan task READY, assignment/revisi, validasi teknis dan uji browser/end-to-end lokal, serta menerima/menutup task lokal berdasarkan evidence tanpa approval Ardy per task. Keputusan penerimaan dicatat sebagai penerimaan PM berdasarkan delegasi Ardy, bukan klaim Ardy menguji/menyetujui setiap hasil. Executor tetap tidak menerima/menutup pekerjaannya sendiri; PM tidak mengerjakan kode aplikasi.

Konfigurasi Executor berlaku untuk task lokal berikutnya: Codex subagent worker dengan instruksi Executor, model gpt-6-luna, reasoning max. Jika pilihan tidak dapat dipakai, laporkan; jangan mengganti model diam-diam. Pemeriksaan 12 Oktober: metadata tool mendukung pasangan tersebut; spawn read-only fork_turns=none model gpt-6-luna/max diterima, handle /root/lab002_luna_check; agent selesai membaca status SET-001 CLOSED tanpa perubahan. Ini membuktikan dispatch konfigurasi diterima dan task kecil selesai, bukan benchmark kemampuan seluruh fitur.

Batas: scope v1/stack Nuxt tetap, data fiktif dan lingkungan lokal; tidak deploy/publish, layanan/resource cloud, biaya pembelian, kredensial/data production, remote/commit/push atau perubahan global. Supabase tetap target provider; kebutuhan lingkungan PostgreSQL/local test akan dirinci dan diverifikasi sebelum implementasi. Perubahan di luar tujuan/batas lokal, kebutuhan akses eksternal atau blocker yang tidak dapat diselesaikan di dalam delegasi tetap dikembalikan kepada Ardy. Progress, evidence dan keterbatasan tetap dilaporkan. Tidak ada janji kelanjutan latar belakang setelah sesi berhenti.

Next owner PM untuk merinci roadmap delivery lokal dan keputusan C03–C08, lalu assignment per task sesuai readiness menggunakan konfigurasi yang telah dipilih; tidak perlu dialog approval rutin dalam batas delegasi ini.

## Izin Git lokal — 12 Oktober 2026

Ardy: “untuk git kamu bisa init dan commit saja tanpa menambahkan remote”. PM boleh init/commit lokal pada repo aplikasi LAB-002, sesudah memeriksa perubahan dan isi staging. Menggantikan batas belum boleh commit pada delegasi lokal sebelumnya; tidak memberi izin remote/push/deploy. Izin ini berlaku untuk perjalanan delivery lokal dalam scope PRD; source, keputusan dan evidence yang diperlukan disimpan di repo, secret/data asli/output runtime/cache tetap diabaikan.

## Delivery lokal dimulai 12 Oktober 2026

PM menetapkan [kontrak lokal v1](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/local-delivery-contract-v1.md>) dari delegasi Ardy, menyelesaikan detail C03–C08 untuk local delivery. PostgreSQL16 cluster terisolasi, Postgres.js dan SQL migrations; tidak Supabase/cloud. [DATA-001](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/tasks/LAB002-DATA-001.md>) READY sebelum dispatch. Local browser validation PM diotorisasi.
