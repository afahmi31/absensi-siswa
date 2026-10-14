# LAB002-REP-001A — Model rekap laporan

Tanggal: 15 Oktober 2026. Status: CLOSED untuk subtask model/API lokal. PM menerima hasil melalui delegasi lokal Ardy setelah review source, suite REP independen6/6, typecheck dan build ulang pada kode final. Executor juga melaporkan kalender5/5 dan absensi7/7. Assignment aktual /root/lab002_rep_preflight, Codex worker gpt-6-luna/max. Laporan dan review tersedia pada reports/LAB002-REP-001A-report.md dan reports/LAB002-REP-001A-pm-review.md. Task induk REP-001 belum selesai; next owner PM untuk kesiapan UI/cetak dan dependency output/logo.

## Tujuan dan acuan

Menyiapkan satu model laporan read-only yang akan dipakai bersama oleh pratinjau, cetak browser dan PDF. Ini potongan task induk REP-001; hasil backend saja tidak menyelesaikan kebutuhan laporan pengguna.

Acuan: PRD R03/R06–R14, kontrak lokal C05/C07, desain UI-002 bagian laporan, laporan preflight REP-001, instruksi workspace, user-facing-copy dan interaction-quality. Root kode app, root docs registry LAB-002.

## Scope

Repository/model bertipe dan endpoint GET laporan terlindungi. Memilih semester milik guru lalu mode bulan (YYYY-MM) atau kumpulan bulan semester. Validasi input melalui pola existing, tanpa dependensi baru. Semua operasi read-only; data uji sintetis pada cluster tes terisolasi.

## Acceptance criteria

1. Endpoint hanya mengembalikan data semester milik akun yang masuk, tanpa cache publik. Tanpa sesi ditolak; ID semester tidak dikenal/milik akun lain tidak membocorkan data. Parameter mode/bulan/tanggal invalid ditolak dengan pesan yang dapat dimengerti.
2. Bulan dalam semester mengikuti tanggal awal/akhir inklusif. Bulan yang hanya beririsan sebagian tetap memiliki 31 kolom. Bulan di luar semester tidak diterima sebagai laporan bulan. Mode semester menghasilkan bulan kronologis, bukan gabungan tanggal dalam satu tabel besar.
3. Daftar siswa per bulan mencakup keanggotaan yang beririsan dengan bulan dan semester. Identitas memakai snapshot membership; metadata semester tertutup memakai snapshot arsip. Urutan deterministik mengikuti pola roster existing, dengan pembeda ID untuk nama sama. NIPD/JK opsional menjadi kosong.
4. Setiap sel memiliki H/S/I/A atau kosong. Kosong berlaku untuk belum diisi, libur, tanggal tidak ada, luar semester atau luar tanggal terdaftar. Hanya attendance efektif pada hari sekolah yang dihitung; riwayat, status yang sudah dikosongkan, dan status yang dinonaktifkan oleh libur tidak dihitung ganda. Total S/I/A sama dengan sel efektif. Tanggal kembali sekolah tidak menghidupkan absensi lama.
5. Pembacaan data konsisten dalam satu respons saat ada perubahan serentak; tidak menggabungkan metadata sebelum koreksi dan total sesudah koreksi secara tidak sengaja. Tidak membuat query per siswa/tanggal atau memanggil endpoint harian berulang untuk setiap hari. Pilih query bounded/set-based dan pola transaction existing yang tidak membutuhkan peningkatan privilege atau migrasi.
6. Input masa depan tetap tidak menciptakan absensi. Tidak ada insert/update/delete/audit domain dari GET. Semester tertutup tetap bisa dibaca; tidak membuka atau mengubah arsip.
7. Tes bermakna mencakup boundary semester/membership, 28/29/30/31 hari, tahun berganti, H/S/I/A/blank, koreksi/clear/libur/restore sekolah, nama sama/NIPD kosong, arsip, autentikasi/owner dan input invalid. Bukti expected total berasal fixture eksplisit. Sertakan pemeriksaan jumlah data domain tidak berubah setelah GET.
8. Laporan Executor memisahkan hasil model/API dari UI/cetak/PDF yang belum dibuat. Error server tidak membocorkan SQL/secret/data siswa.

## Batas perubahan dan verification

Ownership Executor: file baru model/repository/report GET dan tes/runner terkait, penambahan command tes pada package.json bila diperlukan, serta laporan REP-001A. Shared types boleh ditambah; auth/session/schema/pool/driver/migration, UI absensi, akun dan data existing tidak diubah. Tidak menambahkan PDFKit atau logo pada task ini. Tidak akses .data nyata/secret/cloud, push/deploy atau global install. Tidak menjalankan migrasi pada database persisten.

Jalankan suite laporan terisolasi, regression suite existing yang relevan, typecheck dan build Vercel dengan Node24/npm10.9.3. Jangan memakai Node default22. PM melakukan review diff dan uji independen. Cetak fisik/guru bukan evidence tahap backend ini. Eskalasi bila perlu schema/grant/dependency atau perubahan flow.

## Deliverable dan next owner

Source/test, ringkasan kontrak request-response dan reports/LAB002-REP-001A-report.md. PM memeriksa hasil sebelum menyiapkan tahap UI/cetak/PDF/logo. Delegasi lokal Codex gpt-6-luna/max berlaku; assignment aktual tercatat pada header. Task induk tidak ditutup oleh hasil bagian ini.
