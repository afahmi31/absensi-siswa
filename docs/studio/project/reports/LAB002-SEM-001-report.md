# Laporan Executor — LAB002-SEM-001

Tanggal: 12 Oktober 2026
Executor: Codex subagent `gpt-6-luna/max`
Status laporan: `IMPLEMENTED`; hasil diserahkan kepada Project Manager untuk `PM_VALIDATION`. Ini bukan acceptance PM atau persetujuan Ardy.
Next owner: Project Manager untuk review independen, browser validation, dan keputusan status/revisi sesuai workflow.
Production actions performed: NONE. Deployment: NOT_DEPLOYED.

## Hasil

Halaman Semester membuat dan mengubah semester aktif dalam satu sekolah/kelas guru, menampilkan semester aktif dan arsip, serta menawarkan roster kosong atau salinan dari semester sebelumnya. Salinan memilih siswa yang masih terdaftar pada tanggal akhir semester lama secara inklusif, membuat membership dan snapshot baru, dan tidak membawa absensi.

Penutupan tidak berjalan otomatis saat tanggal akhir tercapai. Guru meminta pratinjau kelengkapan lalu mengonfirmasi penutupan secara eksplisit, termasuk saat seluruh sel sudah terisi. Pratinjau membedakan kalender belum dikonfigurasi dari konfigurasi tujuh hari libur, menunjukkan hari sekolah dan sel absensi kosong, serta meminta peninjauan ulang dengan respons 409 jika keadaan berubah setelah pratinjau.

Perubahan tanggal periode ditolak apabila mengeluarkan membership atau riwayat absensi dari rentang baru; tanggal membership tidak digeser otomatis. Penutupan mengambil snapshot identitas sekolah, kelas, dan periode pada transaksi yang sama. Setelah tertutup, periode tidak dapat diedit/dibuka kembali melalui SEM dan guard STUD/DATA yang tersedia menolak write terkait. Semua operasi API memakai sesi pemilik, pemeriksaan same-origin, actor audit dari sesi, dan respons kesalahan aman.

Pemeriksaan PM menemukan urutan lock yang dapat deadlock ketika edit membership dan close berjalan bersamaan: endpoint STUD mengunci baris sebelum semaphore penutupan. Race HTTP deterministik mereproduksi kegagalan itu. Endpoint STUD kini mengambil semaphore sekolah sebelum mengunci baris. Tes ulang membuktikan close selesai, edit yang antre mendapat 409, dan tanggal membership tidak berubah.

## Acceptance criteria

| AC | Hasil Executor | Bukti dan batas |
|---|---|---|
| AC01 — Tahun, periode, overlap, satu semester aktif, edit aman | Implementasi tersedia dan teruji. Tahun harus berbentuk `YYYY/YYYY` dengan tahun kedua berurutan; label term, urutan tanggal, overlap dan dua semester aktif divalidasi. Perubahan periode yang mengecualikan membership atau semua riwayat absensi, termasuk riwayat yang tidak ditampilkan sebagai aktif, ditolak tanpa auto-shift. | Tes HTTP STUD/SEM dan constraint migration; tes periode membership dan riwayat attendance ada pada `tests/students.test.ts`. Future attendance tetap mengikuti guard DATA. |
| AC02 — Pratinjau, konfirmasi dan penutupan | Implementasi tersedia dan teruji. Hitungan memakai hari sekolah serta masa membership; sel kosong tidak dianggap `A`. Kalender unset berbeda dari semua hari eksplisit non-sekolah. Konfirmasi wajib, token basi menghasilkan 409 dan pratinjau terbaru; setelah close, SEM/STUD yang tersedia tidak dapat membuka atau mengubah periode. | `tests/database.test.ts` mencakup hitungan, unset versus tujuh hari off, konfirmasi dan race dengan attendance, membership, serta perubahan kalender. `tests/students.test.ts` menguji pratinjau basi, close, edit arsip ditolak, dan race HTTP deterministic close-versus-membership PATCH. Jalur write CAL/ATT/IMP masa depan tetap menunggu QA. |
| AC03 — Roster dan identitas arsip | Implementasi tersedia dan teruji. Pilihan roster kosong tetap kosong; pilihan sebelumnya menyalin hanya siswa yang masih terdaftar pada tanggal akhir secara inklusif, membuat membership baru tanpa absensi. Nama sekolah/kelas/periode arsip tetap sama setelah metadata aktif berubah. | Tes database dan HTTP memeriksa jumlah membership/attendance, siswa yang keluar sehari sebelum batas, nilai snapshot, audit actor, dan nama arsip setelah sekolah/kelas diganti. |
| AC04 — UI desktop/responsif dan state | Halaman Semester, navigasi, copy bantuan, state formulir/validasi, daftar kartu, ringkasan sebelum close, dan konfirmasi mobile dibuat mengikuti acuan UI002. Setelah temuan browser PM, bantuan beranda kini mencantumkan Semester sebagai fitur tersedia, absensi sebagai fitur yang belum tersedia, dan tautan ke pengelolaan Semester. | PM melaporkan browser review laptop/mobile: preview 29 hari sekolah, 87 sel, 83 kosong; close incomplete dengan konfirmasi menghasilkan arsip; input tahun tidak valid dipertahankan; semester Genap 2026/2027 11 Oktober–31 Maret berhasil dibuat dengan salin roster dua siswa; perubahan awal ke 12 Oktober ditolak dan setelah muat ulang tetap 11 Oktober. PM menyatakan source review cukup untuk copy/link minor ini. Pemeriksaan HP fisik dan penggunaan data nyata belum dilakukan. |
| AC05 — Tes, typecheck, build dan batas | Suite DATA/AUTH/STUD-SEM, typecheck, build Vercel, dan build Node lulus pada source dengan perbaikan lock-order. Build memakai isolated root agar output `.output` fixture PM di port 3101 tetap tersedia. | Rincian perintah/hasil dan batas tercatat pada [bukti verifikasi](../app/docs/evidence/LAB002-SEM-001/verification.md). |

## Perubahan

- UI: `app/app/pages/semesters.vue`, `app/app/pages/index.vue`, `app/app/layouts/default.vue`, `app/app/assets/css/main.css`.
- API semester: `app/server/api/semesters/index.get.ts`, `index.post.ts`, `[semesterId].patch.ts`, `[semesterId]/closure-preview.get.ts`, dan `[semesterId]/close.post.ts`. Endpoint STUD membership patch mengambil semaphore sekolah sebelum row lock agar urutannya sama dengan close.
- Validasi dan repository: `app/server/utils/semester-api.ts` serta `app/server/database/repositories/semesters.ts`.
- Schema: migration baru `app/server/database/migrations/0003_semester_archive_snapshots.up.sql` dan `.down.sql`. Migration `0001` dan `0002` tidak diubah.
- Verification: `app/tests/database.test.ts`, `app/tests/auth.test.ts`, `app/tests/students.test.ts`, dan `app/tests/support/migration-names.mjs`.
- Dokumentasi dan bukti: `app/README.md`, `app/docs/evidence/LAB002-SEM-001/verification.md`, serta laporan ini. Tidak ada dependency runtime baru.

## Pemeriksaan Executor

Perintah dijalankan dari `app/` dengan Node bundled `24.19.0` dan npm `10.9.3`; Node sistem tidak diubah.

| Perintah | Hasil |
|---|---|
| `npm test` | Lulus, exit 0: DATA 11/11, AUTH 12/12, STUD/SEM HTTP 8/8. Tes memakai cluster PostgreSQL 16 sementara dan data sintetis. |
| `npm run typecheck` | Lulus, exit 0. |
| `npm run test:students` | Lulus setelah perbaikan urutan lock; race HTTP close/edit menghasilkan close 200 dan edit membership 409. Sebelum fix, tes reproduksi menerima 503 dari deadlock database. |
| `npm run build` | Lulus, exit 0 dengan preset Vercel setelah perbaikan lock-order; dijalankan dari isolated root agar output `.output` pada port 3101 tidak berubah. Tidak ada deployment. |
| `npm run build:node` | Lulus, exit 0 dengan preset Node server setelah perbaikan lock-order, dari isolated root yang sama. |
| `git diff --check` terarah | File Executor bersih dari temuan whitespace. Pemeriksaan penuh turut menemukan dua baris kosong berlebih pada dokumen task milik PM; file PM tidak diubah. |

## Batas dan handoff

- PM telah menyampaikan hasil browser review laptop/mobile dan source review untuk revisi copy/link beranda. Penetapan acceptance dan status task tetap tanggung jawab PM; laporan Executor ini tidak menutup task.
- PM browser review menemukan salinan beranda yang masih menyebut semester akan tersedia nanti. Executor memperbarui copy tersebut dan menambahkan tautan ke halaman Semester; PM menyatakan source review memadai untuk koreksi kecil tersebut.
- Full regression jalur write ATT/CAL/IMP tetap pending sampai endpoint tersebut tersedia. Suite saat ini menguji serialisasi database/guard terhadap attendance, membership, dan kalender, bukan seluruh HTTP write API masa depan.
- Tidak ada deployment, commit, push, remote, database persisten, atau data nyata yang digunakan.
- Dokumen PM di `app/docs/studio/` tidak diedit oleh Executor. Pemeriksaan diff melihat dua baris kosong berlebih di akhir file task milik PM dan membiarkannya tetap utuh.

Langkah berikutnya: Project Manager melakukan validasi independen dan browser review, lalu mencatat hasil atau meminta revisi sebelum acceptance Ardy.
