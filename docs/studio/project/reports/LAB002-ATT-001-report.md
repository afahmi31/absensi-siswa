# Laporan Executor — LAB002-ATT-001

Tanggal: 13 Oktober 2026
Executor: Codex subagent `gpt-6-luna/max`
Status laporan: `IMPLEMENTED`; browser review PM terbatas oleh dialog native, interaksi utama setelahnya belum tervalidasi. Ini bukan penerimaan PM atau persetujuan Ardy.
Next owner: Ardy untuk uji interaksi lokal yang tertunda setelah handoff PM; PM mencatat hasil dan status formal.
Production actions performed: NONE. Deployment: NOT_DEPLOYED.

## Hasil

Halaman absensi harian mengambil semester, tanggal sekolah, daftar anggota yang memenuhi syarat, status efektif, jumlah kosong, dan revisi hari dari API terlindungi. Membuka hari tidak membuat catatan absensi. “Tandai semua hadir” hanya mengubah draft; simpan manual dapat parsial.

Server memvalidasi semua baris sebelum menulis satu batch atomik. Token revisi buram berbasis HMAC mengikat snapshot hari dengan sekolah, semester, tanggal, zona waktu, membership/roster, aturan kalender, status dan riwayat absensi. Request basi menerima 409 agar perubahan perangkat lain tidak tertimpa. Mengosongkan status secara eksplisit membuat tombstone `manual_clear` non-efektif dengan versi dan audit baru; histori lama tidak dihapus. Riwayat absensi pada tanggal libur tetap tersimpan tetapi tidak dihitung sebagai status efektif.

Semua write absensi mengambil lock berurutan `1728 → 1727 → 1729 → row locks`, lalu memeriksa ulang semester, tanggal sekolah, membership dan kalender di dalam transaksi. Regresi HTTP close-vs-write mencakup ATT PUT serta STUD POST; ketika close menang, kedua request antre ditolak dan POST tidak meninggalkan student/membership yatim. Penambahan STUD POST ini terbatas untuk menjaga urutan lock yang sama dengan penutupan semester.

Draft tetap dipertahankan ketika request gagal. Konflik 409 menawarkan pemuatan ulang hanya setelah konfirmasi; route guard menahan perpindahan saat simpan tertunda dan peringatan dirty tetap aktif untuk tab. Request histori memakai penjagaan scope/urutan agar hasil lama tidak masuk ke tanggal baru. Error pemuatan semester dibedakan dari daftar yang benar-benar kosong.

## Acceptance criteria

| AC | Hasil Executor | Bukti dan batas |
|---|---|---|
| AC-01 — Tanggal dan status awal | Halaman membatasi hari pada semester aktif dan tanggal sekolah yang bukan masa depan menurut zona waktu sekolah; siswa belum mulai atau sudah keluar tidak masuk roster hari itu. Hari libur/semester tertutup hanya-baca dengan alasan. GET tidak menulis. | `tests/attendance.test.ts` menguji GET tanpa row/audit, hari masa depan, anggota tidak memenuhi syarat, kalender, status kosong, dan alasan read-only. Browser PM mengonfirmasi tiga siswa eligible kosong serta Dimas yang mulai esok hari tidak tampil. Pengujian browser tanggal/closed lainnya dicakup tes API/DB, bukan interaksi browser yang teramati. |
| AC-02 — Simpan atomik dan konflik versi | All-present hanya mengisi draft; simpan parsial divalidasi penuh dan atomik. Revisi HMAC server-side berubah mengikuti roster, kalender, timezone, state/riwayat; stale write ditolak 409. Clear eksplisit menjadi tombstone non-efektif dengan audit dan versi baru. | Tes fokus 7/7 mencakup simpan parsial, koreksi, stale state, batch atomik, clear dan re-entry. Browser mengonfirmasi mark-all hanya membuat draft dan tab kedua tetap kosong tanpa autosave; save parsial/correction/409/clear belum dapat diperiksa setelah native confirm mengunci otomasi. Migrasi baru `0004`; migration `0001`–`0003` tidak diubah. |
| AC-03 — Kegagalan dan draft | Gagal/konflik tidak menghapus draft atau menampilkan sukses palsu. Reload konflik perlu konfirmasi. Ada peringatan tab untuk perubahan belum disimpan dan perpindahan internal dibatasi selama write tertunda. | Tes memeriksa 409/error dan penyimpanan state. Browser membuktikan dialog `window.confirm` muncul saat berpindah dengan draft; otomasi CUA tidak dapat dismiss dialog native, sehingga perilaku setelah pilihan pengguna dan navigasi saat simpan masih perlu uji Ardy. |
| AC-04 — Koreksi, riwayat dan semester tertutup | Koreksi dan clear memiliki audit actor/nilai lama-baru; histori terlindungi menunjukkan data beserta keterangan record yang dikecualikan. Close semester bersamaan menserialkan write ATT/STUD dan menyebabkan write antre menerima 409. | Tes HTTP/DB menilai audit, history, closed semester dan race lock. Kalender libur mempertahankan baris historis tetapi tidak menghitungnya sebagai efektif. Koreksi, clear dan history belum diperiksa dalam browser review terbatas ini. |
| AC-05 — Tes, typecheck, build dan laporan | Tes fokus, suite penuh, typecheck, Node build dan tes independen PM lulus. Review browser PM membuktikan roster awal, mark-all draft, no-autosave, dan hadirnya dialog dirty-navigation; interaksi berikutnya belum tervalidasi. | Rincian perintah, hasil, observasi dan batas ada pada [bukti verifikasi Executor](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-ATT-001/executor-verification.md>) serta log PM [pm-test-attendance.txt](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app/docs/evidence/LAB002-ATT-001/pm-test-attendance.txt>). |

## Perubahan

- UI: `app/app/pages/attendance.vue`, layout/nav `app/app/layouts/default.vue`, home `app/app/pages/index.vue`, serta `app/assets/css/main.css`.
- API: `app/server/api/attendance/[semesterId]/[date].get.ts`, `app/server/api/attendance/[semesterId]/[date].put.ts`, `app/server/api/attendance/history.get.ts`; request/error helpers `app/server/utils/attendance-api.ts`.
- Repository dan schema: `app/server/database/repositories/attendance-days.ts`, migration `app/server/database/migrations/0004_attendance_manual_clear.up.sql` dan `.down.sql`.
- Integrasi lock roster: `app/server/api/students/index.post.ts` mengambil semaphore 1728 sebelum lock semester/membership dan memeriksa ulang status setelah lock. Perubahan ini menutup inversi lock close-vs-add yang ditemukan dalam review ATT; tidak mengubah alur STUD lain.
- Tes: `app/tests/attendance.test.ts`, `app/scripts/test-attendance.mjs`, `app/scripts/test-all.mjs`, script npm pada `app/package.json`.
- Dokumentasi/evidence: `app/README.md`, `app/docs/evidence/LAB002-ATT-001/executor-verification.md` dan fixture privat di `.data` untuk browser PM.
- Tidak ada perubahan checksum migration `0001`–`0003` atau dependency global.

## Pemeriksaan Executor

Dengan Node bundled `24.19.0` dan npm `10.9.3`, `npm run test:attendance` lulus 7/7; `npm test` lulus 43/43 (DATA/schema 11, AUTH 12, STUD/SEM 8, CAL 5, ATT 7); `npm run typecheck` exit 0; dan `npm run build:node` exit 0. Tes independen PM pada ATT lulus 7/7. Log PM tersedia di bukti.

Build Node selesai sebelum PM menyalakan runtime lokal bersama dari output tersebut. Fixture browser ATT terpisah pada port 3101 dan menggunakan PostgreSQL disposable port 51840. Metadata privat ada pada `app/.data/pm-att-browser-a2372697-c885-406c-8e60-5cd4a088d609/fixture.json`. Review PM terhenti setelah native `window.confirm` muncul; otomasi tidak dapat dismiss dialog, jadi interaksi save/correction/409/history dan viewport lengkap belum boleh dinyatakan lulus. Setelah PM meminta cleanup, Executor menghentikan hanya proses fixture Nuxt PID 11428 dan PostgreSQL PID 18332; keduanya berhenti dan port 3101/51840 bebas. Tab fixture asal tidak dapat ditutup lewat CUA, tetapi direktori privatnya dipertahankan. Runtime bersama PID 17520/port 3000 dan managed PostgreSQL PID 19592/port 55432 tetap berjalan. Runtime tersebut dapat dipakai Ardy untuk melanjutkan uji interaksi lokal.

## Batas dan handoff

- Review browser PM terbatas oleh dialog native CUA dan belum memvalidasi interaksi save/correction/409/history atau perjalanan penuh laptop/mobile. Browser viewport bukan pengganti uji perangkat fisik. Penerimaan PM dan persetujuan Ardy tetap langkah terpisah.
- Tidak menggunakan data siswa asli, cloud, Supabase, remote Git, commit, push, deployment, atau dependency global.
- Full regression HTTP untuk write API CAL/ATT/IMP setelah integrasi modul impor tidak diklaim oleh task ini.
- Executor tidak menerima atau menutup task. Berikutnya PM menuntaskan review browser dan mencatat status formal; jangan mulai task roadmap lain sampai ada assignment tersendiri.
