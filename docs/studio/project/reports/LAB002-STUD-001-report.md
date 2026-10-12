# Laporan Executor — LAB002-STUD-001

Tanggal: 12 Oktober 2026
Executor: Codex subagent `gpt-6-luna/max`
Status laporan: `IMPLEMENTED`; PM melaporkan pemeriksaan independen lulus. Catatan ini bukan task acceptance atau persetujuan Ardy.
Next owner: Project Manager untuk mencatat status/acceptance sesuai workflow.
Production actions performed: NONE. Deployment: NOT_DEPLOYED.

## Hasil

Guru yang masuk dapat mengatur satu sekolah, kelas, dan zona waktu sekolah. Halaman Siswa membaca pilihan semester milik guru, mencari roster berdasarkan nama/NIPD, menambah dan memperbarui keanggotaan, serta menampilkan arsip sebagai baca-saja. Tampilan menyediakan tabel desktop dan kartu layar kecil. Navigasi hanya menunjukkan Data sekolah, Siswa, dan Keluar. Ketika belum ada semester, halaman menjelaskan keadaan itu tanpa tombol pembuatan semester.

API membaca identitas pemilik dari sesi AUTH; request tidak dapat memilih teacher, sekolah, atau actor melalui body. Operasi membaca semester dan keanggotaan dibatasi pada owner. Request ke membership atau semester milik akun lain ditolak. Write memakai pemeriksaan origin AUTH, repository terparameterisasi, transaksi dan konteks audit actor. Validasi tipe/format yang keliru mengembalikan kesalahan aman, bukan menghapus nilai lama atau mengubah zona waktu secara diam-diam.

Identitas yang diperbarui pada roster aktif tersinkron ke snapshot aktif sesuai trigger DATA. Snapshot semester tutup tidak berubah. Arsip hanya dapat dibaca. Tanggal keanggotaan bersifat inklusif; penyempitan yang mengecualikan absensi tercatat serta perubahan pada semester tertutup ditolak server. Perubahan siswa berjalan transaksional, termasuk rollback jika validasi atau write gagal.

Semua data uji STUD menggunakan fixture sintetis pada cluster PostgreSQL 16 terisolasi. Verifikasi tidak mengakses database proyek persisten dan tidak memasukkan data siswa nyata. Fixture browser PM juga berjalan pada server/cluster disposable terpisah. Cluster PostgreSQL managed proyek terkonfirmasi berhenti sebelum dan sesudah cleanup fixture; karena tetap berhenti, Executor tidak menjalankan query hitung data persisten.

## Acceptance criteria

| AC | Hasil Executor | Bukti dan batas |
|---|---|---|
| AC01 — Metadata, satu sekolah/kelas, timezone, dan akses | Implementasi tersedia; HTTP dan pemeriksaan browser independen PM lulus untuk timezone invalid, isian tetap, serta simpan/reload metadata sekolah. | `tests/students.test.ts` dan review PM; request anonim, owner, dan field override juga diuji. |
| AC02 — Siswa, nilai opsional, duplikat, tanggal dan rollback | Implementasi tersedia dan teruji; nama ganda serta nilai opsional kosong diterima, tanggal batas inklusif, input salah/foreign semester ditolak, dan kegagalan transaksi tidak menyimpan sebagian data. | Uji HTTP STUD dan browser PM tambah siswa, pencarian nama/NIPD, dan edit siswa. |
| AC03 — Snapshot aktif/arsip dan guard attendance/semester tutup | Implementasi tersedia dan teruji; perubahan aktif tidak mengganti snapshot arsip, arsip/semester tertutup tidak dapat ditulis, dan tanggal yang mengecualikan absensi tercatat ditolak. | Uji API/repository sintetis dan pemeriksaan PM bahwa arsip hanya baca. |
| AC04 — Actor, ownership, transaksi dan query | Implementasi tersedia dan teruji; actor audit berasal dari sesi, field actor/owner/teacher/school override ditolak, serta foreign semester/membership ID tidak dapat membuka atau mengubah data. | Suite HTTP independen PM lulus; review source PM memeriksa join kepemilikan, actor, dan transaksi. |
| AC05 — UI laptop/HP, cari, form dan state | Halaman sekolah/siswa, pencarian, form berlabel, kartu mobile, arsip baca-saja, dan state penyimpanan/error telah dibuat. | PM melaporkan desktop 1280 dan viewport 390×844 lulus untuk invalid timezone yang mempertahankan input, simpan/reload sekolah, tambah siswa dengan opsi kosong, cari nama/NIPD, edit NIPD 00077/gender, persist setelah reload, arsip baca-saja, dan lock konteks semester. Ini pemeriksaan browser, bukan uji perangkat HP fisik atau data nyata. Rincian ada di review PM. |
| AC06 — Tes, typecheck, build, laporan dan batas | Suite/typecheck PM independen lulus; build Executor sesudah revisi copy lulus dan evidence disimpan. | Detail di tabel pemeriksaan dan `app/docs/evidence/LAB002-STUD-001/executor-build-summary.txt`. |

## Perubahan

- API: `app/server/api/school/index.get.ts`, `app/server/api/school/index.put.ts`, `app/server/api/semesters/index.get.ts`, `app/server/api/students/index.get.ts`, `app/server/api/students/index.post.ts`, `app/server/api/students/[membershipId].patch.ts`, serta validasi `app/server/utils/study-api.ts`.
- Repository: `app/server/database/repositories/schools.ts` dan `app/server/database/repositories/students.ts`.
- UI: `app/app.vue`, `app/app/layouts/default.vue`, `app/app/pages/index.vue`, `app/app/pages/login.vue`, `app/app/pages/school.vue`, `app/app/pages/students.vue`, `app/app/utils/api-errors.ts`, dan `app/app/assets/css/main.css`.
- Verification: `app/tests/students.test.ts`, `app/scripts/test-students.mjs`, `app/scripts/test-all.mjs`, dan script `test:students` pada `app/package.json`.
- Dokumentasi: `app/README.md` dan laporan ini. Tidak ada dependency runtime atau migration yang ditambahkan; migration DATA yang ada tidak diubah.

## Pemeriksaan Executor

Perintah dijalankan dari direktori `app/` memakai Node bundled `24.19.0` dengan npm CLI proyek. Runtime sistem tidak diubah.

| Perintah | Hasil |
|---|---|
| `npm run typecheck` | Lulus, exit 0 setelah layout Nuxt dan metadata halaman login diperbaiki. |
| `npm test` | Lulus, exit 0: DATA 6/6, AUTH 12/12, STUD 7/7. Tiap suite memakai cluster PG16 sementara dan membersihkannya setelah selesai. |
| `npm run build` | Lulus, exit 0 dengan preset Vercel; build selesai. Node mencetak `DEP0155` dari dependency `@vue/shared`, tanpa menggagalkan build. Tidak ada deployment. |

Output terminal ringkas build terbaru disimpan pada `app/docs/evidence/LAB002-STUD-001/executor-build-summary.txt`. PM juga menyimpan output suite dan typecheck independennya pada `app/docs/evidence/LAB002-STUD-001/pm-test-all.txt` dan `pm-typecheck.txt`.

Setelah review browser, satu kalimat bantuan tanggal diperjelas menjadi “Tanggal masuk dan keluar termasuk dalam masa terdaftar.” Perubahan hanya copy; suite/typecheck independen PM berjalan sebelum revisi kalimat, dan build Vercel di atas dijalankan ulang setelah copy berubah. Suite tidak diulang untuk perubahan teks tersebut.

Test STUD memeriksa alur HTTP nyata bersama repository/database terisolasi: guard auth dan origin, batas owner, validasi sekolah/timezone, pencarian dan roster aktif/arsip, duplicate names dan input opsional, tanggal inklusif, penolakan edit foreign ID/closed semester, audit actor, guard absensi lama serta rollback ketika transaksi dipaksa gagal. Database persisten tidak menjadi target suite.

## Batas dan handoff

- PM melaporkan pemeriksaan source, suite/typecheck independen, dan browser desktop/responsive lulus. Laporan ini tetap catatan Executor; status task/acceptance formal belum diubah oleh Executor dan keputusan akhir mengikuti workflow PM/Ardy.
- Semester belum dapat dibuat/ditutup/disalin; ketika daftar semester kosong UI hanya menjelaskan bahwa belum tersedia. Impor Excel, absensi, kalender, PDF, upload logo, cloud dan deployment tidak termasuk hasil task ini.
- Tidak ada commit, push, perubahan remote, atau tindakan production.
- Perubahan dokumen planning/task pada working tree berada dalam kepemilikan PM; Executor tidak mengedit dokumen tersebut.
- PM mencatat tindak lanjut QA/REL: `app/scripts/smoke-http.mjs` masih mengharapkan home anonim lama. Skrip itu bukan bukti runtime untuk flow login/STUD dan tidak diubah dalam STUD.
- Server fixture Nuxt dengan port 3101 dan cluster PostgreSQL 16 fixture dengan port 52551 sudah dihentikan memakai PID/path pada metadata fixture. Managed `.data/postgres` tetap berhenti dan tidak disentuh. Penghapusan dua direktori fixture pada `.data` tidak selesai: tool kebijakan menolak `Remove-Item`, termasuk target literal yang telah diperiksa. Tidak ada metode penghapusan lain yang dicoba; file private-env fixture masih ada di direktori disposable tersebut.

Langkah berikutnya: PM menentukan apakah sisa folder fixture perlu dibersihkan melalui mekanisme yang diizinkan, melengkapi status formal dan melanjutkan workflow lokal.
