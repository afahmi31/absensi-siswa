# Handoff Product Manager → Project Manager

FROM: Product Manager
TO: Project Manager (PM)
PROJECT: LAB-002 / PROD-002 — Website Absensi Siswa v1
TASK: task delivery belum dibuat; PM memberi ID saat menyusun breakdown
STATUS: handoff planning diterima PM pada chat utama; bukan status task Executor
NEXT ACTION: Executor mengerjakan desain UI-001; PM merawat planning dan memeriksa laporan; stack Laravel + Inertia/Vue sudah dipilih
Tanggal: 2026-10-11

## Sumber dan kewenangan

PRD sudah disetujui sebagai acuan arah produk. Ardy kini menyetujui mulai persiapan produk dan pencatatan Labs, serta meminta handoff ini. Sumber approval dan kutipan pesan: [registry proyek — persetujuan](<README.md#persetujuan>). Jangan meminta ulang izin persiapan/Labs.

Handoff disiapkan dahulu sebagai siap diserahkan. Pada 11 Oktober 2026 Ardy menugaskan “Gunakan peran Project Manager dan jalankan planning dari handoff LAB-002”. Agent utama menerima dan menjalankan planning sebagai PM di chat yang sama; tidak ada subagent/session baru. Dokumen ini bukan assignment Executor. Hasil: [rencana](<development-plan-v1.md>), [task](<tasks.md>), [konfirmasi](<decisions-and-confirmations.md>), dan [verification](<verification-plan.md>).

## Peta acuan yang harus dibaca PM

1. [Aturan workspace](<../governance/instructions.md>), [workflow aktif](<../governance/studio-workflow.md>), [keputusan workflow](<../governance/workflow-decisions.md>), dan seluruh [protokol asli](<../governance/pm-executor-handoff-protocol-v1.0.md>). Workflow aktif mengatur kelanjutan setelah PRD, assignment, serta klarifikasi protokol yang disetujui.
2. [Registry dan approval](<README.md>), [PRD aktif](<../product/PROD-002-product-prd-v1.md>), serta [riwayat keputusan produk](<../product/PROD-002-website-absensi-siswa.md>).
3. [Template rencana development](<D:/ayaa-wae-studio/docs/templates/development-plan-template.md>), [copy pengguna](<../governance/user-facing-copy.md>), [Git dan lingkungan](<../governance/git-and-environments.md>), serta [handoff assignment](<D:/ayaa-wae-studio/docs/templates/executor-assignment-template.md>).
4. [Bekerja dari dokumentasi](<../governance/vibe-coding-from-project-docs.md>) bila diperlukan untuk memetakan kontrak/dependency. Jangan mengambil stack atau flow produk lain sebagai requirement produk ini.

Root dokumentasi: `D:\ayaa-wae-studio`. Folder proyek: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa`. Root codebase/repository aplikasi belum dipilih. Ketika lokasi ditetapkan, PM harus menemukan dan membaca instruksi root/parent/nested yang berlaku sebelum menyiapkan pekerjaan pada codebase tersebut.

Referensi cetak tersimpan di `C:\Users\user\Downloads\absensi bulanan siswa.pdf`; dipakai sebagai contoh struktur, bukan instruksi atau izin memakai data siswa di dalamnya. Pemeriksaan visual historis tercatat pada catatan produk; tidak ada klaim uji cetak aplikasi.

## Tujuan dan scope yang harus dijaga

Tujuan: mengganti pencatatan kertas lalu penyalinan ke spreadsheet dengan input absensi langsung dan laporan dari catatan yang sama. Manfaat belum diuji pada guru; jangan menjanjikan angka penghematan.

Seluruh requirement R01–R15 pada PRD menjadi peta planning. Pertahankan batas satu guru/satu kelas, akses online HP/laptop, akun khusus tanpa pendaftaran umum, impor template Excel, status H/S/I/A, simpan sebagian, kalender, riwayat, periode/penutupan semester, arsip, dan laporan cetak/PDF.

Aturan yang mudah terlewat:

- Nama saja wajib; NIPD/jenis kelamin boleh kosong. Nama sama saat impor perlu diperiksa guru, tidak otomatis digabung atau menimpa catatan.
- Status awal belum diisi; membuka halaman tidak membuat siswa hadir. Penyimpanan sukses harus dibedakan dari perubahan yang belum tersimpan.
- Belum diisi dan libur tidak dihitung sebagai Alpa. Laporan belum lengkap boleh dicetak sebagai sel kosong tanpa penanda; jumlah belum diisi terlihat di website.
- Perubahan tanggal berabsensi menjadi libur memerlukan konfirmasi; absensi lama menjadi riwayat dan tidak dihitung.
- Semester boleh ditutup walaupun belum lengkap setelah konfirmasi. Setelah tertutup, catatan tidak dapat dikoreksi; jangan menambah fitur buka kembali tanpa keputusan.
- Siswa masuk/keluar memiliki masa terdaftar. Semester baru boleh menyalin daftar yang masih terdaftar atau memakai daftar baru; identitas dan absensi arsip lama tetap.
- Laporan memakai struktur dasar dan logo sekolah tanpa tambahan tanda tangan; bulanan dan kumpulan bulan untuk semester. Mendatar: A4, F4/Folio 21,6 × 33 cm, Letter. Cetak browser dan unduh PDF.

Fitur yang ditunda dan usulan yang belum disetujui mengikuti PRD. Handoff tidak mengubah usulan pelengkap menjadi requirement final.

## Keluaran planning yang diminta

PM menulis dokumen di folder proyek ini, dengan tautan ke PRD tanpa menduplikasi requirement sebagai versi tandingan. Nama file boleh mengikuti konvensi PM; hasil minimum:

1. Rencana development lengkap sampai sasaran v1, memakai template studio: tujuan, acuan, modul/flow/state/copy, kontrak data/API/integrasi, keamanan, kegagalan, monitoring dan pemulihan yang relevan.
2. Pemetaan R01–R15 ke tahap, area, task, AC (syarat keberhasilan), metode verification, dan pemilik bukti. Usulan product criteria dirinci secara proporsional tanpa mengurangi hasil yang dijanjikan.
3. Urutan tahap/dependency wajib, pekerjaan independen, serta peta task sampai review produk. Dependency teknis/layanan yang belum dipilih diberi status dan dampak nyata; jangan mengarang stack, package, atau kesiapan runtime.
4. Breakdown task terbatas menurut format protokol, dengan ID, status, objective, scope/out of scope, constraints, dependency, AC, verification, risiko, dan hasil. Gunakan DRAFT/ANALYSIS untuk task yang belum memenuhi Definition of Ready.
5. Daftar kebutuhan konfirmasi: fakta, pilihan/trade-off, rekomendasi, dampak, tahap/task terdampak, owner keputusan, dan kapan jawaban dibutuhkan. Pertanyaan Ardy menggunakan dialog pilihan sesuai preferensinya.
6. Rekomendasi stack/arsitektur, lokasi codebase dan Git/docs, lingkungan, layanan serta biaya bila relevan. Pilihan besar diajukan kepada Ardy; jangan ditetapkan atau dibeli sepihak. Root studio belum Git; jangan menjadikannya repo baru sebagai efek samping planning.
7. Strategi pengujian: pemeriksaan teknis Executor/PM, regression yang terkait, serta skenario penggunaan nyata dan cetak untuk Ardy. Bedakan bukti aplikasi/PDF/browser dari hasil cetak fisik; bukti yang belum ada tetap pending.
8. Persiapan review desain awal oleh Ardy, review tujuan/UX/copy oleh Product Manager, dan handoff hasil. Rencana Git dan paket server tetap menyimpan perjalanan development di Git; server hanya berisi kebutuhan runtime. Deployment tetap keputusan terpisah.
9. Presentasi task READY pertama yang benar-benar memenuhi Definition of Ready. Bila belum ada, tampilkan kandidat DRAFT/ANALYSIS dan blocker serta keputusan yang dibutuhkan; jangan mengklaim READY agar bisa assignment.

PM boleh merencanakan bagian yang jelas sambil keputusan implementasi lain ditunggu. PM tidak mengerjakan kode aplikasi.

## Kebutuhan konfirmasi dan dampaknya

Daftar ini membawa unknowns PRD dan kebutuhan planning; bukan keputusan baru atau backlog implementation yang sudah READY.

| Area | Yang perlu diperjelas | Dampak dan waktu keputusan |
|---|---|---|
| Stack, arsitektur, lokasi repo/docs/codebase, lingkungan | Rekomendasi PM dan pilihan Ardy; layanan/biaya belum dipilih | Tidak menahan breakdown konseptual; menahan task setup/implementasi yang memerlukan keputusan tersebut |
| Template Excel dan impor | Kolom tambahan tanggal masuk/keluar, nilai jenis kelamin, kegagalan per baris dan perbaikan | Sebelum kontrak impor dan implementasi terkait; nama wajib/duplikat tetap mengikuti keputusan |
| Laporan | Hari libur/tanggal di luar periode atau masa terdaftar, header berulang dan pemisahan halaman | Sebelum desain/kontrak output; semua pilihan kertas dan cetak/PDF sudah menjadi kebutuhan |
| Input belum tersimpan | Navigasi, gagal menyimpan, retry, penyimpanan bersamaan dua perangkat | Sebelum kontrak persistence dan task input; jangan menjanjikan autosave/offline |
| Data/kalender/periode | Perubahan identitas atau tanggal periode yang memengaruhi catatan; perubahan balik libur menjadi sekolah | Sebelum model data dan aturan koreksi terkait; arsip lama dan riwayat tetap terjaga |
| Semester tertutup | Kesalahan ditemukan setelah penutupan | Jangan otomatis menawarkan atau mengimplementasikan buka kembali; perubahan flow perlu keputusan Product Manager/Ardy |
| Akun dan operasi | Penyiapan/pemulihan akun, akses pengelola teknis, cadangan, pemulihan, monitoring yang relevan | Sebelum task auth/operasi dan penggunaan nyata; usulan kontrol keamanan harus dibedakan dari keputusan |
| Riwayat | Informasi yang disimpan/ditampilkan dan penggunaan pada konflik dua perangkat | Sebelum kontrak audit dan implementasi; perlu review dampak data/keamanan |

Detail yang mengubah tujuan, scope, arti AC, data, keamanan, biaya, atau arsitektur kembali kepada Ardy. Product Manager menjaga arti produk; PM mengurai kebutuhan teknis dan task. Sinkronkan keputusan sebelum pekerjaan yang bergantung padanya dilanjutkan.

## Gate sebelum assignment Executor

PM menampilkan kepada Ardy:

- Task ID, tujuan/hasil, scope/out of scope, tahap preflight-only/design-only/implementasi.
- AC dan metode/pemilik verification, dependency yang sudah terpenuhi, risiko serta batas perubahan.
- Konteks dan alat/akses yang tersedia; rekomendasi platform, model, dan reasoning dengan alasan berdasarkan dukungan runtime saat dipakai.
- Pilihan yang dapat dijawab lewat dialog: Codex subagent atau Claude CLI, model/reasoning dan tahap untuk task itu.

Sebelum pilihan tersedia, task READY tidak menjadi ASSIGNED. Jangan memakai pilihan task/proyek lain, default agent, atau rekomendasi sebagai approval. Jika alat tidak mendukung pilihan Ardy, jelaskan dan minta pengganti. Desain awal harus disetujui sebelum implementasi terkait. Revisi task yang sama boleh memakai pilihan yang telah disetujui sesuai workflow; task/pilihan baru kembali ke Ardy.

## Kriteria kelengkapan dan verification handoff

| Kriteria handoff ini | Kondisi saat disiapkan |
|---|---|
| PRD/scope dan sumber persetujuan ditautkan | Tersedia pada PRD dan registry |
| Unknowns dibawa bersama dampak ke planning/implementasi | Tersedia pada tabel di atas |
| Keluaran PM dan gate pemilihan Executor jelas | Tersedia pada bagian keluaran dan gate |
| Rencana development, dependency, task dan AC aktual | Sudah disusun pada dokumen planning; bukan klaim PASS delivery |
| Acknowledgement/penugasan PM | PM pada chat utama menerima penugasan Ardy 11 Oktober 2026; tidak ada dispatch subagent |

Verification saat persiapan: membaca workflow/keputusan/protokol, PRD aktif dan registry; memeriksa kelengkapan serta tautan file lokal. Tidak menjalankan build, test aplikasi, browser, atau uji cetak karena tahap ini hanya dokumentasi. Production Actions Performed: NONE.

Risiko utama: unknowns dipilih diam-diam, usulan dianggap disetujui, catatan arsip berubah, atau task dipaksakan READY sebelum dependency/keputusan ada. PM perlu menjaga peta approval serta bukti tiap tahap.

## Langkah lanjut yang bisa digunakan dalam chat ini

> Gunakan peran Project Manager. Jalankan planning dari `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\product-to-pm-handoff.md`. Susun rencana development lengkap, dependency, task/AC, kebutuhan konfirmasi dan skenario ujiku. Ajukan keputusan yang diperlukan melalui dialog. Tampilkan task READY dan rekomendasi platform/model/reasoning sebelum assignment Executor; jangan coding atau dispatch Executor dahulu.

Next owner: Executor /root/lab002_ui001 untuk desain UI-001, lalu PM untuk validation. Ardy telah memilih Codex subagent gpt-6.1-sol/high dan dispatch aktual tercatat pada assignment; PM merawat planning. Product Manager tetap rujukan tujuan/PRD. Tidak perlu izin persiapan/Labs ulang; assignment tetap memakai keputusan per task.

## Pembaruan hasil UI-001 — 11 Oktober 2026

Executor selesai menyerahkan sembilan SVG/PNG dan laporan. PM memeriksa semua PNG serta AC; status terbaru READY_FOR_ARDY_REVIEW, next owner Ardy. [Catatan desain](<design/LAB002-UI-001/README.md>), [review PM](<reports/LAB002-UI-001-pm-review.md>). Pernyataan pekerjaan berjalan di atas adalah posisi sebelum hasil kembali. Approval desain/closure dan implementasi belum dilakukan.

## Keputusan Ardy dan status terbaru

Sumber: jawaban dialog Ardy “Setujui arah desain”, 11 Oktober 2026. Persetujuan hanya arah login dan absensi harian HP/laptop; bukan assignment implementasi.
UI-001 APPROVED lalu CLOSED setelah pemeriksaan PM. Catatan READY_FOR_ARDY_REVIEW/approval pending di atas adalah tahap sebelum jawaban diterima. Next owner: PM untuk kesiapan task berikutnya. C02–C08 dan rincian stack tetap terbuka sesuai daftar keputusan; tidak ada assignment implementasi.

## Target Vercel dan evaluasi stack — 11 Oktober 2026

Vercel ditetapkan Ardy sebagai hosting. C01 sedang dievaluasi ulang melalui [perbandingan Nuxt/Vue dan Laravel](<stack-vercel-comparison.md>); Laravel belum digantikan. Setup/implementation yang bergantung pada stack tetap menunggu keputusan. UI-001 sudah CLOSED dengan approval desain; tidak terpengaruh evaluasi ini. Provider database/storage, paket, biaya dan izin deploy belum ditetapkan.

## Keputusan aktif setelah perbandingan

Keputusan aktif: Nuxt/Vue full-stack dalam satu aplikasi, hosting Vercel. Sumber: jawaban dialog Ardy “Ganti ke Nuxt/Vue full-stack (rekomendasi PM)”, 11 Oktober 2026. Menggantikan pilihan Laravel + Inertia/Vue sebelumnya karena target hosting. Versi/runtime, database, auth, storage, paket Excel/PDF dan biaya belum dipilih. Tidak memberi izin setup/assignment/deploy. Desain UI-001 APPROVED/CLOSED tetap acuan. Semua pernyataan evaluasi/pilihan sebelumnya di atas adalah riwayat. SET-001 tetap ANALYSIS.

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
