# Pemeriksaan PM — LAB002-REP-001B

Tanggal: 15 Oktober 2026. Hasil: PASS untuk UI/pratinjau/cetak browser lokal tanpa logo. Penerimaan PM berdasarkan delegasi pengelolaan/pengujian lokal Ardy, bukan pengujian setiap kondisi oleh Ardy. Task induk REP-001 tetap belum lengkap.

## Acuan dan scope

PRD R11–R14, kontrak lokal C05, desain UI-002 layar15–19, task B, model/API A pada commit9c8b57f, workflow dan kualitas interaksi studio. Checkout develop. PM membaca source halaman reports.vue, tipe client, navigasi/beranda, CSS terarah dan fixture script. Tidak ada perubahan model/API/auth/schema/dependency atau konfigurasi cloud. Tipe client tidak mengimpor modul database ke browser.

## Fungsi dan data — bukti PM independen

Playwright CLI session repb-pm, Chromium headless, fixture PostgreSQL16/Nuxt loopback terisolasi dengan48 siswa sintetis, nama panjang, NIPD/JK kosong, semester aktif/arsip/kosong. Tidak memakai akun atau data guru. URL fixture sementara bukan URL untuk penggunaan harian.

- Akses /reports tanpa login dialihkan ke /login. Login akun sintetis lalu halaman laporan berhasil; default semester aktif, mode Bulanan dan bulan awal Juli2026, belum mengirim report sampai tindakan Tampilkan laporan.
- Pemuatan bulanan menampilkan48 baris. Mode semester Juli–Desember2026 menghasilkan6 tabel berurutan dengan48 baris per bulan. PM membandingkan seluruh nama,31 sel dan total S/I/A pada DOM setiap bulan dengan respons API: cocok.
- Mengganti bulan membuang hasil lama dan menonaktifkan Cetak. Saat request sengaja ditunda1,5detik lalu mode diganti, respons lama tidak memunculkan hasil; Cetak tetap nonaktif sampai pemuatan pilihan baru.
- Simulasi API503 melalui browser interception menampilkan pesan gagal dan Coba lagi; pilihan semester/bulan/kertas bertahan. Setelah interception dilepas, coba lagi memuat laporan dengan benar. Error503 pada console adalah skenario uji yang disengaja.
- Arsip kosong menampilkan pesan Tidak ada siswa pada periode ini, tidak merender tabel (jumlah0), dan Cetak nonaktif. UI tanpa sekolah dan tanpa semester diuji lewat mock respons browser pada navigasi client: menampilkan Atur data sekolah dan Kelola semester yang sesuai, tanpa membuat data.
- PM memblokir script Nuxt pada pemuatan SSR: Tampilkan laporan dan Cetak nonaktif. Setelah script diizinkan dan halaman dimuat ulang, kontrol aktif serta48 baris dimuat; URL tetap /reports, tanpa native GET form yang salah.

## Tampilan dan interaksi

Viewport1440×1000: filter dan tombol berada dalam card; lebar dokumen1440. Viewport390×844: pilihan/aksi terlihat dan tabel dapat digulir di area sendiri. Viewport320×844: nav3kolom×2baris terbaca, lebar dokumen320; area tabel258px dengan konten1888px dapat digulir hingga1630px. Nama panjang membungkus dan nilai optional kosong.

PM membuka screenshot desktop, HP390 dan HP320 setelah perbaikan. Kontrol memakai label, radio group, header tabel, status/alert dan fokus yang dapat dikenali. Bukti viewport bukan uji perangkat HP fisik atau seluruh browser.

## Cetak browser

PM membuat keluaran PDF dari browser dengan preferCSSPageSize untuk memeriksa CSS print; ini bukan endpoint fitur Unduh PDF. Hasil bulanan48siswa:

| Kertas | Halaman | Ukuran MediaBox yang dibaca pdfinfo |
|---|---:|---|
| A4 mendatar | 2 | 841,92×594,96pt |
| F4 mendatar | 2 | 935,04×612pt |
| Letter mendatar | 2 | 792×612pt |

CSS F4 memakai33cm×21,6cm; output Chromium membulatkan ukuran. Header1–31/S/I/A dan baris siswa utuh, header berulang pada halaman lanjutan, tanpa halaman kosong tambahan. PM merender PNG dan memeriksa halaman pertama/lanjutan ketiga ukuran. Semester6bulan pada Letter menghasilkan12halaman; setiap bulan dimulai pada halaman baru. Navigasi/filter/tombol tidak tercetak. Window.print diganti spy saat satu klik Cetak: terpanggil1kali; dialog sistem/printer fisik tidak diperiksa.

Artefak lokal: app/output/playwright/rep001b/{laptop.png,hp.png,hp320.png,empty.png,a4.pdf,f4.pdf,letter.pdf,semester-letter.pdf} dan render page PNG. Artefak berasal fixture sintetis, diabaikan Git lokal; laporan ini menyimpan ringkasan evidence. Skill Playwright dan PDF digunakan untuk browser serta pemeriksaan render, tanpa dependency produksi tambahan.

## Revisi dan verifikasi

1. Header tanggal bulan pendek diseragamkan1–31, dimensi kertas terlihat dan empty-month message tidak ikut cetak.
2. Grid filter overflow pada1440 diperbaiki berdasarkan lebar kontainer; tombol kembali di dalam card.
3. Named-page CSS semula menghasilkan halaman kosong portrait di akhir. Diganti satu aturan @page mengikuti pilihan; tiga ukuran lulus pemeriksaan ulang.
4. Nav320 yang rapat setelah tautan Laporan ditambahkan diperbaiki menjadi grid3×2.
5. Submit sebelum hydration semula menyebabkan native GET tanpa laporan. Guard client-ready memperbaiki; pemeriksaan dengan script diblokir dan diizinkan kembali lulus.

Executor melaporkan typecheck dan build Nuxt final exit0 pada bundled Node24.19.0 setelah guard; DEP0155 dependency warning tidak menggagalkan build. Diff-check exit0 (peringatan LF/CRLF). PM memeriksa actual diff/output dan menguji browser independen; tidak mengulang suite API karena source model/API tidak berubah. Build bukan bukti deployment.

## Batas dan next owner

Belum ada logo, tombol/endpoint Unduh PDF, hasil printer fisik, uji cloud atau deployment versi ini. Hasil fisik tetap bukti yang diperlukan untuk laporan lengkap, bukan penghalang subtask UI lokal yang memisahkan bukti tersebut sejak brief. Next PM: persiapan PDF nyata dan dependency logo privat/arsip, kemudian review laporan lengkap. Tidak ada push/deploy/data production berubah.

Handoff final diterima: fixture pertama ditutup dan browser PM ditutup. Defect runner masih menunggu stdin setelah STOP diperbaiki hanya pada tooling MJS (named handler dilepas dan stdin dipause). Executor melakukan rehearsal start/STOP lewat TTY; runner exit0, root fixture terhapus, port54036 tanpa listener, tidak ada proses fixture tersisa menurut pemeriksaan Executor. Run non-TTY sebelumnya bukan bukti STOP; child milik fixture dihentikan secara terarah dan cleanup berjalan. Typecheck/build final mencakup kode UI akhir; perbaikan MJS sesudahnya diverifikasi lewat lifecycle rehearsal, bukan diklaim diuji oleh build sebelumnya.

Task B CLOSED melalui delegasi penerimaan lokal setelah source review, evidence browser independen dan handoff cleanup lengkap. Cetak fisik serta task induk tetap belum selesai.
