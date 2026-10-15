# LAB002-OPS-001A — Laporan Executor

Tanggal: 16 Oktober 2026. Executor resume: `/root/ops_logo_sol_resume`, Codex `gpt-6.1-sol/low` (padanan light yang diminta Ardy). Hasil implementasi lokal diserahkan kepada PM; penerimaan dan status task milik PM. **Production Actions: NONE.**

Root Git: `D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/app`, branch `develop`, baseline `4f01e171447d0f205de7fa14686ba403d7de4421`. Tidak commit, push, deploy, memakai layanan cloud, membaca environment privat/data guru, atau menerapkan migrasi ke database persisten. Dependency dari checkpoint dipertahankan tanpa install ulang.

## Acuan dan perubahan aktual

Mengikuti `AGENTS.md` workspace, protokol PM & Executor v1.0, workflow/keputusan studio, copy pengguna, kualitas interaksi, task OPS-001A beserta sepuluh kontrak PM, preflight, checkpoint STOP, dan review PM parsial. Registry menjadi acuan; dokumen PM tidak diedit Executor.

Implementasi yang sudah ada saat resume dipertahankan: satu Simpan pada halaman Sekolah, draft logo/preview lokal/clear, error yang mempertahankan isian; multipart terbatas dan JSON lama pada PUT Sekolah; decode penuh Sharp; storage lokal privat; route gambar yang memeriksa ownership/referensi; transaksi/audit/aset immutable; migrasi0008 dan snapshot logo saat penutupan. Tidak ada perubahan source runtime, UI, dependency atau migrasi saat resume ini.

Pekerjaan resume hanya melengkapi verification dan alat fixture:

- `tests/students.test.ts`: edge decode/field/part/raw request, rollback awal dan existing, kepemilikan/privilege, migrasi arsip lama/down-up, concurrency save versus closure. Raw socket menunggu respons server sebelum menutup agar pengujian chunked tidak kehilangan respons.
- `tests/school-logo-storage.test.ts`: benturan exclusive create, symlink file, traversal dan junction komponen direktori, guard Vercel.
- `tests/support/temporary-postgres.mjs` serta root isolated Nuxt students memakai `.cache/tests`; ACL dibatasi pada root tes, tidak mengubah `.data`. Tidak memindah atau menghapus folder lama `.data`.
- `scripts/test-all.mjs` memanggil runner logo yang memasukkan storage dan regresi students, tanpa menggandakan students. `scripts/fixture-school-logos.mjs --compiled-smoke` membangun salinan terisolasi, membuktikan hash sumber/copy dan HTTP compiled, lalu membersihkan fixture.
- `tests/database.test.ts` memperbaiki tanggal fixture throttle lama. Gate membaca waktu aktual, sedangkan tanggal tetap13Oktober menyebabkan record expired ketika dijalankan16Oktober; observed8admitted versus expected5. Fixture kini memakai `new Date()` pada jendela yang sama. Assertion5admitted/3blocked serta expiry tetap utuh; kode autentikasi production tidak diubah. Perubahan tes ini disetujui PM.

## Self-check kontrak dan bukti

| Kontrak | Expected dan observed lokal | Hasil |
|---|---|---|
| PNG/JPEG autentik, ukuran/decode | Initial PNG dan penggantian JPEG tersimpan; read byte-identik. Signature rusak, SVG, MIME mismatch, decode truncated dan width4097 ditolak422; file2MiB+1 ditolak413. | PASS |
| Request terbatas dan tidak ambigu | Duplicate/unknown/oversized metadata, file tambahan, replace tanpa file, keep dengan file ditolak422. Chunked tanpa Content-Length untuk JSON dan multipart melewati2MiB+64KiB ditolak413 tanpa socket menggantung atau metadata tersimpan. | PASS |
| Penyimpanan privat | UUID server-side; read/write byte-identik; existing file tidak terhapus saat O_EXCL collision. File symlink dan junction komponen/path traversal ditolak; target di luar tidak berubah. | PASS |
| Auth/ownership | HTTP tanpa sesi dan origin lintas situs ditolak; foreign/missing logo sama404. Cross-school active pointer ditolakFK23503. Runtime aset tanpa UPDATE/DELETE ditolak42501; migrator update ditolak immutable55000; API roles tidak punya SELECT. | PASS |
| Transaksi dan cleanup | Trigger gagal sintetis saat initial class insert: sekolah/aset tetap0 dan root logo kosong. Gagal update existing:503, metadata/pointer/file lama utuh, hanya berkas baru dibersihkan. | PASS |
| Arsip | Closure menangkap logo; replace/clear tidak mengubah pointer arsip dan logo historis tetap dapat dibaca. Snapshot update ditolak. Migrasi0001–0007 dengan arsip sintetis lalu0008 meninggalkan logoNULL; down/up tetapNULL. | PASS |
| Lock | Save berurutan melalui1729→1728. Dua save yang ditahan lock selesai200. Closure yang ditahan1727 memegang1728; logo save menunggu1728 lalu selesai200 setelah closure, snapshot tetap logo sebelum save. Tidak deadlock dalam timeout tes. | PASS |
| UI dan pemulihan | Bukti browser PM sebelumnya pada PNG/JPEG/create/draftclear/reload/invalid/oversize/503retry/320/390/SSR guard tetap relevan karena hash UI/CSS tidak berubah. Lihat review PM; Executor tidak mengklaim menjalankan browser ulang. | Bukti PM tersedia |
| Guard lingkungan | Unit guard menolak adapter lokal ketika VERCEL atau VERCEL_ENV aktif termasuk Preview meskipun local opt-in. Metadata keep tidak memerlukan storage menurut source. | PASS guard; provider production belum tersedia |
| Compiled runtime | Build Vercel dan node-server lokal; artifact runtime nodejs24.x. Compiled Windows Node24 login200, upload200, private read200 dengan header MIME/no-store/nosniff dan bytes identik. | PASS lokal |

## Verification final

Lingkungan: Windows, Node `v24.19.0`, PostgreSQL16 temporer, role runtime `lab002_app`, setup/migrasi dengan migrator. Data/aset sintetis, loopback saja.

- `nuxt typecheck --checker vue-tsc`: exit0 setelah tambahan tes terakhir.
- Storage final:5/5 PASS,0skip; junction dan symlink benar-benar dijalankan pada akun Windows ini.
- `node scripts/test-all.mjs`: exit0; DATA13/13, AUTH15/15, storage4/4 pada saat runner memuat file, migration+HTTP/STUD/SEM9/9, CAL5/5, ATT7/7, REP8/8. Total61PASS/0fail/0skip. Satu tes storage traversal+junction ditambahkan saat runner sudah melewati storage, lalu file final dijalankan mandiri5/5PASS; tidak mengklaim runner lama memuat tes kelima. Seluruh source produk tetap sama.
- `node --experimental-strip-types scripts/fixture-school-logos.mjs --compiled-smoke`: exit0. Kedua build dan HTTP compiled PASS. Warning build existing dependency exports serta Busboy top-level `this` tidak menggagalkan build atau multipart HTTP compiled.

Evidence lokal ignored: `app/.cache/OPS001A-tests.log`, `app/.cache/OPS001A-compiled.log`, dan `app/.cache/LAB002-OPS-001A-compiled-evidence.json`. JSON compiled berisi hash seluruh app/server/shared/config/package, hasil copy==source sebelum build, dan pemeriksaan source stabil sesudah smoke. Pemeriksaan ulang menghasilkan0mismatch. SHA256 evidence compiled: `fe244ec6147823567f4fd32e6bc0c4244e2bc01e9d802a7e0e056ae02abeaf6f`.

Source utama final SHA256:

```text
app/pages/school.vue 1a8e4e9747f8c0ed319b533968a6f9ed0ff295f1317bdae890992ba6b475fcf4
app/assets/css/main.css b4aeebfa49ea349188ab9b69d861f556b61b151b14bee528b615ae33c642ed7e
server/api/school/index.put.ts e34e45899ffd821f197d36ceaca5ed4a7945761e13561a6151bc33b0a26f7efe
server/utils/school-logo.ts 701c807cc489d3207160b04db418c5dd453e38d29ae114b0b5252139263d3b56
server/utils/school-logo-storage.ts 3a62356a7a03d218fc64fbd26929a669a5a8267ee96edea96e5bc0b096710660
server/database/migrations/0008_school_logo_assets.up.sql f22b41d063aef114c099951c207e8de0adf38f9c91971803a0d4fcc0f1af67e3
server/database/migrations/0008_school_logo_assets.down.sql 6082a592832bff8e7580a9ce840c1cfd7dc527eb4c0fdfbe7c2895260e331ae7
tests/students.test.ts edaf03171027e4b63169fdce3dcd1f2c9ad9b3602e561f7395fb5b850fbbf612
tests/school-logo-storage.test.ts a52aafb51719b566f9c5c210b6faa8f6ed5ae923fa4bcb3ed633d6938c090f83
```

## Batas dan next owner

Native Sharp hasil build Windows tidak membuktikan binary/decode Linux Vercel. Provider penyimpanan production belum dipilih/disiapkan; Vercel tidak memakai fallback filesystem persisten. Logo belum terintegrasi ke PDF/cetak/layout laporan; backup/restore logo tetap parent OPS. Tidak ada bukti printer fisik atau pemakaian data guru dari pekerjaan ini.

Fixture compiled milik proses ini berhenti dan direktori generated-nya dibersihkan. Folder lama `.cache/school-logo-fixture-gkRij2` dipertahankan: tidak ditemukan postmaster.pid atau commandline postgres yang menunjuk root itu, tetapi ownership historis tidak dipastikan sehingga tidak dihapus.

Next owner: PM untuk review independen terhadap diff, hasil tes dan batas, sinkronisasi laporan ke salinan Git, serta keputusan penerimaan lokal. Executor tidak menutup task.
