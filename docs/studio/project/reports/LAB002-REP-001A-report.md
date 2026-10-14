# LAB002-REP-001A — Laporan Executor

Tanggal: 15 Oktober 2026
Hasil Executor: IMPLEMENTED, menunggu validasi PM. Task induk REP-001 tetap terbuka.

## Hasil

Model laporan read-only tersedia lewat satu query SQL set-based. Semua CTE untuk metadata, bulan, kalender, roster, status efektif, dan total menggunakan snapshot MVCC dari statement yang sama. Query membatasi semester dengan ID dan `teacher_id`; tidak memanggil endpoint harian dan tidak membuat query per siswa atau per tanggal.

Endpoint: `GET /api/reports/:semesterId?mode=month&month=YYYY-MM` atau `GET /api/reports/:semesterId?mode=semester`.

Respons berisi mode, metadata semester, dan daftar bulan kronologis. Setiap bulan mempunyai tepat 31 descriptor hari dan baris roster bulanan; setiap baris berisi `membershipId`, snapshot nama/NIPD/JK, 31 sel `H/S/I/A/null`, dan total `H/S/I/A`. Tanggal yang tidak ada diberi `date: null`; hari di luar semester tetap tersedia sebagai kolom tetapi `inSemester: false`. Roster mengikuti irisan membership dengan bulan dan semester. Semester aktif menggunakan data sekolah/roster saat ini; semester tertutup mendahulukan snapshot arsip. Semester aktif tanpa anggota tetap mengembalikan metadata kelas sekolah dan `rows: []`.

Sel hanya berisi status dari `effective_attendance` pada hari sekolah, dalam semester, dan dalam tanggal keanggotaan. Status yang sudah dikoreksi dihitung sekali; manual clear dan absensi yang dikecualikan oleh libur tidak masuk sel maupun total. Mengembalikan tanggal libur menjadi hari sekolah tidak mengaktifkan kembali record yang sudah dikecualikan.

GET mewajibkan sesi guru, mengembalikan `Cache-Control: no-store`, dan membatasi kepemilikan semester. ID tidak dikenal dan semester milik guru lain memakai status/pesan 404 yang sama. Mode, bulan, tanggal yang bukan bagian kontrak, serta bulan di luar periode diberi 422 dengan pesan pengguna. Kegagalan query mendapat pesan 503 generik.

## Perubahan

- `app/server/database/repositories/reports.ts` — kontrak tipe dan pembacaan set-based laporan.
- `app/server/api/reports/[semesterId].get.ts` — GET laporan terlindungi dan validasi input.
- `app/tests/reports.test.ts`, `app/scripts/test-reports.mjs` — tes integrasi HTTP dengan PostgreSQL sementara sintetis dan runner berpagar target.
- `app/package.json`, `app/scripts/test-all.mjs` — perintah `test:reports` ditambahkan ke suite.
- Tidak ada perubahan dependency, schema/migration, auth/session, pool/driver, UI, PDF, atau logo.

## Acceptance dan verifikasi

- Bulan parsial awal/akhir, 31 kolom, urutan lintas tahun, dan validasi bulan di luar semester: teruji.
- Boundary semester/membership inklusif, roster per bulan, nama sama dengan tie-break ID, NIPD/JK kosong, roster aktif kosong, serta metadata snapshot arsip: teruji.
- Februari 2023 (28 hari), Februari 2024 (29), April (30), dan bulan 31 hari: teruji; sel untuk tanggal yang tidak ada kosong.
- H/S/I/A, sel kosong, koreksi, manual clear, libur, pemulihan hari sekolah, dan total eksplisit dari fixture: teruji.
- Autentikasi, owner/foreign/not-found, mode/bulan/tanggal invalid, no-store, dan kesamaan pesan untuk semester asing/tidak dikenal: teruji.
- Jumlah `attendance_records`, `audit_events`, `semester_archive_snapshots`, `semester_memberships`, `school_calendar_rules`, dan `calendar_exceptions` sebelum/sesudah rangkaian GET sama.
- `npm run test:reports`: PASS 6/6 pada Node 24.19.0, npm 10.9.3; cluster PostgreSQL 16 dan aplikasi HTTP sementara memakai data sintetis. PM juga menjalankan suite REP independen: PASS 6/6.
- `npm run test:calendar`: PASS 5/5; `npm run test:attendance`: PASS 7/7. Keduanya memakai cluster PostgreSQL 16 sementara sintetis.
- `npm run typecheck`: PASS (exit 0) pada Node 24.19.0. Dijalankan sebelum penambahan guard akhir yang menolak parameter query `date`; typecheck tidak dijalankan ulang setelah perubahan kecil tersebut.
- `npm run build` preset Vercel: PASS (exit 0) pada Node 24.19.0. Build mencakup route `/api/reports/:semesterId`, dan dijalankan sebelum guard `date` yang sama; build tidak diulang setelahnya.
- Tidak ada uji visual/browser, cetak, atau PDF pada task ini.

## Batas dan handoff

Tidak ditemukan blocker untuk model/API REP-001A. Output pratinjau/cetak/PDF/logo tetap berada di luar scope dan perlu task berikutnya sebelum REP-001 lengkap. Kontrak ini menyediakan data hari dan sel, tanpa field logo atau keputusan UI untuk roster kosong. Tidak ada perubahan production, cloud, commit, atau push. Next owner: PM untuk validasi source/diff dan menentukan task UI/output berikutnya.
