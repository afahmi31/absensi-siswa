# LAB002-REP-001C — Laporan Executor

Tanggal laporan: 16 Oktober 2026
Baseline saat resume: `develop` pada `0393710dc0c788ffc4ef65b9fb5e07f88f180647`
Status Executor: `IMPLEMENTED`; pemeriksaan PM dan persetujuan Ardy tetap merupakan langkah terpisah.

## Hasil implementasi

- `GET /api/reports/:semesterId/layout` mengembalikan model laporan yang sama dengan REP-001A beserta rencana A4, F4/Folio, dan Letter. Rencana menyimpan ukuran kertas, 38 lebar kolom, pemenggalan teks, tinggi baris, pengulangan header, dan pagination per bulan. Model dengan semua bulan kosong tetap mendapat respons layout agar UI menampilkan keadaan kosong.
- `GET /api/reports/:semesterId/pdf` memvalidasi mode, bulan, ukuran kertas, dan revision. Revision dihasilkan deterministik dari versi layout, model, dan rencana; metadata tanggal PDF tidak ikut dihitung. Revision lama memberi `409`; PDF semester tanpa siswa memberi `422`. Route merender Buffer di server, lalu mengirim attachment PDF dengan `no-store`, `nosniff`, tipe dan panjang konten yang sesuai, serta nama berkas yang dibentuk dari nilai tervalidasi.
- Halaman laporan memuat layout bersama untuk pratinjau dan cetak. Pilihan kertas tetap lokal di halaman. Aksi unduh mengambil PDF melalui sesi yang sama, memeriksa MIME dan signature `%PDF-`, memulai unduhan blob, serta memberi status coba lagi atau tampilkan ulang saat error/revision basi.
- Renderer memakai PDFKit dan font standar bawaan Helvetica. Ukuran F4 dibuat khusus 330 × 216 mm. Bulan tanpa siswa dalam semester berisi siswa tetap memiliki heading dan header tabel tanpa baris siswa palsu.

## File kode yang ditambahkan atau diubah untuk task

- Diubah: [`reports.vue`](../app/app/pages/reports.vue) — pratinjau dan cetak memakai page plan server, aksi unduh PDF dan pemulihan error.
- Diubah: [`report-export.ts`](../app/server/utils/report-export.ts) — helper layout, revision, pagination, deteksi laporan kosong, dan renderer Buffer PDFKit.
- Ditambahkan: [`layout.get.ts`](../app/server/api/reports/[semesterId]/layout.get.ts) — endpoint layout terlindungi.
- Ditambahkan: [`pdf.get.ts`](../app/server/api/reports/[semesterId]/pdf.get.ts) — endpoint PDF terlindungi.
- Diubah: [`reports.test.ts`](../app/tests/reports.test.ts) — uji layout/PDF untuk tiga kertas dengan 48 siswa sintetis dan uji HTTP terhadap route baru serta regresi REP-001A.

`app/types/attendance-report.ts`, `package.json`, dan `package-lock.json` sudah berisi tipe layout dan pin `pdfkit@0.20.2` / `@types/pdfkit@0.17.6` pada checkpoint sebelum resume. Saya mempertahankan perubahan itu tanpa memasang ulang dependency. Perubahan dokumentasi/task/checkpoint yang tampak di working tree adalah milik PM dan tidak saya ubah. Tidak ada commit.

## Pemeriksaan Executor

Semua proses Node/npm yang menjalankan pemeriksaan memakai Node `v24.19.0` dari runtime bundled dengan Node24 di `PATH` agar child process juga memakai versi itu.

- `npm run test:reports` — lulus, 8/8. Meliputi model REP-001A dan baca-saja, plus layout/PDF helper dan endpoint: konten layout sama dengan REP-001A, revision stabil, F4 tepat, PDF ber-signature benar, revision basi `409`, auth/ownership, layout kosong `200`, PDF kosong `422`, dan data baca-saja tidak berubah.
- `npm run typecheck` — lulus pada salinan build terisolasi yang identik dengan sumber saat build.
- `npm run build` dengan preset Vercel — lulus pada `app/.cache/rep001c-vercel-build-20261016`; output lama di `.vercel/output` dan `.output` checkout utama tidak ditimpa.
- SHA-256 delapan file sumber terkait cocok antara checkout saat ini dan salinan build. Tidak ada perubahan sumber setelah pemeriksaan build atau sesudah smoke runtime.

| File | SHA-256 |
| --- | --- |
| `app/pages/reports.vue` | `4782BC335C38BE2957ECDACEF71993D138F8AE7E66BD4021FBFE7F555EA4248D` |
| `app/types/attendance-report.ts` | `4BAC3274CFEA95EFDFBF08DABF3C151F79221736EE4604EFA3F1BF4F9915A171` |
| `server/utils/report-export.ts` | `2D74722C71097F78FA82FB142F9C2B09B134CC2186AFD1C930B9C7BCCBD88733` |
| `server/api/reports/[semesterId]/layout.get.ts` | `4DCB8E3C242BE2F09CFDE183A8EBCEFB15C04E9B3F6906E58DCCE5832D9DC5B6` |
| `server/api/reports/[semesterId]/pdf.get.ts` | `F5543862EBB40DEA3BD3CD4F67D5565BBBF451167D2608E6DBEB403CB6FF0860` |
| `tests/reports.test.ts` | `2792ACBFFB6A163A830A378B8938941F067550A89393DC357796863457EA7452` |
| `package.json` | `9829555BDBC93717C029E804841C4EBC86BEEAF99162653FD899364279641A9D` |
| `package-lock.json` | `5143A7EDDCAC3CD0A7BCECA8288A0E6E84678EE8998B630454067F0CA40804BA` |

## Smoke runtime dan bundle

Hasil build Vercel berisi `pdfkit@0.20.2` dan `fontkit@2.0.4` pada dependency function. Paket PDFKit yang ikut bundle memiliki font standar Helvetica. Pencarian asset client `.vercel/output/static/_nuxt` tidak menemukan referensi PDFKit/fontkit.

Helper hasil kompilasi Vercel dijalankan di Node24 dan menghasilkan PDF F4 valid; signature `%PDF-`, revision deterministik, dan MediaBox `935.4331 × 612.2835 pt` cocok dengan 330 × 216 mm.

Smoke HTTP yang lebih lengkap menjalankan entrypoint function Vercel terkompilasi di server Node24, memakai PostgreSQL 16 ephemeral serta akun, sekolah, semester, dan satu siswa sintetis. Login, `GET layout` dan `GET pdf` semuanya diuji lewat HTTP. Layout memberi `200` dengan satu row; PDF memberi `200`, attachment dan `no-store`/`nosniff`, 2.693 byte ber-signature `%PDF-`, dan MediaBox F4 yang sesuai. Cluster dan file password sementara telah dibersihkan; tidak memakai data `.data` nyata atau service cloud.

## Pemeriksaan browser independen PM

Menurut hasil PM pada 16 Oktober 2026, unduhan bulanan untuk ketiga ukuran kertas lulus dengan 48 siswa dan dua halaman; baris pada PDF cocok dengan pratinjau browser. Semester Letter menghasilkan 12 halaman untuk enam bulan. Pratinjau ponsel pada lebar 320 dan 390 px tidak membuat document overflow. DOM memiliki 48 baris, seluruh 31 tanggal serta kolom S/I/A cocok dengan model; header tanggal 1–31 berulang pada halaman berikutnya.

PM juga mengubah satu data **sintetis** menjadi nama 186 karakter dan NIPD 72 karakter. Revision berubah, server memberi `409`, lalu setelah pratinjau dimuat ulang, PDF A4 membungkus nama dan NIPD menjadi empat baris tanpa clipping menurut inspeksi render. Keadaan kosong, retry setelah respons `503` simulasi, serta pemulihan `409` simulasi juga lolos. Ekstraksi teks PDF berbeda pada whitespace dan urutan baris multiline saja; inspeksi render PM tidak menemukan teks hilang atau terpotong.

Fixture browser laporan dihentikan melalui `STOP` pada TTY yang menjalankannya. Proses keluar dengan kode 0, tidak ada direktori `reports-fixture-*` yang tertinggal, dan port loopback fixture tidak lagi listening. Akun dan data sintetis fixture tidak dicatat di laporan ini.

## Batas hasil

Build dan smoke membuktikan bundle serta route pada runtime lokal Node24, bukan deployment Vercel atau produksi. Tidak ada deployment, commit, perubahan schema/auth/session/REP-001A, atau pengujian printer fisik. Validasi browser PM adalah pemeriksaan independen; persetujuan akhir tetap menunggu Ardy.
