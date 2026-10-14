# LAB002-REP-001B — Laporan Executor

Tanggal: 15 Oktober 2026
Hasil Executor: IMPLEMENTED, menunggu review formal PM. Task induk REP-001 tetap terbuka.

## Hasil

Halaman `/reports` menampilkan rekap bulanan atau semester dari GET laporan REP-001A. Default memilih semester aktif, atau semester terbaru jika tidak ada yang aktif; mode awal bulanan dan bulan awal semester. Pilihan ukuran kertas tetap ada saat semester diganti. Data sel dan total ditampilkan sesuai respons API, tanpa menghitung ulang total di browser.

Pembaruan pilihan membatalkan pratinjau lama sampai laporan baru dimuat. Penanda generasi request mencegah respons terlambat menggantikan pilihan terbaru. State loading, gagal/coba lagi, belum dimuat, periode tanpa siswa, sekolah belum disiapkan, dan tidak ada semester mempunyai copy serta tindakan yang sesuai flow existing. Tombol Tampilkan/Cetak nonaktif sampai client selesai mount, sehingga submit form native tidak mendahului hydration. Cetak hanya berjalan dari tindakan guru setelah laporan sesuai pilihan berhasil dimuat dan memiliki siswa.

Mode semester menampilkan satu tabel per bulan secara berurutan. Kolom hari 1–31 tetap terlihat; sel untuk tanggal tidak berlaku dibiarkan kosong. Preview tabel dapat digeser mendatar di area tabel. Ukuran halaman browser diatur dengan satu aturan `@page` reaktif terhadap pilihan A4, F4/Folio, atau Letter landscape; setiap laporan bulanan dimulai di halaman baru. Tidak ada tombol atau klaim unduh PDF.

Logo privat/snapshot arsip dan PDF unduhan nyata tetap di luar tahap ini sesuai REP-001C. Tidak ada logo tiruan.

## Perubahan

- `app/pages/reports.vue` — halaman laporan, filter, state, tabel preview dan CSS cetak.
- `app/layouts/default.vue` — navigasi Laporan; handler keluar tidak berubah.
- `app/assets/css/main.css` — nav menjadi grid tiga kolom pada viewport ≤380 px agar semua label muat.
- `app/pages/index.vue` — tautan laporan dan copy beranda sesuai fitur yang tersedia.
- `app/types/attendance-report.ts` — tipe respons murni untuk client.
- `app/scripts/fixture-reports.mjs` dan `app/package.json` — fixture PostgreSQL/Nuxt lokal sintetis, perintah `fixture:reports`, dan cleanup stdin agar STOP mengakhiri runner.
- Tidak mengubah endpoint/model/auth/schema, dependency, data `.data`, cloud, atau konfigurasi deployment.

## Acceptance dan verifikasi

- Fixture dijalankan hanya pada loopback dalam direktori sementara `.cache/reports-fixture-*`, dengan PostgreSQL terisolasi dan satu akun sintetis. Isinya mencakup 48 siswa, nama panjang, NIPD/JK kosong, semester aktif parsial, semester arsip, dan arsip kosong. Perintah start: `npm run fixture:reports`; untuk stop ketik `STOP` pada terminal fixture. Tidak ada kredensial fixture yang disimpan dalam laporan ini. Ketika STOP pertama kali diterima, root dan listener sudah dibersihkan tetapi runner tertahan oleh listener stdin. Script diperbaiki dengan handler stdin bernama yang dilepas serta `process.stdin.pause()` pada cleanup. Rehearsal interaktif fresh membuktikan STOP membuat runner exit 0, root sementara hilang, dan tidak ada proses/listener pada port 54036.
- Typecheck akhir setelah perbaikan nav dan SSR guard: PASS, exit 0, bundled Node 24.19.0, perintah `node node_modules/nuxt/bin/nuxt.mjs typecheck --checker vue-tsc`.
- Build akhir setelah perbaikan nav dan SSR guard: PASS, exit 0, bundled Node 24.19.0, perintah `node node_modules/nuxt/bin/nuxt.mjs build`. Build menampilkan peringatan deprecation `DEP0155` dari resolver dependency `@vue/shared`, tanpa kegagalan. Kedua perintah dijalankan setelah perubahan app terakhir; typecheck/build tidak diulang setelah patch mandiri script fixture, yang diuji melalui rehearsal lifecycle tersendiri.
- `git diff --check`: PASS, exit 0; Git hanya memberi peringatan konversi LF/CRLF pada file tracked yang berubah.
- Browser self-check pada fixture: login sintetis, beranda/navigasi ke `/reports`, dan preview Juli 2026 memuat 48 baris. Pada viewport 1440×1000, controls card berukuran 1160 px; tombol aksi berada di dalam card. Memilih Letter memperbarui aturan head ke `@page { size: letter landscape; margin: 6mm; }` dan tidak menonaktifkan cetak. Pada 320×844, nav grid tiga kolom dan dua baris; enam tautan muat, tidak tumpang tindih, dan lebar dokumen tetap 320 px.
- Menurut update PM setelah perbaikan print: laporan bulanan 48 siswa pada A4, F4, dan Letter masing-masing menghasilkan tepat dua halaman landscape tanpa halaman kosong tambahan; ukuran PDF yang dilaporkan A4 841.92×594.96 pt, F4 935.04×612 pt, Letter 792×612 pt. Tabel dan header kelanjutan diperiksa secara visual PM.
- Menurut update PM: laporan semester enam bulan pada Letter menghasilkan 12 halaman untuk 48 siswa per bulan; sel dan total S/I/A seluruh bulan dicocokkan dengan API. PM memakai spy pada `window.print` yang mencatat satu pemanggilan; dialog browser/printer aktual tidak disaksikan. Retry setelah 503, invalidasi filter dan pengabaian respons terlambat lulus.
- Menurut PM, laporan arsip tanpa siswa menampilkan pesan kosong, nol tabel, dan tombol cetak nonaktif. Viewport 390 px lolos visual. Pada 320 px, PM menemukan label nav bertumpuk setelah tautan Laporan ditambahkan; Executor memperbaiki breakpoint ≤380 px dan PM mengonfirmasi screenshot final grid tiga kolom dan dua baris, tanpa overlap atau pelebaran dokumen. PM memblokir script Nuxt pada SSR fresh: tombol Tampilkan/Cetak nonaktif; setelah JavaScript diizinkan, laporan 48 baris dimuat dan URL tetap `/reports` tanpa native GET. Mock CSR `school: null` mengarahkan ke Atur data Sekolah, dan daftar semester kosong menampilkan tindakan Kelola Semester. Tidak ada cetak fisik atau dialog printer aktual yang diklaim. Suite API tidak diulang Executor karena perubahan task ini tidak menyentuh runtime/model/API; REP-001A memiliki hasil regresi terpisah.

## Batas dan handoff

Tidak ada blocker implementasi yang diketahui. Pemeriksaan browser akhir PM untuk empty-state, HP, SSR hydration, serta jalur tanpa sekolah/semester sudah dilaporkan lulus; laporan ini menunggu review formal PM. Cetak fisik tetap memerlukan bukti Ardy/guru; browser Save as PDF hanya menjadi bukti render dan bukan endpoint Unduh PDF. Tidak ada commit, push, atau deployment. Next owner: PM untuk menyelesaikan pemeriksaan dan review diff; REP-001 tetap terbuka.
