# PREFLIGHT REPORT

Task ID: `LAB002-REP-001C`
Tanggal: 15 Oktober 2026
Tahap: preflight-only; tidak ada implementasi atau pemasangan paket.

## Repository dan acuan

- App root: `Labs/LAB-002-website-absensi-siswa/app`; branch `develop`, HEAD `0393710dc0c788ffc4ef65b9fb5e07f88f180647` (`0393710`), working tree bersih saat diperiksa; branch lokal ahead 3 dari `origin/develop`.
- Stack deklaratif: Nuxt 4.6.1 / Vue / TypeScript, Node `>=24.15.0 <25`, npm `10.9.3`; preset build Vercel dan function runtime `nodejs24.x`/region `sin1`.
- Instruksi: AGENTS workspace dari Ardy; Protokol PM & Executor v1.0; workflow dan keputusan studio; tidak ditemukan AGENTS/AGENT bersarang di registry LAB-002.
- Acuan dibaca: PRD R11–R14, Kontrak Delivery Lokal C05, task induk REP-001, task/review PM REP-001A dan REP-001B, UI-002 layar 15–19 serta review PM, README registry/app, kontrak environment dan Git.
- `decisions-and-confirmations.md` menyimpan status C05 awal `OPEN`; kontrak lokal tanggal 12 Oktober menyatakan keputusan PM di bawah delegasi menggantikannya. PM juga mengonfirmasi provenance itu dan mencatat pembaruannya. Saya memakai aturan kontrak lokal/task saat ini; C05 bukan blocker preflight.

## Source aktual yang diperiksa

- `server/api/reports/[semesterId].get.ts` mewajibkan sesi guru, memvalidasi semester/mode/bulan, dan meneruskan hasil model. Query model mengikat owner serta membentuk data bulan, hari, membership, sel, dan total status efektif dengan satu query set-based baca-saja. Ini dapat dipakai ulang tanpa migrasi atau perubahan arti data.
- `app/pages/reports.vue` meminta model saat Tampilkan. Pilihan kertas mengatur `@page` lokal (margin 6 mm); browser Chromium sendiri menentukan aliran halaman melalui `thead { display: table-header-group }`, `break-inside: avoid` pada baris, dan pemisah antarbulan. API A tidak menerima kertas dan tidak mengirim batas halaman.
- PM menerima B setelah menguji 48 siswa sintetis pada preview/cetak browser, termasuk tiga ukuran dan nama panjang. Bukti itu memvalidasi CSS browser, bukan kesamaan batas halaman dengan PDFKit.
- Fixture `scripts/fixture-reports.mjs` sudah memuat 48 siswa, tiga nama sangat panjang, NIPD/JK kosong, semester aktif parsial, arsip dan semester kosong; `tests/reports.test.ts`/`scripts/test-reports.mjs` menguji model/API A. Tes PDF dan layout belum tersedia.

## PDFKit dan ukuran kertas

- Manifest/lock belum memiliki PDFKit. Metadata registry read-only: kandidat `pdfkit@0.20.2`; `npm view` tidak mengembalikan field `engines` atau `types`. `@types/pdfkit@0.17.6` menyediakan `index.d.ts`; belum dipasang.
- Dokumentasi resmi menyebut Node build PDFKit memakai Node stream dan dapat pipe ke response; ukuran custom menerima `[width, height]` dalam point (72 point/inci). Node 24/Vercel compatibility serta tracing berkas dependency dalam function bundle belum terbukti dan perlu dibuktikan setelah pin/install lokal yang diotorisasi.
- PDFKit menyediakan Helvetica bawaan Node dan metode ukur `widthOfString`/`heightOfString`; belum ada font TTF/OTF/WOFF aplikasi yang ditemukan. Gunakan font bawaan tanpa aset baru bila cakupan glyph Indonesia/Latin dasar lolos test. Pastikan build Vercel memaketkan semua runtime PDFKit yang diperlukan.
- Pakai dimensi task sebagai sumber tepat: A4 `297×210 mm` (`841.89×595.28 pt`), F4 `330×216 mm` (`935.43×612.28 pt`), Letter `279.4×215.9 mm` (`792×612 pt`), landscape. `FOLIO` bawaan PDFKit (`936×612 pt`) sedikit berbeda dari F4 task; F4 sebaiknya memakai array custom, bukan nama ukuran preset.
- Rujukan resmi: [PDFKit getting started](https://pdfkit.org/docs/getting_started.html), [paper sizes](https://pdfkit.org/docs/paper_sizes.html), [text wrapping and measurements](https://pdfkit.org/docs/text.html); metadata [pdfkit](https://www.npmjs.com/package/pdfkit) dan [@types/pdfkit](https://www.npmjs.com/package/@types/pdfkit).

## Usulan parity browser/PDF

1. Pertahankan GET model A dan response-nya agar backward-compatible. Tambahkan helper layout server-only yang menerima hasil model A dan spesifikasi ukuran/margin/font; hitung urutan halaman/bulan, kumpulan row ID, tinggi baris, serta pemenggalan nama eksplisit memakai metrik font PDFKit.
2. Tambahkan satu GET layout JSON terlindungi dan `no-store` yang memuat model + page plans untuk **ketiga** kertas dalam satu aksi Tampilkan. Pilihan kertas di halaman B kemudian memilih plan lokal tanpa memuat ulang; tidak membawa PDFKit ke bundle browser.
3. PDF GET menggunakan helper, data model, dan plan yang sama lalu menggambar setiap halaman secara eksplisit. Preview/cetak browser mengonsumsi plan identik dan merender page wrapper, tinggi/baris serta line break eksplisit; jangan biarkan Chromium dan PDFKit membuat pagination table masing-masing.
4. Pertahankan bulan baru pada halaman baru, header tabel di setiap halaman lanjutan, urutan row yang sama, baris tidak terpotong, 31 kolom/totals, serta empty month sesuai kontrak. Semua endpoint layout/PDF tetap auth + owner scoped; tidak menulis DB.

## File/kontrak yang mungkin terdampak setelah PM mengotorisasi tahap implementasi

- Baru: helper layout/render server-only dan GET layout JSON; GET PDF terpisah.
- Perlu perubahan terarah: `app/pages/reports.vue` untuk menampilkan plan yang diterima; tipe layout client yang hanya berisi data; tests/runner/fixture dan package/lock untuk pin runtime PDFKit (plus tipe hanya bila dibutuhkan).
- Ini menambah kontrak API layout dan mengubah sumber pagination pratinjau/cetak. Task meminta PM meninjau perubahan tersebut; tidak dilakukan pada preflight ini.
- Logo privat/snapshot arsip belum termasuk bukti B dan tetap dependency OPS sebelum REP-001 induk lengkap. Tidak membuat placeholder atau logo palsu.

## Verification saat implementasi

- Tes layout pada 48+ fixture untuk semua ukuran: setiap row muncul tepat sekali, tidak terpecah, tiap bulan mulai sesuai aturan, header berulang, nama multiline utuh, 31 tanggal/S-I-A sama dengan model, tanpa halaman kosong.
- Bandingkan page plan JSON, DOM/print browser, serta PDF output per kertas; periksa ukuran page point, jumlah halaman, first/continuation/last page, nama panjang dan fixture empty/archive.
- Tes GET auth/owner/not-found/parameter/paper, no-store/nosniff, MIME/disposition, `%PDF`, retry/error tanpa PDF sukses palsu, dan read-only DB. Jalankan typecheck, suite terkait, build preset Vercel dan Node 24 runtime smoke; inspeksi output function untuk runtime PDFKit/font files. PM melakukan browser/PNG validation.

## Risiko, blocker, dan keputusan preflight

- Risiko utama: metrik Arial browser dan Helvetica PDF dapat berbeda. Page plan dan name-line breaks eksplisit adalah cara yang direkomendasikan; tetap harus diperiksa pada hasil cetak Chromium dan render PDF, termasuk overflow teks aktual.
- Versi 0.20.2 baru kandidat, bukan verified Node24; jangan klaim kompatibel hanya dari metadata registry. Bukti wajib berasal dari install terkunci, typecheck/build Vercel Node24 dan smoke render lokal terisolasi.
- Blocker preflight: tidak ada. **Preflight siap direview PM.** Implementasi ditahan sampai PM meninjau/menetapkan kontrak layout JSON + perubahan preview, dan memfinalkan pin/verification PDFKit. Task induk REP-001 tetap terbuka.
- Batas pemeriksaan: tidak memasang dependency, tidak menjalankan build/test baru, tidak membaca `.data`/kredensial/data guru, tidak memakai cloud. Next owner: PM untuk review preflight dan otorisasi tahap implementasi.
