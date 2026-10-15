# LAB002-REP-001C — Pemeriksaan PM

Tanggal: 16 Oktober 2026. Status: ACCEPTED lokal oleh PM dalam delegasi Ardy, setelah handoff Executor dan pemeriksaan berikut. Task dapat CLOSED untuk scope C; bukan persetujuan deployment atau penerimaan penuh REP-001. Acuan: task REP-001C, preflight, checkpoint15Oktober, PRD dan delegasi penerimaan lokal. Pemeriksaan ini dilakukan PM secara independen pada fixture sintetis; tidak mengakses data guru atau cloud.

## Pemeriksaan langsung PM

- Resume: HEAD develop0393710, empat berkas implementasi cocok hash manifest checkpoint. Tidak restore/reset/install ulang. Assignment pengganti /root/lab002_rep_c_resume, Codex gpt-6-luna/max, ACK diterima. Executor lama tidak aktif.
- Browser Chromium lokal login dengan akun sintetis, membuka halaman laporan, menampilkan periode dan mengunduh berkas lewat tombol Unduh PDF. Unduhan nyata berhasil, download.failure null, nama berkas aman.
- Bulanan48siswa: A4 dua halaman, baris1–32/33–48; F4 dua halaman1–34/35–48; Letter dua halaman1–33/34–48. Kelompok baris sama pada DOM pratinjau, PDF browser dan PDF endpoint. Seluruh48baris muncul sekali.
- PDF endpoint memakai MediaBox A4 841.8898×595.2756pt, F4 935.4331×612.2835pt, Letter792×612pt. Chromium membulatkan A4/F4 sedikit (F4 935.03998×612pt); ini perilaku output cetak browser, bukan perubahan ukuran custom PDF server. Pembagian baris tetap sama.
- SemesterLetter enam bulanJuli–Desember:12halaman pada kedua PDF, masing-masing bulan dua halaman33/15baris, header bulan berulang dan bulan berikutnya mulai halaman baru.
- Browser1440×1000,390×844,320×844: document width sama viewport, lembar tabel memiliki scroll internal. HP390 client358/scroll1056; HP320 client288/scroll1056. Tidak overflow dokumen.
- Seluruh31sel harian+S/I/A untuk48baris DOM bulanan cocok model layout, mismatch0. Header1–31 berulang pada kedua halaman.
- Error503 unduhan disimulasikan: pesan aman, pilihan bertahan, tombol Coba lagi berhasil menghasilkan unduhan. Error409 disimulasikan: unduhan nonaktif, tombol Tampilkan ulang laporan memulihkan.
- Bukti409 nyata: PM mengubah nama satu siswa sintetis menjadi186karakter dan NIPD72karakter melalui API fixture. PATCH200, revision berubah. Unduhan dari pratinjau lama ditolak409. Setelah refresh, PDF berhasil; nama4barisA4/Letter dan3barisF4. NIPD membungkus; tidak terpotong atau keluar sel pada renderA4. Perubahan ini hanya fixture sementara, bukan data guru.
- Keadaan kosong: ganti semester arsip kosong menghapus preview dan menonaktifkan unduhan. Tampilkan laporan menghasilkan pesan Tidak ada siswa pada periode ini, nol tabel, Cetak/Unduh nonaktif.
- Render PNG diperiksa langsung: F4 halaman pertama dan A4 nama/NIPD multiline pada PDF browser dan endpoint. Tabel/header/nama utuh. Posisi teks NIPD browser terpusat dan PDF kiri tidak mengubah isi/kelompok baris. Ekstraksi teks global kadang mengurutkan baris multiline berbeda; bukan bukti identitas/nilai hilang. Kesamaan dinilai melalui model/sel/rowgroups dan render, bukan byte-identik.

Artefak sintetis lokal ignored: app/output/playwright/rep001c (skrip pemeriksaan, screenshotHP/laptop, PDF bulanan3ukuran, semesterLetter, nama multiline dan PNG). Akun/sandi fixture tidak dicatat di laporan/Git.

## Review source dan batas

PM membaca perubahan helper/layout/PDF endpoint dan UI/state. API/modelA tetap dipertahankan; PDFKit hanya server, tidak ada perubahan schema/grant/auth/driver. Temuan awal empty helper yang menjadi503 dikirim ke Executor dan diperbaiki: layout kosong200, PDF kosong422; keadaan UI kosong lulus browser. Belum ada commit/push/deploy untuk C.

Tes Executor, build dan smoke dicatat setelah laporan final. Respons401 dari server hasil build dan render helper terkompilasi merupakan bukti parsial; PM meminta HTTP200 layout/PDF dengan fixture sintetis sebelum menerima AC runtime.

Printer fisik belum diuji. Logo privat dan snapshot logo arsip masih dependency OPS terpisah; parentREP-001 belum selesai. Tidak mengklaim fitur laporan telah tersedia pada website production.

## Hasil teknis final dan keputusan

Laporan Executor16Oktober: test:reports8/8 (regresi modelA+layout/PDF/HTTP/read-only), typecheck dan buildVercel lulus memakai Node24.19.0/npm10.9.3 pada salinan build terisolasi. PM membaca source/diff dan laporan, mencocokkan sendiri SHA256 delapan file checkout dengan salinan build: semuanya sama. Tidak ada source berubah sesudah checks. Manifest function masih nodejs24.x/sin1. Client bundle tidak memuat PDFKit/fontkit menurut pemeriksaan Executor.

Gap runtime diselesaikan sebelum penerimaan: Executor menjalankan entrypoint Vercel terkompilasi melalui HTTP Node24, memakai PostgreSQL16 sementara dan akun sintetis. Login berhasil, layout200/no-store/nosniff dengan satu siswa, PDF200/attachment/no-store/nosniff,2693byte,%PDF-,MediaBoxF4 tepat. Ini bukti runtime terkompilasi lokal, bukan deployment. PM tidak mengulangi suite otomatis yang sudah lulus tanpa perubahan; PM memeriksa browser/unduhan/render secara independen sebagaimana rincian di atas.

Fixture browser STOP TTY exit0; direktori reports-fixture sementara dihapus; PM memverifikasi port64419 tidak listening. Browser PM rep-c-pm ditutup. Cluster smoke/password sementara dibersihkan menurut handoff Executor. Output build terisolasi dan artefak uji tetap ignored lokal untuk penelusuran.

Keputusan PM: AC scope C terpenuhi, diterima lokal berdasarkan delegasi Ardy dan local-delivery-contract-v1.md. Catatan Executor bahwa acceptance terpisah dipenuhi oleh review ini; tidak membutuhkan approval ulang untuk task lokal yang sudah didelegasikan. TaskC CLOSED; perubahan disimpan dalam commit lokal, parentREP-001 tetap terbuka untuk logo/arsip logo serta printer fisik. Tidak push/main/deploy/cloud/data guru. Penanggung jawab berikut PM untuk dependency OPS dan persiapan task berikut, bukan meluncurkan laporan ke produksi otomatis.
