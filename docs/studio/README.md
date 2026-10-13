# Salinan acuan studio

Sumber keputusan aktif tetap registry `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa` dan dokumen produk/workflow studio yang ditautkannya. Salinan ini membantu penelusuran development di repo aplikasi. Salinan bukan sumber keputusan baru.

Urutan baca: [instruksi](governance/instructions.md), [checkpoint](project/resume-checkpoint.md), task aktif serta laporan terbaru, [keputusan](project/decisions-and-confirmations.md), [PRD](product/PROD-002-product-prd-v1.md), lalu [rencana](project/development-plan-v1.md) dan acuan scope terkait. Protokol asli/workflow/copy/Git tersedia pada `governance/`. SET-001 dan artefak UI-001 merupakan baseline historis; login dan absensi lokal sudah tersedia. Persiapan cloud dibahas pada [PRE-001](project/tasks/LAB002-PRE-001.md), [pemeriksaan PM](project/reports/LAB002-PRE-001-pm-validation.md), dan [CLOUD-DATA-001](project/tasks/LAB002-CLOUD-DATA-001.md). Periksa sumber registry untuk delta setelah salinan ini dibuat.

Sebagian dokumen sumber mempertahankan ringkasan historis dan menambahkan keputusan terbaru di bagian akhir. Baca bagian baseline dan assignment SET-001 untuk posisi aktif; jangan memakai status lama sebagai keputusan baru. Isi salinan tidak diubah untuk menutupi riwayat itu.

[manifest.json](manifest.json) mencatat asal absolut, tanggal salin, mapping path serta hash source/copy. Requirement dipertahankan; link ke berkas yang ikut disalin diarahkan ke salinannya. Link lokal lainnya tetap menunjuk source asli, sehingga mungkin hanya tersedia di komputer studio. PDF siswa referensi tidak disalin.

Sesudah source berubah, PM wajib memastikan salinan sinkron sebelum task berikutnya. Script `scripts/sync-studio-docs.mjs` memiliki daftar source terarah; periksa daftarnya sebelum menjalankan agar dokumen task yang ditambahkan belakangan tidak hilang dari manifest. PM dapat menyalin delta terarah serta memperbarui hash source/copy di manifest. Jangan mengedit salinan untuk mengubah keputusan. Tidak ada source-of-truth baru atau approval otomatis dari sinkronisasi.
