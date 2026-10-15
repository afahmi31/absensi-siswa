# LAB002-REP-001D — Pemeriksaan PM

Tanggal: 16 Oktober 2026. Status ACCEPTED lokal melalui review PM dalam delegasi Ardy. Scope lokal integrasi logo laporan setelah OPS-001A; Executor GPT-6.1 Sol/low sesuai pilihan Ardy. Tidak push/deploy, migration, cloud atau data guru.

## Bukti PM

PM membaca preflight, mengunci kontrak pada task, lalu membaca perubahan repository report, helper logo, layout/PDF endpoint dan UI. Model menambah descriptor logo dari SQL snapshot yang sama, CASE closed memakai archive.logo_asset_id (NULL tidak fallback). Bytes dibaca adapter privat dan diperiksa hash/decode. Revision memasukkan descriptor; tidak menerima URL/path klien. API/logo tetap terlindungi.

Fixture sintetis48siswa: aktif JPEGtegak80×240, arsip PNGlebar240×80, arsip tanpaLogo dengan satu siswa. Browser Chromium laptop1440×1000,HP390×844/320×844.

- BulananA4,F4,Letter: tombol unduh menghasilkan PDF nyata, download.failure null. Masing-masing dua halaman. Pembagian baris A4 1–32/33–48; F4 1–34/35–48; Letter1–33/34–48. Ekstraksi PDF browser dan endpoint menunjukkan kelompok baris sama serta satu image setiap halaman. Dimensi endpoint A4 841.8898×595.2756pt; F4 935.4331×612.2835pt; Letter792×612pt. Pembulatan Chromium A4/F4 seperti buktiC tetap terpisah.
- SemesterLetter enam bulan menghasilkan12lembar DOM,12logo,288baris. PDF endpoint12halaman; PDF browser dengan media print12halaman, kelompok baris sama dan satu gambar pada seluruh halaman.
- Arsip menampilkan PNGlebar240×80, berbeda dari logo aktif JPEGtegak80×240. LegacyNULL dengan siswa memberi logoStatus none, nolimg dan tombol aktif; tidak memakai fallback logo sekarang.
- Logo ditahan melalui route browser: status Memuat logo, Cetak/PDF disabled. Simulasi503 menunjukkan pesan aman, tabel dua halaman tetap terlihat, PDF disabled; print media menyembunyikan preview yang tidak lengkap. Setelah route dipulihkan, Coba lagi berhasil tanpa mengubah bulan2026-07 atau paperLetter.
- HP320/390 documentwidth sama viewport. Screenshot lokal tersimpan; tabel tetap dapat digeser mendatar, layout halaman tidak meluber.
- PM mengubah nama satu siswa sintetis menjadi186karakter, NIPD72karakter, dan nama sekolah/kelas panjang. Semua PATCH/PUT200, lalu refresh dan PDF A4 berhasil. Nama/NIPD membungkus empat baris tanpa clipping. Render logo/header/tabel A4 diperiksa langsung, juga F4 halaman pertama, PNGarsip halaman lanjutan dan semester halaman terakhir.
- PM membuka render PNG; logo mempertahankan rasio, tidak menutupi heading/tabel. PDF images dihitung dan ukuran asli diinspeksi melalui pdfplumber. Ini bukan pengujian printer fisik.

Kesalahan harness PM dicatat: skrip state mengakhiri emulasi screen sehingga PDF semester awal14halaman memakai CSS layar (nav ikut tercetak). Executor menelusuri teks nav, PM mengulang dengan emulateMedia print dan hasil12/12 sesuai. Tidak ada source produk yang diubah untuk menyelesaikan kesalahan ini. Tampilan gambar panjang pada tool juga perlu dibedakan dari PDF aktual; bukti struktur/teks/render halaman tetap dipakai.

Artefak sintetis ignored: app/output/playwright/rep001d berisi PDF3paper, arsip,semester,namapanjang,PNG dan skrip. Kredensial fixture tidak dicatat di Git. Browser repd-pm ditutup. Menunggu konfirmasi cleanup fixture dan hasil final source/build stabil sebelum acceptance.

## Batas

Provider penyimpanan production dan Sharp/Linux Vercel belum disiapkan/diverifikasi. Tidak menganggap hasil lokal sebagai fitur online. Parent REP masih memiliki printer fisik pending; parent OPS masih cadangan/pemulihan aset. Tidak menambahkan backup atau storagecloud ke scope D.

## Hasil final dan keputusan

PM membaca laporan Executor, source/diff dan manifest compiled. Pemeriksaan independen86hash source terhadap .cache/REP001D-compiled-evidence.json menghasilkan0mismatch. Tes report9/9PASS/0fail/0skip menurut log/laporan Executor, termasuk regresiA/C serta identitas snapshot/revision409/aset hilang-tampered/readyretry. Typecheck akhir, buildVercel dan node-server terisolasi lulus; compiled Windows Node24 HTTP login/layout/PDF200 dengan gambar,12halaman. DecodePDF36halaman Executor memeriksa gambaraktual dan header; bukti PM terpisah pada perbandingan browser/endpoint di atas.

Keputusan PM: scope REP-001D terpenuhi dan diterima lokal sesuai delegasi Ardy. TaskD CLOSED dengan commit lokal develop; tidak push/deploy. ParentREP tetap terbuka untuk bukti printer fisik dan penerimaan versi rilis sesuai target; jangan mengklaim seluruhv1 atau production sudah selesai. Provider storage permanen, Linux Vercel dan backup/restore aset tetap dependency lain. Source OPS save/schema/auth tidak berubah.

Browser PM sudah ditutup; Executor diminta STOP fixture sesudah semua pemeriksaan. Checkpoint aktif berikut mengacu pada commit hasil task, bukan mengulang desain/laporanA–D.
Cleanup final: Executor STOP TTY82294 exit0, folder reports-fixture-q07krJ dihapus, port65095 tidak listening dan proses terkait tidak ditemukan. Tidak ada perubahan source sesudah verifikasi final.
