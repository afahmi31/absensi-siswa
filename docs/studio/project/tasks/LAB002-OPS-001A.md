# LAB002-OPS-001A — Logo sekolah privat dan identitas arsip

Status final16Oktober2026: CLOSED, diterima PM dalam delegasi lokal Ardy setelah [laporan Executor](../reports/LAB002-OPS-001A-report.md) dan [review PM](../reports/LAB002-OPS-001A-pm-review.md). Commit lokal disiapkan; tidak push/deploy. ParentOPS tetap terbuka; provider production dan logo laporan belum bagian hasil A. Status resume/STOP/assignment di bawah adalah riwayat.

Resume aktif16Oktober2026: Ardy meminta lanjut dari checkpoint dan memilih GPT-6.1 Sol reasoning light. PM memakai gpt-6.1-sol/low sebagai pilihan runtime yang tersedia. Assignment /root/ops_logo_sol_resume melanjutkan WIP dan verifikasi, tanpa reset/install ulang; seluruh25hash checkpoint cocok saat resume. Checkpoint STOP di bawah adalah riwayat. Tidak push/deploy/cloud/data guru.

Status aktif16Oktober2026: ON_HOLD atas permintaan STOP Ardy. Executor berhenti, implementasi parsial belum diterima atau commit. [Checkpoint](../reports/LAB002-OPS-001A-pause-2026-10-16.md) mengatur resume; assignment/izin implementasi berikut adalah riwayat yang ditahan sampai Ardy meminta lanjut.

Tanggal: 16 Oktober 2026. Status: ASSIGNED untuk implementasi setelah review preflight kepada `/root/lab002_rep_c_resume`, Codex gpt-6-luna/max; ACK diterima. Penanggung jawab: Project Manager. Sumber penugasan: Ardy, “lanjutkan OPS bagian logo terlebih dahulu”. Root registry LAB-002; root Git `app`, branch `develop`, baseline `4f01e17`. Tidak ada izin push atau deploy dari request ini.

## Tujuan dan acuan

Guru dapat mengunggah atau mengganti logo pada halaman Sekolah. Logo saat semester ditutup tetap menjadi identitas arsip setelah logo sekolah diganti. Ikuti parent OPS-001 AC01/02/05, kontrak lokal C05/C07/C08, PRD, serta desain UI-002 layar Sekolah 04/05. Parent OPS tetap terbuka untuk cadangan/pemulihan. PM menggunakan studio-task-brief dan studio-acceptance-review; PM memiliki status, dokumentasi dan Git.

## Tahap pertama: preflight saja

Baca instruksi, acuan desain, source halaman/API Sekolah, repository sekolah, trigger penutupan/arsip, migrasi dan grant runtime, autentikasi, pembatasan origin/ukuran, serta fixture terkait. Jangan mengulang setup atau audit seluruh proyek. Periksa working tree dan pertahankan perubahan orang lain. Jangan membaca `.data`, environment privat, atau database guru.

Tulis `reports/LAB002-OPS-001A-preflight.md`: pendekatan penyimpanan privat lokal; decode PNG/JPEG; dependency tepat dan kompatibilitas Node24/Nuxt/Vercel; kontrak API/UI; migrasi baru; penanganan arsip lama; lock ganti logo versus tutup semester; audit/ownership/symlink; serta rencana tes dan browser. Read-only metadata npm dan dokumentasi resmi boleh. Jangan install, coding atau menjalankan migration sebelum review PM.

Vercel tetap target hosting. `.data/uploads` hanya untuk pengembangan/fixture, bukan penyimpanan production persisten. Usulkan antarmuka penyimpanan kecil dengan adapter lokal serta pengaman saat provider production belum disiapkan. Jangan menyimpan permanen di `/tmp` atau mengklaim filesystem Vercel persisten. Penyedia object storage tetap keputusan terpisah; tidak membuat resource, memakai Supabase nyata, atau menambah biaya.

## Batas implementasi setelah review PM

- Terima PNG/JPEG autentik maksimal 2 MB dan 4096×4096 piksel. Periksa signature sebelum decode, lalu validitas decode dan dimensi sebenarnya. Ekstensi/header saja tidak cukup. Tolak SVG dan format lain.
- ID aset acak dan immutable, route privat dengan `nosniff` dan `no-store`. Nama berkas asli tidak dipakai sebagai path. Cegah path traversal dan symlink escape. Tidak ada public URL atau pembacaan berkas arbitrer.
- Metadata disimpan dalam transaksi dengan audit. Bila gagal, bersihkan hanya berkas baru milik operasi itu. Pertahankan aset lama yang dirujuk arsip.
- Pakai migrasi versioned baru; jangan mengubah 0001–0007. Jangan mengisi logo sekarang ke arsip lama karena tidak membuktikan identitas historis. Arsip lama tanpa logo tetap kosong. Pertahankan snapshot immutable, urutan lock bisnis dan pembatasan privilege existing.
- UI mengikuti kartu/form Sekolah pada desain. Ada Pilih logo, pratinjau, dan Simpan perubahan. Desain juga memiliki Hapus logo: bila diterapkan, hanya melepas referensi logo aktif setelah Simpan; tidak menghapus aset historis. Preflight harus merinci draft, batal, simpan, error dan pemulihan agar perubahan metadata lain tidak hilang. Jangan menambah modal atau alur baru tanpa acuan.
- Penambahan ID logo pada arsip termasuk scope. Integrasi gambar pada layout/cetak/PDF laporan dikerjakan pada tahap REP berikutnya, agar kontrak REP A/B/C tidak berubah diam-diam.

Tidak termasuk backup/restore logo seluruh OPS, impor Excel, provider cloud, deployment, data guru, atau printer fisik. Dependency ini tetap dicatat pada parent OPS dan REP.

## Verifikasi dan handoff

Uji HTTP auth, ownership, gambar rusak, ukuran/dimensi, format/MIME, path/symlink, rollback metadata gagal, serta logo historis setelah penggantian dan penutupan bersamaan. Setup akun fixture memakai migrator; operasi sekolah memakai role runtime. Jangan melonggarkan grant demi fixture.

Jalankan typecheck/build Vercel dan smoke decode/storage pada runtime hasil build lokal. PM menguji browser HP/laptop untuk unggah valid/invalid, ganti, gagal, dan batal sesuai alur yang disepakati. Fixture harus sintetis, same-drive `.cache`, dengan TTY untuk STOP. Biarkan fixture hidup untuk PM, lalu bersihkan proses milik fixture dengan aman.

Executor memiliki file implementasi yang ditetapkan setelah preflight, tes dan laporan `reports/LAB002-OPS-001A-report.md`. Laporan membedakan expected/observed, hasil, batas dan `Production Actions: NONE`. Tidak commit, push, deploy atau menutup task sendiri. Next owner PM untuk review preflight, lalu melanjutkan implementasi setelah kontrak READY.

## Keputusan PM setelah preflight — 16 Oktober 2026

Preflight diterima untuk implementasi lokal dalam delegasi Ardy. Ini bukan persetujuan provider/storage production. Kontrak berikut mengunci rincian yang masih diusulkan pada laporan preflight.

1. Pin `busboy@1.6.0` dan `sharp@0.35.5`, serta type package Busboy hanya jika diperlukan dan versi tepat diperiksa. Node24/npm10.9.3, install lokal, lockfile. Tidak upgrade paket lain dengan sengaja. Decoder dan parser hanya server; metadata header bukan bukti decode. Uji runtime hasil build dan catat batas Windows/Linux dengan jujur.
2. Pertahankan JSON PUT sekolah lama. Untuk berkas gunakan multipart PUT pada endpoint yang sama: satu field `metadata` JSON maksimal2KiB dan maksimal satu file `logo`. Metadata memuat nama/kelas/zona waktu dan `logoAction: keep|replace|clear`; default keep untuk JSON lama. Replace wajib punya satu berkas, keep/clear tidak menerima berkas. Tolak field/action/part ambigu, body berlebih, file truncated, dan raw request lewat2MiB+64KiB. Jangan percaya Content-Length sebagai satu-satunya pembatas. Hindari unhandled errors/hanging socket saat limit; respons aman dan tidak ada metadata/file tersimpan.
3. UI memakai satu Simpan seperti desain. Pilih hanya membuat draft dengan preview lokal; Hapus logo menandai clear pada draft. Jangan menambah tombol Batal/modal baru. Muat ulang/meninggalkan halaman membuang draft tanpa mengubah server. Saat gagal semua isian dan file tetap dapat dicoba lagi; saat sukses preview memakai aset tersimpan. Nonaktifkan aksi yang dapat menyebabkan pengiriman ganda saat menyimpan; pertahankan client-ready guard. Logo tidak wajib dan sekolah awal boleh tanpa logo.
4. Tabel aset metadata immutable dengan FK kepemilikan sekolah. Pointer logo aktif dan pointer snapshot nullable harus dibatasi agar tidak menunjuk aset sekolah lain (composite FK atau guard setara yang diuji). Runtime hanya SELECT/INSERT pada aset, tanpa UPDATE/DELETE; grant/RLS mengikuti pola server-only existing, tanpa akses API publik. ID/path/namaasli bukan input referensi dari klien. Trigger audit dan fungsi baru menetapkan search_path aman. Jangan memperluas privilege fungsi atau mengubah migration0001–0007.
5. Migration0008 menambah kolom/pointer nullable. Arsip existing tetapNULL; tidak backfill. Capture/guard saat tutup semester memasukkan IDlogo yang sah. Pengubahan snapshot setelah tutup tetap ditolak. Tidak physical-delete aset lama saat clear/replace; cleanup rollback hanya file baru yang dibuat operasi itu. Simpan file valid sebelum transaksi, lalu sekolah/kelas/aset/pointer dalam satu transaksi; initial create gagal tidak meninggalkan baris parsial.
6. Serialisasi save per guru memakai advisory namespace1729 dan hash IDguru, sebelum lookup yang mungkin create. Untuk sekolah existing ambil lock1728 sekolah sebelum rowlock. Semua save mengikuti urutan1729 lalu1728 lalu rowlock; closure tetap1728 tanpa1729. Tidak ada rowlock sekolah lalu meminta1728. Pertahankan constraints dan tutup semester existing; uji concurrency dengan timeout terbatas.
7. Adapter lokal privat di root yang ditentukan server, ID UUID, file exclusive, validasi symlink seluruh komponen dan file target, baca bukan path klien. Route `GET /api/school/logo/:assetId` memeriksa session/ownership/referensi sekolah atau arsip dan memberi MIME terverifikasi/no-store/nosniff. Aset lama milik sekolah boleh tetap dibaca demi arsip; foreign/missing sama404. Tidak mengekspos storage key/path/namaasli/bytes melalui JSON atau log.
8. Adapter lokal otomatis hanya pada dev/fixture. Untuk Node compiled lokal gunakan opt-in konfigurasi lokal yang jelas. Bila VERCEL aktif, adapter lokal tidak boleh dipakai, termasuk Preview; jangan fallback ke .data atau /tmp. Provider belum tersedia: save metadata tanpa perubahan logo tetap dapat berjalan, sedangkan operasi upload/read logo gagal aman dengan pesan pengguna tanpa detail implementasi. UI boleh menyampaikan logo belum tersedia pada lingkungan itu; jangan menggagalkan seluruh aplikasi Sekolah/absensi. Tes guard tanpa akses layanan nyata.
9. Ownership Executor: school UI/API/repository/types; helper parser/decoder/storage; migration0008 dan trigger terkait; config aman yang diperlukan; package/lock; tes/runner/fixture dan laporan. Tetap pertahankan API/model/layout laporan REP; integrasi gambar pada laporan menyusul. Tidak mengerjakan backup/restore parent OPS pada subtask ini.
10. Verifikasi sesuai task/preflight. Sertakan byte-identik read logo, invalid decode, initial create, clear, archive/current pointer, rollback, concurrency, symlink dan body limits. Regresi auth/students/semester/report yang terpengaruh; typecheck/build dan successful compiled HTTP upload/read pada DB/assetroot sintetis. Tunjukkan fixture kepada PM sebelum finishing seluruh laporan. Tidak source berubah sesudah verifikasi final tanpa pemeriksaan ulang.

Status: ASSIGNED untuk implementasi kepada Executor yang sama. Next owner Executor; PM mengikuti hasil dan melakukan review/browser independen. Tidak push, deploy, membaca data guru atau menerapkan migration pada database persisten/cloud.
