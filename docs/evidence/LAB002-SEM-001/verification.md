# SEM-001 — bukti verifikasi Executor

Tanggal: 12 Oktober 2026
Executor: Codex subagent `gpt-6-luna/max`
Lingkungan: Windows PowerShell, Node.js bundled `24.19.0`, npm `10.9.3`
Root aplikasi: `Labs/LAB-002-website-absensi-siswa/app`

## Hasil

| Pemeriksaan | Hasil aktual |
|---|---|
| `npm test` | Lulus, exit 0. DATA 11/11, AUTH 12/12, STUD/SEM HTTP 8/8; seluruhnya memakai PostgreSQL 16 disposable dan data sintetis. Skrip tes membersihkan server/cluster sementara setelah suite. |
| `npm run test:students` | Lulus setelah penataan ulang lock; STUD/SEM HTTP 8/8. Tes baru mengatur race HTTP deterministik antara close dan edit membership. |
| `npm run typecheck` | Lulus, exit 0 (`nuxt typecheck --checker vue-tsc`). |
| `npm run build` | Lulus, exit 0 dengan preset Vercel, memakai snapshot source setelah perbaikan lock-order di isolated root `build-validation`. `.output` aktif pada port 3101 tidak disentuh. Tidak ada deployment. |
| `npm run build:node` | Lulus, exit 0 dengan preset Node server pada isolated root yang sama. `.output` aktif pada port 3101 tidak disentuh. |
| `git diff --check` atas file Executor | Lulus tanpa temuan whitespace pada file Executor yang diperiksa. Peringatan line-ending CRLF dari Git adalah konfigurasi working tree, bukan kegagalan pemeriksaan. |

## Regresi lock close-versus-STUD

Tes HTTP mengunci kalender pada advisory key 1727, memulai close sehingga ia memegang key 1728 dan menunggu key kalender, lalu mengirim edit membership pada semester yang sama. Sebelum perbaikan, close berhasil tetapi request edit berakhir `503` setelah deadlock database. STUD PATCH kini mengambil key 1728 sebelum mengunci baris membership/semester/siswa. Setelah perbaikan, close selesai dan edit yang antre mengembalikan `409`; tanggal membership tetap tidak berubah. Suite STUD/SEM dan seluruh `npm test` lulus setelah perubahan itu.

## Batas pemeriksaan

- Data uji hanya sintetis pada cluster PostgreSQL 16 sementara; tidak ada query ke database persisten proyek atau data sekolah nyata.
- PM masih perlu menjalankan pemeriksaan browser desktop/responsif untuk SEM. Laporan ini tidak menyatakan hasil browser, perangkat HP fisik, atau acceptance PM/Ardy.
- Regresi seluruh endpoint write ATT/CAL/IMP tetap menjadi pekerjaan QA saat modul tersebut tersedia. Uji SEM saat ini membuktikan serialisasi terhadap mutasi attendance, membership/STUD, dan kalender melalui fixture/database serta guard yang tersedia; ini bukan klaim bahwa API masa depan sudah diuji.
- Tidak ada perubahan migration `0001` atau `0002`; pemeriksaan rangkaian migration mencakup up/down/up dengan ledger migration yang dibaca dari nama file.
- Build lokal bukan hasil deployment. Tidak ada commit, push, cloud, atau tindakan production.
- Build final dijalankan dari isolated copy `app/.data/pm-semester-browser-6cade822-f557-4e41-be2d-5e7b597e369b/build-validation`, dengan `node_modules` junction ke dependency app; proses ini menjaga output server PM pada port 3101 tetap tersedia.
- PM melaporkan browser review laptop/mobile: pratinjau semester menunjukkan 29 hari sekolah, 87 sel, 83 kosong; penutupan incomplete dengan konfirmasi menjadi arsip; input tahun tidak valid tetap dipertahankan; semester Genap 2026/2027 bertanggal 11 Oktober–31 Maret berhasil dibuat dengan salin roster dua siswa; perubahan tanggal mulai ke 12 Oktober ditolak dan nilai 11 Oktober tetap setelah muat ulang. PM juga menemukan copy beranda lama yang menyatakan semester belum tersedia. Revisi menautkan beranda ke Semester dan menyatakan hanya pengisian absensi yang belum tersedia; PM menyatakan source review cukup untuk koreksi copy/link ini. Pemeriksaan fisik HP dan penggunaan data nyata belum dilakukan.

## Catatan working tree

Pemeriksaan penuh working tree juga menemukan dua baris kosong berlebih di akhir dokumen task milik PM (`docs/studio/project/tasks.md` dan `docs/studio/project/tasks/LAB002-SEM-001.md`). Executor membiarkannya tanpa perubahan.
