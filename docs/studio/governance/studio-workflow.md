# Workflow Ayaa Wae Studio

Berlaku sejak 11 Oktober 2026. Sumber persetujuan: [keputusan workflow](<workflow-decisions.md>). Acuan ini menghubungkan perjalanan produk dengan [protokol delivery asli](<pm-executor-handoff-protocol-v1.0.md>). Naskah asli tetap utuh.

## Hasil yang dituju

Tim agent membantu Ardy membahas produk, merencanakan pengerjaan, menyelesaikan requirement, memeriksa hasil, dan menyiapkan bahan pengenalan kepada publik. Produk bisa berupa SaaS, tool, website, atau karya lain. Tujuan dan batas versi pertama disepakati sebelum development.

Kemudahan Ardy memakai workflow termasuk hasil yang harus dijaga. Ardy dapat menyampaikan kebutuhan dalam bahasa biasa. Agent utama mengenali tahap, membawa konteks ke peran yang sesuai, dan menjelaskan hasil serta keputusan berikutnya. Ardy tidak perlu menghafal nama skill atau menyalin seluruh percakapan ke setiap agent.

## Tanggung jawab

| Peran | Tanggung jawab | Hasil yang diserahkan |
|---|---|---|
| Ardy | Arah bisnis, scope, keputusan besar, pilihan Executor/alat/model/reasoning, desain awal, pengujian penggunaan nyata, penerimaan, deployment dan publikasi | Keputusan dan hasil pengujian dengan sumber yang tercatat |
| Product Manager | Memegang konteks dan tujuan produk dari diskusi sampai review kesiapan uji publik | Catatan produk, PRD, keputusan, review produk, brief Brand & Content |
| Project Manager (PM) | Menyusun rencana development menyeluruh, requirement, tahap, dependency, task, assignment, pemantauan, pemeriksaan teknis, revisi, Git dan panduan lingkungan | Rencana, task, handoff, hasil validation, skenario uji Ardy, panduan deployment |
| Executor | Preflight, desain sesuai penugasan, implementasi, pemeriksaan teknis dan perbaikan dalam task | Hasil aktual, bukti pemeriksaan, laporan dan blocker untuk PM |
| Discovery & Documentation | Memetakan bahan proyek dan membantu penyusunan serta pemeliharaan dokumentasi | Peta acuan/flow, konflik, pertanyaan, dokumen yang konsisten |
| Brand & Content | Menyiapkan branding dan bahan pengenalan dari brief serta hasil yang tersedia | Draft visual, artikel/post dan catatan sumber untuk review Ardy |
| Administrasi | Merawat indeks proyek, lokasi bahan dan keputusan administratif | Catatan bersumber yang menautkan record utama |

Agent utama mengoordinasikan konteks dan hasil; PM tetap mengendalikan delivery. PM tidak mengerjakan kode aplikasi. Sync Docs adalah kemampuan bersama dalam scope penugasan. Gunakan satu penulis per area pada satu waktu.

## Mulai dari kebutuhan yang tersedia

Untuk produk studio baru, mulai dengan Product Manager. Diskusikan pengguna, masalah, fungsi, tujuan, fitur v1, pengecualian dan cara menilai hasil. Ide kasar boleh dibahas tanpa formulir. Product Manager menulis PRD yang cukup untuk keputusan berikutnya, lalu menyerahkan scope yang disetujui beserta pertanyaan tersisa kepada PM.

Untuk proyek klien atau aplikasi existing, mulai dari requirement yang diberikan. Jika kondisi proyek belum jelas, Discovery memetakan area terkait sebelum PM merencanakan perubahan. Bug kecil cukup memakai acuan dan rencana terkait; tidak harus melewati seluruh perjalanan produk baru. Registry klien/Labs memerlukan persetujuan mulai proyek, terpisah dari kesiapan task.

## PRD dan rencana development

PRD menjelaskan tujuan, pengguna, alur, fungsi dan batas produk. Product Manager merawatnya. PM menyusun rencana development yang menerjemahkan PRD ke requirement dan tahap pengerjaan; gunakan [template PRD](<D:/ayaa-wae-studio/docs/templates/product-prd-template.md>) dan [template rencana](<D:/ayaa-wae-studio/docs/templates/development-plan-template.md>) sesuai ukuran proyek.

Rencana memiliki peta dokumen, aturan lintas modul, kontrak/data/integrasi yang relevan, flow dan state, copy pengguna, dependency, task, metode pemeriksaan dan pemilik bukti. Sertakan keamanan, penanganan kegagalan, monitoring, serta pemulihan sesuai risiko produk. Sebut lokasi docs/codebase, rencana Git/lingkungan, blocker dan keputusan terbuka.

Pola dokumentasi besar mengikuti [panduan bekerja dari dokumentasi](<vibe-coding-from-project-docs.md>). Referensi game-web-docs memberi pola pengaturan acuan dan dependency. Stack, aturan domain dan tahapan khusus referensi tidak menjadi requirement produk lain.

PM menyusun perjalanan sampai sasaran versi tersebut, lalu merinci task bertahap. Task tetap terbatas dan dapat diperiksa menurut protokol. Detail tahap mendatang boleh belum lengkap; unknowns yang menghalangi satu tahap tidak menghentikan bagian independen yang sudah jelas. Persetujuan rencana tidak otomatis memberikan izin assignment atau deployment.

## Kelanjutan setelah PRD

Setelah PRD disimpan atau disetujui, Product Manager menjelaskan posisi produk, rekomendasi tahap berikutnya, keputusan yang masih dibutuhkan, dan siapa melakukan tindakan berikutnya. Berikan tindakan yang dapat dijawab Ardy langsung; “dokumen tersimpan” atau “belum ada izin” saja belum memberi handoff yang jelas.

Jika PRD masih menunggu review, tampilkan pertanyaan review beserta batas persetujuannya. Jika PRD disetujui tetapi izin mulai proyek belum ada, rekomendasikan persiapan development dengan Project Manager dan tanyakan apakah Ardy ingin melanjutkan atau membahas detail produk lebih dulu. Jelaskan bahwa izin mulai proyek mencakup pencatatan Labs untuk produk internal dan penyusunan rencana; pilihan Executor, coding, biaya/arsitektur besar, deployment, dan publikasi tetap mengikuti keputusan masing-masing.

Jika izin mulai proyek sudah jelas, jangan menanyakan ulang. Siapkan handoff PRD/sumber approval, scope, detail terbuka beserta dampaknya, dokumen acuan, hasil planning yang diminta, dan next owner PM. Pertanyaan yang hanya diperlukan sebelum implementasi tertentu tetap dicatat untuk tahap tersebut; PM boleh merencanakan bagian yang sudah jelas. Detail yang mengubah tujuan/scope tetap dibahas dengan Product Manager dan Ardy.

Ardy dapat melanjutkan pada chat produk yang sama. Peralihan peran/penugasan mengikuti izin dan kemampuan alat; chat baru hanya dibuat ketika diminta. Bila handoff belum dijalankan, nyatakan “siap diserahkan” dan berikan langkah lanjut atau kalimat yang dapat digunakan Ardy. Jangan mengaku PM sudah ditugaskan, mengirim pesan ke chat lain, atau membuat chat baru tanpa otorisasi terkait.

Gunakan dialog konfirmasi bila tersedia dan sesuai preferensi Ardy. Jika Ardy meminta cukup dicatat, disimpan sebagai draft, atau berhenti dahulu, hormati batas itu dan catat posisi untuk dilanjutkan nanti.

## Sebelum assignment Executor

PM mengaktifkan prioritas pekerjaan dan menyiapkan task sampai memenuhi Definition of Ready. Catat task sebagai READY; pilihan Executor yang belum diberikan tidak boleh dicatat sebagai ASSIGNED. Aktivasi prioritas bukan status lifecycle tambahan.

PM menyampaikan ringkasan, hasil yang diharapkan, scope/AC, tahap (preflight-only, design-only atau implementasi), alat/akses, serta rekomendasi model dan reasoning dengan alasan. Ardy memilih Executor: subagent Codex Desktop atau Claude CLI, beserta model dan reasoning yang didukung. Catat pilihan dan sumbernya memakai [handoff assignment](<D:/ayaa-wae-studio/docs/templates/executor-assignment-template.md>).

Assignment hanya dilakukan setelah pilihan tersedia. Jika alat tidak dapat memakai pilihan itu, jelaskan keterbatasan dan minta pilihan pengganti; jangan diam-diam memakai default. Jika Ardy sudah menentukan pilihan untuk task tersebut, pakai keputusan itu tanpa meminta ulang. Pilihan satu task tidak otomatis berlaku ke task berikutnya.

Instruksi sama berlaku pada Codex dan Claude CLI: task ID, lokasi kerja, acuan, keputusan, batas tahap/perubahan, AC, verification, lokasi laporan dan next owner harus dibawa. Catat handle/session yang benar-benar diperoleh. Kesiapan file handoff belum membuktikan proses sudah berjalan. Menyiapkan handoff tidak memberi izin mengubah konfigurasi global atau kredensial provider.

## Pengerjaan, pemantauan dan konfirmasi

Executor melakukan acknowledgement dan preflight. Preflight-only berhenti pada laporan; design-only berhenti pada rancangan. Assignment implementasi boleh berlanjut setelah preflight memadai tanpa stop condition. Desain awal baru harus disetujui Ardy sebelum implementasi terkait; detail kecil mengikuti arah yang sudah disetujui.

PM mengikuti handle agent/proses yang benar-benar aktif. Gunakan keluaran dan laporan yang tersedia untuk menilai kemajuan. Begitu laporan selesai, PM melanjutkan validation dan revisi dalam pengerjaan yang sama tanpa menunggu Ardy meminta pengecekan status. Revision dalam task yang sama boleh memakai pilihan Executor/alat/model/reasoning yang sudah disetujui sampai siap review. Task baru, pergantian pilihan, atau perubahan tahap di luar izin awal kembali kepada Ardy.

PM mengirim kebutuhan keputusan saat ditemukan, termasuk ketika Executor masih berjalan. Jika alat mendukung pertanyaan sambil bekerja, gunakan itu dan lanjutkan pekerjaan independen yang sudah diizinkan. Format pertanyaan:

- Keputusan yang dibutuhkan dan alasan.
- Fakta yang ditemukan beserta sumbernya.
- Dampak pada fitur, scope, biaya, data, keamanan atau jadwal.
- Pilihan dan konsekuensinya; rekomendasi dengan alasan.
- Bagian yang ditahan serta pekerjaan yang dapat berlanjut.

Executor menahan bagian yang bergantung pada keputusan; jangan menunggu laporan akhir untuk mengangkat blocker. Perubahan PRD/flow dibahas dengan Product Manager dan Ardy. Setelah keputusan, Sync Docs memperbarui acuan sebelum pengerjaan terkait dilanjutkan.

Pemantauan mengikuti kemampuan alat saat itu. Jangan menjanjikan pengawasan latar belakang setelah sesi berhenti tanpa fasilitas yang benar-benar diaktifkan. Jika kelanjutan otomatis tidak tersedia, catat proses/session, bukti terakhir, keterbatasan dan langkah melanjutkannya. Timeout pembacaan bukan bukti proses telah berhenti.

## Pemeriksaan teknis dan pengujian Ardy

Executor menjalankan pemeriksaan teknis relevan terhadap task. PM memeriksa perubahan aktual, requirement/AC, scope, kode, error handling, kontrol keamanan dan regression yang terkait. Jalankan pemeriksaan non-production yang diperlukan; kode terlihat rapi atau build lulus belum membuktikan alur pengguna.

Pengujian penggunaan nyata melalui browser/end-to-end secara default dilakukan Ardy. PM menyiapkan langkah, prasyarat/data, hasil yang diharapkan dan tempat mencatat temuan. PM boleh melakukan pengujian tersebut ketika Ardy meminta. Product Manager melakukan review tujuan dan pengalaman produk pada tahap review produk; ini terpisah dari validation task PM.

Setiap kriteria menyebut pemilik dan jenis buktinya. Bila kriteria wajib masih memerlukan hasil uji Ardy, PM memberi handoff untuk pengujian dengan status task PM_VALIDATION, hasil teknis dan kriteria yang belum diperiksa. Next owner Ardy untuk bukti tersebut; jangan mengklaim final validation PASS. Setelah bukti diperiksa dan seluruh kriteria wajib terpenuhi, PM menandai READY_FOR_ARDY_REVIEW sesuai protokol. Final approval Ardy dan closure tetap dicatat terpisah.

Revisi menjelaskan expected/observed, AC, bukti dan batas fix. Masalah di luar task masuk usulan tindak lanjut. Jika masalah itu menghalangi kriteria rilis, PM memasukkannya ke rencana untuk keputusan/assignment; jangan menganggap produk layak rilis hanya karena task sebelumnya selesai. Kegagalan berulang tanpa kemajuan atau approach yang tidak cocok dibawa ke Ardy dengan bukti; tidak perlu mengulang dari nol.

## Status, closure dan batas PM

Klarifikasi ini disetujui Ardy dalam [keputusan 012–016](<workflow-decisions.md#klarifikasi-pm-yang-disetujui-11-oktober-2026>). Berlaku pada bagian protokol yang disebut di decision log; lifecycle asli tetap digunakan.

| Istilah pada sumber/laporan | Makna dan pencatatan |
|---|---|
| NOT_READY | Hasil pemeriksaan kesiapan. Task tetap DRAFT atau ANALYSIS sesuai kondisi aktual. |
| RECEIVED | Acknowledgement Executor; tidak mengganti status task. |
| READY_TO_EXECUTE | Hasil preflight; implementasi hanya lanjut jika tahap tersebut sudah diizinkan. |
| IMPLEMENTED | Status laporan Executor. Setelah hasil diserahkan, task masuk PM_VALIDATION. |
| PAUSED | Keterangan bahwa pengerjaan ditahan. Status task menggunakan BLOCKED, ON_HOLD atau ESCALATED sesuai penyebab yang dicatat. |
| APPROVED / REJECTED | Keputusan Ardy yang dicatat terpisah dari status task. |

Untuk penahanan, tulis penyebab dan penanggung jawab berikutnya. Jika status yang tepat belum jelas, PM meminta keputusan; jangan memilih berdasarkan dugaan. Pemisahan ini tidak memberi izin implementasi, assignment, atau penerimaan hasil.

CLOSED hanya digunakan setelah Ardy memberikan APPROVED dan tidak ada pekerjaan delivery tersisa. REVISION_REQUIRED kembali ke revisi; ON_HOLD menahan task. REJECTED mencatat penolakan hasil; Ardy menentukan apakah hasil diperbaiki atau task dibatalkan menjadi CANCELLED. Penolakan tidak otomatis menutup atau membatalkan task. Final approval tetap dicatat terpisah dari deployment.

Satu active owner berlaku per task, termasuk setiap subtask paralel. Owner adalah pemilik tindakan berikutnya; PM tetap mengoordinasikan keseluruhan proyek. Tiap subtask memiliki scope dan handoff sendiri. Dua pelaksana tidak menulis area yang sama pada waktu bersamaan. PM mengurutkan pekerjaan bila ada dependency atau konflik file.

Setelah dua percobaan perbaikan untuk masalah yang sama tanpa kemajuan yang bisa dibuktikan, PM menghentikan percobaan berikutnya dan menyampaikan penyebab, bukti, serta pilihan tindakan kepada Ardy. Catat percobaan dan hasilnya pada revisi terkait; jangan menganggap semua revisi berbeda sebagai kegagalan masalah yang sama. Eskalasi lebih awal tetap berlaku jika ditemukan masalah scope, architecture, keamanan, data, atau kebutuhan mengganti alat/model. Keputusan Ardy diperlukan sebelum percobaan berikutnya pada masalah tersebut; pekerjaan independen yang diizinkan dapat lanjut.

PM boleh memperjelas rincian, membagi task, mengurutkan dependency, dan memperbaiki langkah verification selama tetap memenuhi requirement serta hasil yang disetujui. PM meminta keputusan Ardy sebelum mengubah hasil yang dijanjikan, flow bisnis, arti AC, biaya/deadline yang disepakati, data, keamanan, architecture, atau memperluas pekerjaan secara berarti. PM tidak boleh mengurangi AC agar hasil yang gagal dinyatakan lulus. Jika dampaknya belum dapat dipastikan, bagian tersebut menunggu keputusan Ardy. Perubahan acuan yang disetujui tetap melalui Sync Docs sebelum pekerjaan terkait berlanjut.

## Review produk dan pengenalan publik

Setelah hasil development dan pengujian wajib tersedia, PM menyerahkan ringkasan cakupan serta bukti kepada Product Manager. Product Manager memakai PRD terbaru dan riwayat keputusan untuk memeriksa tujuan, fungsi utama, kegunaan, UI/UX, interaksi, state dan [copy pengguna](<user-facing-copy.md>). Review dapat memakai hasil uji Ardy, aplikasi pada lingkungan yang ditugaskan dan artefak yang tersedia. Catat apa yang benar-benar diamati dan batasnya.

Gunakan [template review produk](<D:/ayaa-wae-studio/docs/templates/product-review-template.md>). Temuan yang perlu perbaikan kembali melalui PM. Perubahan tujuan/scope memerlukan keputusan Ardy dan sync; Product Manager tidak langsung menugaskan coding.

Kesimpulan memakai bahasa biasa: layak uji publik, perlu revisi, atau bukti belum cukup, disertai alasan. Ini hasil review produk, bukan status task baru, final approval, izin deployment atau bukti validasi pasar. Seluruh penghalang kriteria rilis harus dibereskan; keterbatasan tersisa harus terlihat dan diterima Ardy. Tidak ada klaim bebas seluruh bug atau keamanan mutlak.

Saat layak, Product Manager menyusun [brief Brand & Content](<D:/ayaa-wae-studio/docs/templates/product-brand-brief-template.md>): fungsi, pengguna, manfaat yang didukung, hasil yang boleh ditunjukkan, batas klaim, visual dan channel yang dipilih. Brand & Content membuat bahan yang diminta, termasuk gambar, artikel/post untuk WhatsApp, LinkedIn, Facebook atau blog. Bahan visual memakai skill/alat yang tersedia dan mengikuti persetujuan arah desain. Draft direview Ardy; publikasi/pengiriman membutuhkan instruksi tersendiri.

Product Manager mencatat feedback dan ukuran hasil uji publik yang disepakati. Target penggunaan adalah hipotesis sebelum bukti tersedia. Product yang selesai dibangun, diterima, tersedia publik dan dipakai pengguna dicatat sebagai fakta yang berbeda.

## Git, server dan pengecualian Vercel

Ikuti [Git dan lingkungan](<git-and-environments.md>). PM menyiapkan/merapikan pengelolaan Git development, staging dan production serta panduan deployment. Kode dan dokumen perjalanan development tercatat di Git; paket server berisi kebutuhan aplikasi untuk berjalan. Pemilihan repo/branch/build mengikuti keputusan proyek, bukan satu pola wajib untuk semua produk.

Ardy melakukan deployment staging maupun production. Kebutuhan uji coba server tetap dibawa kepada Ardy. Selesainya task atau review produk tidak mengaktifkan deployment.

Pengecualian yang disetujui: deployment Vercel boleh dijalankan agent setelah keputusan eksplisit Ardy untuk proyek, lingkungan dan versi yang dituju, jika integrasi/akses tersedia. Ini menyesuaikan larangan deployment umum pada bagian 4.3, 7, 12, 22, 26, 39, 41, 60, 67 dan 74 protokol hanya untuk tindakan Vercel yang diotorisasi. Tidak ada kewenangan production umum yang diberikan.

Deployment Vercel dicatat sebagai tindakan terpisah dari laporan coding. Baca instruksi proyek dan skill/alat deployment yang berlaku. Catat approval, target, versi, hasil aktual dan langkah pemulihan; jangan menulis Production Actions: NONE jika deployment benar-benar dilakukan. Deployment preview juga harus memiliki keputusan target yang jelas. Perubahan berbayar, domain, secret, data atau infrastruktur di luar instruksi tetap memerlukan keputusan tersendiri.

## Pemeliharaan acuan

[Keputusan workflow](<workflow-decisions.md>) mencatat persetujuan dan bagian yang digantikan. Aturan tambahan ini berlaku untuk ketentuan yang disebut secara eksplisit; protokol asli tetap mengatur hal lainnya. Temuan protokol lama yang belum diputuskan tetap usulan di [review protokol](<D:/ayaa-wae-studio/docs/protocol-review.md>).

Perbarui dokumen aktif berdasarkan keputusan yang berwenang dan fakta yang diverifikasi. Pertahankan riwayat, tautkan sumber utama, dan jelaskan next owner. Penerapan workflow baru pada proyek yang sedang berjalan perlu pemeriksaan oleh PM; jangan mengubah status historis atau menerima task lama secara otomatis.
