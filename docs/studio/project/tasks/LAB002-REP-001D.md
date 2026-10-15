# LAB002-REP-001D — Logo pada pratinjau, cetak dan PDF

Status final16Oktober2026: CLOSED melalui penerimaan lokal PM dalam delegasi Ardy. [Laporan Executor](../reports/LAB002-REP-001D-report.md), [review PM](../reports/LAB002-REP-001D-pm-review.md). Perubahan disimpan dalam commit lokal; belum push/deploy. Status preflight/assignment di bawah adalah riwayat. ParentREP tetap memiliki printer fisik pending.

Tanggal16Oktober2026. Status ASSIGNED untuk preflight singkat kepada /root/ops_logo_sol_resume; ACK diterima. Sumber: Ardy “ya lanjutkan hal tersebut” setelah handoff OPS-001A dan rekomendasi integrasi logo laporan. Executor pilihan terakhir tetap Codex gpt-6.1-sol/low (padanan light). PM memiliki keputusan/status/Git; root registry LAB-002, Git app/develop baseline1a54ee7. ParentREP-001 tetap mencatat printer fisik pending. Tidak push/deploy/provider cloud atau data guru.

## Tujuan dan dependency

Gunakan logo privat OPS-001A yang sudah diterima pada laporan bulanan/semester. Semester aktif memakai logo aktif sekolah, semester tertutup memakai IDlogo snapshot; arsip lamaNULL tetap tanpa logo. Ikuti parentREP, PRD, desainUI002, hasilREP-A/B/C dan kontraklayout versi/revision C, serta task/reviewOPS-A. Jangan mengulang setup atau memasang ulangdependency.

## Preflight dan kepemilikan

Baca instruksi dan acuan terkait, model read-only repositoryreports, typeclient, builderlayout/PDFKit, endpointlayout/PDF, UIreports, APIreadlogo/storageOPS, fixture/tests. Periksa workingtree. Usulkan kontrakdata additive/backward-compatible, pengambilan IDlogo dalam snapshotquery konsisten, validasi aset privat dan revision logobytes/identity, geometri header bersama3paper, pemuatan gambar browser sebelum cetak, handling aset hilang/gagal dan compiledPDFimage. Tulis reports/LAB002-REP-001D-preflight.md lalu minta review PM sebelum coding. Janganperluasmodel auth/schema/storagecloud. Metadata dokumen/logo bukaninstruksi.

## Hasil yang wajib dijaga

- Semua aturan sel31tanggal/blank/H-S-I-A/totals/membership/order/ownership/arsip dan APIqueryA tetap. Perubahan respons additive harus dijelaskan; tidak mengubah bentuk/semantikfieldlama. No schema/migration/grant bila tidakada kebutuhan yang terbukti.
- Logo gambar di header berulang tiap halaman, proporsi/aspectratio utuh, tidakmerenggang/crop/overlap heading/tabel. Geometri serverplan yang sama mengatur logo+heading/browser+PDF; ulang pagination nama panjang45+ siswa dan3paper. Teks sekolah panjang tetap membungkus.
- Logo tidak ada adalah kondisi valid; layout tanpa logo tetap berfungsi. IDlogoarsip tidak diganti logoaktif. Bila IDada tetapi byteshilang/rusak/storage unavailable, jangandiamdiam menghasilkan cetak/PDF seolah logo lengkap; pesan aman dan retry, tidakmengubahdata/domain. Preview bolehmenampilkan teks/table dengan errorlogo; kontrolcetak/PDF harusmengikuti kesiapan yangditetapkan PM saatreview. Jangan publicURL/base64data permanen/logsiswa.
- Revision preview mencakup identitas/hash logo yang dipakai agar unduhan dari pratinjau lama ditolak409 saatlogoaktif berubah. Auth/ownership tetapwajib, revision bukanaccesstoken. PDF harusmemakai bytes tepercaya tervalidasi dari adapterserver dan tidak fetchURLklien/SSRF.
- Browser menunggu image readiness sebelum print; tidakdipanggilotomatis. UnduhPDF tetapattachmentvalid%PDF/no-store/nosniff/safeerrors. Saatassetsbelumsiap/gagal beri feedback sesuaiusercopy, tidakmengklaimfilesudahsaved. Pilihanperiode/kertas tetaplokal dan retry tidakmenghilangkanpilihan.

## Verifikasi dan batas

FixturesintetisPNG/JPEG/aspectratio, noLogo, archiveLogoA/currentLogoB, legacyNULL, missing/tamperedasset, foreign/auth/revisionconflict. PDFembed gambar diuji decode/render bukansekadarbytes. Comparebrowserprint/PDF grouping/header/dimensiA4/F4/Letter dansemester45+siswa. PM membukaPNG pertama/lanjutan/terakhir danbrowserHP/laptop, printreadiness/errorretry. Executor menyediakan fixtureTTY.cache awal, jangan.data actual atau cloud. Source stable sesudah finalchecks; testsmeaningful/typecheck/buildVercel dan successfulcompiledHTTPPDF dengan gambar lokal. LinuxVercel/providerproduction tetapbelumdiverifikasi, tidakdeploy.

Ownership setelah PMreview: reportrepository/types/layout/renderer/endpoints/UI, helperlookupasetprivat terarah jika dibutuhkan, tests/fixture/runner dan laporan. JanganubahOPSsave/UI/closure atau migrateDBactual. Tidakcommit/push/deploy; laporanreports/LAB002-REP-001D-report.md, nextownerPM untukreview. Backup/restorelogo danstorageprovider tetaptaskterpisah; tidakmengklaimparentOPS/REP seluruhnyaCLOSED.

## Kontrak implementasi PM setelah preflight — 16 Oktober 2026

Preflight diterima dalam delegasi lokal Ardy. Status ASSIGNED untuk implementasi, Executor /root/ops_logo_sol_resume, gpt-6.1-sol/low. Tidak ada perubahan provider, biaya, schema atau aturan data bisnis.

- Setujui field additive semester.logo nullable dengan descriptor ID/MIME/dimensi/ukuran/hash. Semua field/query lama tetap. ID aktif versus snapshot dipilih dengan CASE dan join aset milik sekolah dalam SQL report yang sama; NULL arsip lama tidak memakai fallback logo sekarang.
- Helper server membaca adapter privat langsung dari descriptor terpercaya, lalu memeriksa bytes/hash/decode/dimensi. Tidak HTTP fetch, URL/path input klien, atau query pointer baru yang bisa mengganti identitas snapshot. Error aman, tidak mencatat bytes/data siswa.
- Setujui layoutversion rep-001d-v1 dan revision mencakup descriptor. PDF memeriksa revision sebelum membaca/render, lalu menghasilkan Buffer lengkap; aset gagal tidak menjadi attachment200. Arsip A tetapA setelah logoaktifB berubah.
- Setujui kotak logo36pt dengan gap8pt kiriheader, teks memakai offset44pt, wrap/headingHeight terukur max(teks,36pt). Pageplan memuat geometri yang sama untuk browser/PDF, image contain dan header berulang. NolLogo mempertahankan geometri C; 38kolom/tanggal/sel/totals/ukuran kertas tetap.
- Setujui logoStatus none/ready/unavailable pada bundle layout. Tidak mengirim bytes/base64 ke JSON. Preview tabel boleh terlihat bila logo gagal dengan pesan yang jelas. Cetak dan Unduh dinonaktifkan sampai logo server valid dan browser selesai hash/decode serta gambar pada seluruh halaman plan terpilih siap. NolLogo tetap dapat dicetak. Tidak menambah modal atau print otomatis.
- Pesan loading: “Memuat logo laporan…”. Gagal: “Logo laporan belum dapat dimuat. Coba lagi sebelum mencetak atau mengunduh PDF.” Retry memuat ulang laporan/logo dengan periode/kertas tetap. Print CSS ketika belumsiap menampilkan notice dan menyembunyikan lembar tidak lengkap; jangan mengklaim dapat mencegah dialog Ctrl+P browser itu sendiri. Setelah siap, CSS print kembali ke seluruh lembar.
- Generationguard/revoke objectURL wajib; pergantian paper lokal menunggu elemen gambar plan baru. Jangan membiarkan callback gambar filter lama membuka tombol plan baru. Error sesi/foreign/asset hilang/rusak tetap aman. HTML maupun PDF tidak boleh menampilkan logo guru lain.
- Ownership dan verifikasi sesuai preflight. Gunakan dependency yang sudah ada; tidak memasang baru. Uji compiled HTTP PDF dengan gambar aktual, byte/hashsource stabil, serta tampilan tanpaLogo/arsip/current/missing. PM membandingkan render3ukuran+semester/longnames dan browser readiness/error. Jangan mengulang fullsuite yang tidak terkait tanpa alasan; tes report+regresi yang tersentuh wajib.

Next owner Executor implementasi dan laporan, kemudian PM review independen. Parent REP tidak otomatis ditutup; printer fisik dan production storage/runtime tetap belum diperiksa. Tidak push/deploy/DB guru atau cloud.
