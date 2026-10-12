# Kontrak delivery lokal v1

Tanggal 2026-10-12. Pemilik keputusan PM berdasarkan delegasi Ardy 12 Oktober; scope PRD tetap. Keputusan ini menggantikan OPEN terkait implementasi lokal; tidak menyatakan approval Ardy per aturan.

C03: template Excel Nama/NIPD/Jenis Kelamin/Tanggal Masuk/Tanggal Keluar. Nama wajib; JK kosong/L/P; tanggal ISO YYYY-MM-DD optional, masuk default awal semester. Preview semua baris; commit seluruh baris valid yang dipilih hanya jika tidak ada error pada baris yang dipilih dan seluruh nama sama sudah dipilih tambah berbeda/lewati. Invalid tidak diimpor; tidak overwrite.
C04: satu akun lokal email/password disiapkan CLI owner; reset melalui CLI owner, tidak register publik/reset email. Gunakan hashing/session library yang sesuai, bukan password plaintext. Provider cloud/Auth tetap di luar local delivery.
C05: report libur/belum masuk/sesudah keluar/di luar semester/tanggal tidak ada kosong; tetap 1–31. Header berulang dan baris siswa utuh. PDF download sungguhan terpisah dari browser print/save-as. Tiga ukuran PRD landscape, no signature.
C06: save manual atomic per hari dengan revision/version; pertahankan input ketika gagal, warning keluar dirty, stale write409 tanpa overwrite otomatis. Guru muat ulang dengan konfirmasi kehilangan draft. Tidak autosave/retry otomatis. Sukses hanya servercommit.
C07: tanggal masuk/keluar inklusif. Awal/akhir semester inklusif; tidak periode overlap, satu aktif; tidak merekam masa depan. Edit periode yang mengecualikan attendance lama ditolak. Semester ditutup immutable; tidak reopen. Identitas siswa disnapshot ke membership semester dan dapat diedit pada semester aktif; arsip semester lain tidak berubah. Tidak hapus student/membership yang punya attendance/history, gunakan keluar/nonaktif. Libur berabsensi membutuhkan konfirmasi; history tetap status efektif excluded. Libur balik sekolah tidak mengaktifkan status lama otomatis, perlu isi ulang. Rutin kalender perubahan future/tanggal tanpa catatan saja; override tanggal berabsensi mengikuti confirmation. Salin semester hanya roster yang masih terdaftar pada akhir semester sebelumnya; buat membership snapshot baru tanpa attendance.
C08: audit actor/waktu UTC/entity/date/type/old-new termasuk correction/calendar/closure/identity, immutable dan tidak dipurge otomatis v1. Data tugas fiktif. Local backup data+logo on-demand owner, restore hanya target lokal terisolasi diverifikasi; bukan layanan background/cloud/retensi production.

Tanggal absensi database tipe date; waktu audit UTC; timezone sekolah default Asia/Jakarta, metadata bisa dipilih saat setup. Tidak mengambil tanggal Windows sebagai kalender siswa otomatis. Semantik belum diisi bukan Alpa. Total S/I/A hanya effective attendance saat schoolday dalam semester dan membership.

Teknis lokal: PostgreSQL cluster proyek terisolasi memakai binary existing PG16, data app/.data/postgres, loopback port55432 atau free port tertera env. SCRAM password random lokal disimpan ignored .env/private file; jangan expose/log. Tidak mengubah service PG18 existing atau Docker yang stopped. Node24/Postgres.js server-only + SQL migrasi versioned transactional dipilih PM; ORM tidak diperlukan untuk scope ini. SQL/repositories typed dan transaksi domain diuji. Supabase tetap target provider online kelak, belum resource/connection.

Langkah delivery: DATA-001 fondasi schema/local DB/invariant/repo tests; AUTH-001 login; UI-002 desain lanjutan PM-review; STUD/IMP/CAL/ATT/SEM/REP/OPS berurutan sesuai dependency dan QA/REL lokal. PM memberi acceptance berdasarkan evidence, browser localhost dan fixtures; fisik cetak dan cloud tetap belum diverifikasi.


## Rincian tools laporan/impor — keputusan PM lokal

Excel memakai ExcelJS server-side dengan versi stabil dipin setelah kompatibilitas diperiksa Executor. Upload .xlsx maksimal5MB dan maksimal500baris, validasi ZIP bounded sebelum parse (totaluncompressed20MB; reject macro/embedded binaries/formula cells), dataheaderC03 tetap dan teksNIPD menjaga nolawal. Parser/preview yang gagal tidak mengubah siswa. Ini batasaman v1lokal bukan jumlahsiswasekolah nyata; filemelebihibatas diberi error jelas.
PDF memakai PDFKit Node server-side dipin setelah kompatibilitas, no Chromiumserver/cloudrender. Dua output browserprint dan PDF file nyata dari modeldata laporan yang sama; ukuran kertas/dimensi pointdanpagination wajibtest. Logo PNG/JPEG maksimal2MB/dimensi4096, private localstorage dan serve protectedroute; sebelum PNG/JPEG decode periksa content magic/dimensions, bukan hanyaextension. PDFfontfamiliar builtin untukteksIndonesia; nama panjangwrap dan rowheightutuh, tidakcrop.
Sumber resmi ditinjau12Oktober2026: https://github.com/exceljs/exceljs ; https://pdfkit.org/docs/getting_started.html ; https://pdfkit.org/docs/paper_sizes.html . Semua penggunaan runtime akan diuji terkait; belum dependencyterpasang atau PDF/Excel dibuat.

## C04 — Sesi login per perangkat

Keputusan PM saat melanjutkan AUTH-001, 12 Oktober 2026, dalam delegasi pengelolaan lokal Ardy: setiap login mempunyai ID sesi acak dan record server-side. Logout mencabut hanya sesi perangkat tersebut. Reset kata sandi melalui CLI owner menaikkan versi akun dan mencabut semua sesi lama. Ini menjaga penggunaan HP dan laptop tanpa logout saling mengganggu.

Cookie berisi identitas tersegel; hash kata sandi dan rahasia sesi tidak dikirim ke respons pengguna. Masa sesi tujuh hari. Request tulis wajib berasal dari origin aplikasi. Cookie production memakai Secure; HTTP loopback diizinkan untuk pengujian lokal. Throttle sementara hanya berlaku non-production per proses, sehingga kontrol pembatasan production/distribusi tetap belum diverifikasi dan perlu dibahas pada target deployment.

Implementasi tetap tanpa signup publik, reset email, layanan Auth cloud, atau koneksi Supabase. Akun persisten lokal menggunakan alamat fiktif; kredensial disimpan pada .data yang diabaikan Git. Data siswa asli tidak dipakai.

## C06 — Draft kosong dan revisi hari

Keputusan PM dalam delegasi lokal Ardy 12 Oktober: guru boleh mengembalikan status yang salah ke Belum diisi saat semester aktif, lalu Simpan. Status lama disimpan sebagai riwayat dan tidak lagi efektif; kosong tidak dihitung Alpa. Ini memperjelas koreksi/input parsial tanpa hard-delete. Token revisi penyimpanan harian mencakup catatan, roster eligible dan kalender yang dibaca, sehingga perubahan dua perangkat/kalender/masa terdaftar menghasilkan konflik terarah sebelum overwrite. Detail implementasi ditetapkan dan diuji pada ATT.
