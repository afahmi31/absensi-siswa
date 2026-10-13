# Bukti verifikasi Executor — LAB002-CAL-001

Tanggal: 13 Oktober 2026
Source: working tree lokal `app/`, baseline `ecee50ecc3de87bcd6a2e3344d0d3ef4d6e21bad`; tidak ada commit.
Runtime: bundled Node v24.19.0 dan npm 10.9.3.

## Pemeriksaan

| Perintah | Hasil |
|---|---|
| `npm run typecheck` | Lulus, exit 0 setelah revisi review PM. |
| `npm run test:calendar` | Lulus, exit 0: 5/5. Menjalankan PostgreSQL 16 disposable dan Nuxt root terisolasi; tidak memakai database runtime 55432. |
| `npm test` | Lulus, exit 0: DATA 11/11, AUTH 12/12, STUD/SEM 8/8, CAL 5/5. Semua suite memakai fixture sintetis; tes CAL memakai PostgreSQL dan Nuxt sementara. |
| `npm run build` | Lulus, exit 0, preset Vercel. Build dijalankan pada salinan source terisolasi `app/.data/pm-cal-validation-8d278a88-112c-4d27-a8e6-ed5eaa28529b/build-root`; `.vc-config.json` yang dihasilkan memuat runtime `nodejs24.x`. |
| `npm run build:node` | Lulus, exit 0, preset Node server pada salinan terisolasi yang sama; `build-root/.output/server/index.mjs` tersedia. |

Build mencetak peringatan non-fatal `DEP0155` dari `@vue/shared` terkait pemetaan export dengan akhiran `/`. Tidak ada deployment. Build tidak memakai `.output`, `.vercel`, atau `.nuxt` pada root aplikasi utama.

## Bukti HTTP/database CAL

`tests/calendar.test.ts` memeriksa akses anonim dan lintas origin, owner scope, tanggal invalid, kalender rutin yang belum diatur, simpan tujuh hari sekaligus dengan DOW PostgreSQL, pembacaan tanpa audit write, konfirmasi yang menghitung ulang dampak setelah perubahan state, riwayat absensi yang tetap ada namun tidak efektif saat libur, restore ke hari sekolah tanpa mengaktifkan absensi lama, penolakan write semester tertutup termasuk perubahan catatan, dan race tutup-semester versus tulis kalender.

Kasus regresi bulan awal menempatkan tanggal lokal sekolah sesudah akhir semester aktif sintetis. GET tanpa parameter bulan memilih bulan akhir semester; tanggal yang dikembalikan tetap di dalam periode semester.

Log uji kalender independen PM, terpisah dari pemeriksaan Executor, ada di `pm-test-calendar.txt`.

## Bukti browser dan fixture sintetis

PM melaporkan pemeriksaan pada laptop 1280×900 dan viewport HP 390×844 lulus. Pada 12 Oktober, catatan hadir 1 memberi preview libur dengan riwayat 1/efektif 1; setelah konfirmasi, riwayat tetap 1 dan efektif 0. Restore ke hari sekolah mempertahankan efektif 0. Routine dengan tanggal 28 September yang invalid mempertahankan tanggal/hari dan menampilkan error; all-off mulai 13 Oktober tersimpan dan setelah reload tampil sebagai Libur rutin untuk seluruh tujuh hari. PM juga memeriksa home/nav. Hasil ini berasal dari laporan PM setelah tab ditutup; pencatatan review independen tetap milik PM.

Fixture ada di `.data/pm-cal-browser-743bd626-9726-4879-a7fc-e17827650986/fixture.json`. Ia memakai Nuxt root terisolasi di port 3101/PID 19552 dan PostgreSQL 16 loopback port 54223/PID 21572. Periode aktif 2026-09-29–2026-12-12 mencakup tanggal lokal sekolah 2026-10-13; aturan Senin–Jumat; satu siswa fiktif dan satu catatan hadir pada 2026-10-12. Akunnya `browser-review@example.invalid`; password sintetis yang diberikan PM tidak disalin ke dokumen.

Setelah PM menutup tab, PID Nuxt/PostgreSQL fixture tidak ada dan port 3101/54223 tidak memiliki listener. Managed PostgreSQL 55432 tetap berjalan di PID 19592 dan tidak disentuh. Folder dan database privat fixture dipertahankan. Launcher berakhir dengan exit 1 saat interupsi; pemeriksaan PID/socket setelahnya membuktikan kedua server fixture berhenti.

## Batas

Tidak ada uji perangkat HP fisik, printer fisik, kalender eksternal, produksi/cloud, deployment, atau data sekolah nyata. Tes seluruh HTTP write API ATT/IMP mendatang belum termasuk suite CAL.
