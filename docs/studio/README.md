# Salinan acuan studio

Sumber keputusan aktif tetap registry `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa` dan dokumen produk/workflow studio yang ditautkannya. Salinan ini membantu penelusuran development di repo aplikasi. Salinan bukan sumber keputusan baru.

Urutan baca: [instruksi](governance/instructions.md), [task SET-001](project/tasks/LAB002-SET-001.md), [assignment](project/tasks/LAB002-SET-001-assignment.md), [keputusan aktif](project/decisions-and-confirmations.md), [PRD](product/PROD-002-product-prd-v1.md), [rencana](project/development-plan-v1.md), lalu acuan scope terkait. Protokol asli/workflow/copy/Git tersedia pada `governance/`. Arah UI-001 sudah APPROVED/CLOSED menurut task dan pembaruan keputusan; artefak statis ada pada `project/design/LAB002-UI-001/`. Login/absensi belum diimplementasikan.

Sebagian dokumen sumber mempertahankan ringkasan historis dan menambahkan keputusan terbaru di bagian akhir. Baca bagian baseline dan assignment SET-001 untuk posisi aktif; jangan memakai status lama sebagai keputusan baru. Isi salinan tidak diubah untuk menutupi riwayat itu.

[manifest.json](manifest.json) mencatat asal absolut, tanggal salin, mapping path serta hash source/copy. Requirement dipertahankan; link ke berkas yang ikut disalin diarahkan ke salinannya. Link lokal lainnya tetap menunjuk source asli, sehingga mungkin hanya tersedia di komputer studio. PDF siswa referensi tidak disalin.

Sesudah source berubah, PM wajib memastikan salinan sinkron sebelum task berikutnya. Pada komputer studio, dari root app jalankan `node scripts/sync-studio-docs.mjs`. Script hanya membaca daftar source terarah dan menulis salinan/manifest di app. Periksa perubahan source terbaru sebelum mengerjakan task; jangan mengedit salinan untuk mengubah keputusan. Tidak ada source-of-truth baru atau approval otomatis dari sinkronisasi.
