# Laporan Executor — LAB002-CAL-001

Tanggal: 13 Oktober 2026
Executor: Codex subagent `gpt-6-luna/max`
Status laporan: `IMPLEMENTED`; PM melaporkan penerimaan technical AC CAL. Catatan ini bukan penutupan task oleh Executor atau persetujuan Ardy.
Next owner: Project Manager untuk pencatatan acceptance/status formal; jangan memulai ATT sebelum assignment tersendiri.
Production actions performed: NONE. Deployment: NOT_DEPLOYED.

## Hasil

Kalender sekolah menyediakan halaman untuk semester aktif. Guru dapat membaca aturan rutin serta status tanggal, mengatur satu sampai tujuh hari sekolah atau memilih libur penuh, dan memberi pengecualian hari libur/hari sekolah khusus dengan catatan opsional. GET menggunakan tanggal zona waktu sekolah; jika hari ini di luar periode semester, tampilan awal memakai bulan terdekat di dalam periode. Tanggal di luar rentang semester tidak dapat dipilih di kalender UI.

Penulisan memakai sesi guru, pemeriksaan origin, actor audit dari sesi, dan cakupan sekolah pemilik. Aturan rutin menyimpan tujuh nilai PostgreSQL DOW secara atomik. Menandai libur pada tanggal dengan absensi meminta konfirmasi dampak terbaru; perubahan state sebelum konfirmasi menghasilkan 409 dan preview baru. Riwayat tidak dihapus. Restore sebagai hari sekolah tidak mengaktifkan absensi lama. Semua write kalender ditolak pada semester tertutup, termasuk perubahan catatan saja.

Transaksi write mengambil semaphore perubahan semester 1728 sebelum lock kalender 1727 dan lock tanggal/row yang diperlukan. Uji HTTP menserialkan CAL write di belakang penutupan semester; setelah penutupan berhasil, write kalender yang antre menerima 409.

Revisi review mencegah tanggal/bulan pilihan berubah selama pemuatan atau simpan rutin/pengecualian berjalan. Request pengecualian menggunakan tanggal, jenis dan catatan yang ditangkap saat pengiriman. Empty state tidak lagi menyiratkan adanya tampilan arsip kalender yang belum tersedia.

## Acceptance criteria

| AC | Hasil Executor | Bukti dan batas |
|---|---|---|
| AC-01 — Aturan rutin dan akses | Implementasi HTTP tersedia untuk auth, origin, owner, tanggal valid, semester aktif, kalender tanpa default Senin–Jumat, tujuh pilihan DOW dan libur penuh. | `tests/calendar.test.ts` menguji ownership, no-default dan DOW PostgreSQL. PM melaporkan home/nav berfungsi pada browser laptop dan viewport HP. |
| AC-02 — Perubahan aturan rutin | Ketujuh hari disimpan atomik pada tanggal efektif; tanggal berabsensi dan semester tertutup dilindungi guard transaksi/trigger. | Tes HTTP/database memeriksa tujuh row/audit actor, all-off, attendance guard, dan urutan lock 1728→1727. Migration `0001`–`0003` tidak diubah. |
| AC-03 — Pengecualian tanggal | Preview menampilkan dampak terbaru; server menghitung ulang sebelum write. Riwayat tetap ada namun non-efektif saat libur; restore tidak memulihkannya otomatis. | Tes HTTP/database memeriksa token preview basi, hitungan, history dan restore. PM melaporkan browser: 12 Okt history 1/effective 1 → setelah konfirmasi 1/0 → restore tetap 0. |
| AC-04 — Semester tertutup dan riwayat | Baca tidak menulis audit. Rutin dan pengecualian menolak write semester tertutup termasuk note-only. Form/error copy menjaga input; tidak ada integrasi eksternal. | Tes note-only menghasilkan 409 dan tidak menghapus exception/history. PM melaporkan input tanggal rutin invalid dipertahankan; all-off valid tersimpan setelah reload. Empty-state copy diperbaiki. |
| AC-05 — Tes, typecheck, build dan laporan | Suite, typecheck, build Vercel, build Node serta pemeriksaan PM laptop/responsif lulus. | Perintah, exit/count, runtime target dan batas dicatat pada [bukti verifikasi Executor](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-CAL-001/executor-verification.md>). |

## Perubahan

- UI: `app/app/pages/calendar.vue`, navigasi pada `app/app/layouts/default.vue`, serta tautan/copy bantuan pada `app/app/pages/index.vue`.
- API: `app/server/api/calendar/index.get.ts`, `routine.put.ts`, dan `exceptions/[date].put.ts`; validasi/error pada `app/server/utils/calendar-api.ts`.
- Repository: `app/server/database/repositories/calendar.ts`.
- Tes: `app/tests/calendar.test.ts`, runner `app/scripts/test-calendar.mjs`, suite `app/scripts/test-all.mjs`, script npm `app/package.json`.
- Dokumentasi runtime: `app/README.md`; bukti pada `app/docs/evidence/LAB002-CAL-001/executor-verification.md`.
- Tidak ada migration atau dependency baru. Guard `0001`, `0002`, dan `0003` tidak diubah.

## Pemeriksaan Executor

Pemeriksaan memakai Node bundled `24.19.0` dan npm `10.9.3`. `npm run typecheck` lulus (exit 0). `npm test` lulus (exit 0): DATA 11/11, AUTH 12/12, STUD/SEM 8/8, CAL 5/5. `npm run test:calendar` lulus 5/5 setelah regresi bulan awal ditambahkan. Build Vercel dan Node selesai exit 0 dari isolated root, di luar output aplikasi utama; `.vc-config.json` menyatakan `nodejs24.x`. Build mencetak satu peringatan non-fatal `DEP0155` dari `@vue/shared`.

PM melaporkan browser laptop 1280×900 dan viewport HP 390×844 lulus untuk pengecualian berabsensi, konfirmasi libur, restore, routine all-off/validasi, serta home/nav. Fixture PostgreSQL dan Nuxt terisolasi sudah dihentikan setelah tab browser ditutup; port 3101/54223 bebas, sedangkan managed PG 55432 tetap hidup. Metadata dan bukti rinci ada di file verifikasi.

## Batas dan handoff

- PM melaporkan technical AC CAL diterima. Perangkat HP fisik belum diuji; browser viewport adalah simulasi layar.
- Tidak ada uji printer, kalender eksternal, produksi/cloud, deployment, atau data sekolah nyata.
- Suite menguji API/guard CAL saat ini. Full regression HTTP write API ATT/IMP mendatang tidak diklaim.
- Tidak ada commit, push, remote, deployment, pemasangan dependency global, atau perubahan pada database managed.

Langkah berikutnya: Project Manager mencatat status acceptance secara formal. Executor tidak menutup task dan tidak memulai task berikutnya.
