# PREFLIGHT REPORT — LAB002-REP-001

Tanggal: 15 Oktober 2026
Dari: Executor `/root/lab002_rep_preflight`
Kepada: PM
Tahap: PREFLIGHT-ONLY
Task induk: `LAB002-REP-001` (`ANALYSIS`)

## Repository dan batas pemeriksaan

- Root dokumentasi: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa`.
- Root codebase: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app`.
- `git status` pada root dokumentasi menyatakan folder itu bukan repository. Checkout aplikasi berada pada branch `develop`, commit `4de54c94aff12da43c1b106d706628b0686c1eaf`, satu commit di depan `origin/develop`, dengan working tree bersih. Tidak ada checkout, merge, commit, push atau akses remote.
- Stack yang tercatat: Nuxt 4.6.1, Vue 3.5.43, TypeScript, Node 24, npm 10.9.3, PostgreSQL/Postgres.js. `package.json` mematok engine Node `>=24.15.0 <25` dan npm `>=10.9.3 <11`.
- Pemeriksaan hanya membaca dokumentasi, package manifest/lock, source, migration dan test yang relevan. Tidak membaca `.data`, credential, database, file Excel atau data guru; tidak mengakses layanan online. Tidak menjalankan test/build karena preflight-only dan tidak ada perubahan kode.
- File laporan ini berada di registry dokumentasi yang terpisah dari Git checkout `app`; karena itu file ini tidak muncul pada status Git aplikasi.

## Acuan yang dibaca

- Instruksi workspace `AGENTS.md` dan salinan instruksi pada `app/docs/studio/governance/instructions.md`; Protokol PM & Executor v1.0, workflow studio, keputusan workflow, panduan bekerja dari dokumentasi, copy pengguna, dan kualitas interaksi.
- Task `LAB002-REP-001-preflight.md`, task induk `LAB002-REP-001.md`, draft `LAB002-REP-001A.md` (dibaca saja), task `LAB002-OPS-001.md`, Kontrak Delivery Lokal v1 (C05/C07), PRD R11–R14, README registry dan README aplikasi.
- README desain UI-002 dan review PM UI-002. Review menyatakan arah desain diterima untuk implementasi, tetapi desain statis belum membuktikan runtime, cetak atau PDF.
- Source: migrations `0001_core` dan `0003_semester_archive_snapshots`, repositories `attendance-days.ts`, `attendance.ts`, `calendar.ts`, `semesters.ts`, `students.ts`; API attendance, semester, auth; package manifest/lock; serta test attendance, calendar dan students.

## Hasil terhadap AC preflight

### AC-01 — Data, akses dan hitungan

**TERDOKUMENTASI:** Model laporan lokal dapat dibangun dari tabel semester/keanggotaan/kalender/absensi yang sudah ada. `effective_attendance` pada `app/server/database/migrations/0001_core.up.sql` hanya memuat catatan efektif dan membatasi tanggal ke masa keanggotaan serta periode semester. Fungsi `is_school_day` memakai pengecualian tanggal lebih dahulu, lalu aturan rutin; bila aturan tidak tersedia, hari bukan hari sekolah. Perubahan kalender yang menjadikan tanggal libur mengecualikan catatan lama sebagai riwayat; `manual_clear` juga bukan status efektif (`0004_attendance_manual_clear.up.sql`, `attendance-days.ts`).

**Kebutuhan implementasi model:** Hitung ulang dengan rentang tanggal inklusif per sel. Sertakan anggota bila `membership.starts_on <= akhir-bulan-dalam-semester` dan `ends_on` kosong atau `ends_on >= awal-bulan-dalam-semester`; lalu kosongkan sel sebelum/sesudah masa keanggotaan. Gunakan snapshot nama/NIPD/JK, tanggal dalam semester, hari sekolah, dan `effective_attendance` untuk setiap sel. Sel kosong atau nonberlaku tidak dihitung; H ditampilkan tetapi tidak masuk total S/I/A. Terapkan pemeriksaan `is_school_day` di query/model laporan, walaupun write path dan kalender sudah menjaga status efektif, agar syarat laporan dinyatakan secara eksplisit. Urutkan nama lalu ID membership agar nama sama deterministik.

Repository absensi harian saat ini hanya memuat roster yang terdaftar pada **tanggal tunggal** yang sedang dibaca (`attendance-days.ts`, query `membership_state`). Ia tidak mencakup anggota yang keluar di tengah bulan setelah tanggal tersebut. Laporan perlu query set-based berdasarkan irisan membership–bulan; jangan memanggil endpoint harian satu kali per tanggal/siswa.

Untuk semester aktif, identitas sekolah/kelas dan metadata periode bersumber dari record saat ini. Untuk semester tertutup, migration `0003_semester_archive_snapshots.up.sql` menyimpan nama sekolah, nama kelas, tahun ajaran, term dan tanggal periode; data nama/NIPD/JK ada pada snapshot membership. Guard penutupan menjaga data semester arsip tetap terkunci. Ini cukup bagi model laporan tanpa logo.

Endpoint laporan perlu mengikuti pola owner/auth yang sudah ada: validasi `semesterId` dan parameter, batasi query melalui `school.teacher_id`, minta sesi guru, dan kirim `Cache-Control: no-store`. API attendance/semester saat ini menunjukkan pola tersebut. GET hanya membaca; jangan menulis audit atau domain data.

**Temuan model:** Tidak ada blocker teknis yang teramati untuk model/API baca-saja. Draft AC 5 meminta satu respons konsisten saat data berubah bersamaan. Helper `inDatabaseTransaction` memakai transaksi default tanpa opsi isolation level, jadi implementasi paling sederhana adalah satu query SQL bounded/set-based; bila memakai beberapa query, gunakan cara baca yang menjamin satu snapshot konsisten dan tidak mengubah data. Ini batas implementasi, bukan kebutuhan migrasi.

### AC-02 — Desain dan tata letak

UI-002 menetapkan pemilihan bulanan atau semester dan A4/F4-Folio 21,6 × 33 cm/Letter, semuanya landscape; laporan semester adalah kumpulan tabel bulanan. Tabel berisi identitas sekolah, kelas/periode, No, Nama, NIPD, JK, tanggal 1–31, dan total S/I/A. Header harus berulang dan baris siswa tidak terpotong; nama panjang boleh membungkus. Tidak ada area tanda tangan. Desain HP berfokus pada pilihan laporan/kertas; preview laporan ada pada rancangan laptop.

Rancangan adalah SVG/PNG statis. Tidak ditemukan halaman atau komponen runtime laporan; `app/app/pages/index.vue` masih menyebut laporan belum tersedia. Bukti browser/cetak belum ada.

### AC-03 — API, browser print, PDF dan logo

Belum ada `server/api/reports`, halaman laporan atau rute PDF; `pdfkit` tidak tercantum di `package.json`/lockfile. C05 memilih PDFKit Node lokal, tetapi versi tepat dan kompatibilitas resmi belum diverifikasi. Sebelum pemasangan, task implementasi harus memeriksa versi yang dipin dan kompatibilitasnya dengan Node/Nuxt yang digunakan, lalu menguji font bawaan untuk teks Indonesia/nama panjang serta ukuran kertas termasuk F4.

Browser print dan berkas PDF adalah keluaran berbeda yang memakai model laporan sama. Browser hanya membuka dialog cetak atas tindakan pengguna. Endpoint PDF harus mengirim berkas valid `%PDF`, MIME dan nama aman, halaman landscape berukuran tepat, tabel/header/baris utuh, serta `no-store`; kegagalan tidak boleh tampak sebagai PDF kosong yang berhasil. Tampilan layar dapat menggulir tabel secara mendatar.

**DEPENDENCY LOGO:** `schools.logo_path` tersedia di schema, tetapi tidak ada upload/serve logo pada API/source yang diperiksa. Yang lebih penting untuk arsip, `semester_archive_snapshots` tidak menyimpan identitas logo, dan belum ada migration lanjutan yang menambah snapshot itu. `LAB002-OPS-001` masih `ANALYSIS` dan laporan hasil OPS tidak tersedia. Karena kontrak meminta logo privat serta snapshot logo pada penutupan, rendering penuh untuk semester tertutup belum siap. Ini dependency tahap logo/output, bukan blocker model REP-001A; jangan menambahkan field logo semu ke task model.

### AC-04 — State pengguna dan verifikasi

Belum ada state runtime halaman laporan untuk diperiksa. Acuan UI-002 dan pola auth/error existing cukup untuk task berikutnya menyusun state ini:

| Keadaan | Perilaku yang perlu diterapkan dan diperiksa |
|---|---|
| Memilih periode dan kertas | Pilihan mode bulan/semester dan ukuran A4/F4/Letter terlihat; bulan valid harus beririsan dengan semester. Opsi cetak dan unduh PDF dipisahkan. Jangan memilih default periode yang tidak ditetapkan desain. |
| Memuat | Tampilkan bahwa laporan sedang dimuat; cegah tindakan ganda sampai hasil/error diketahui. Jangan memberi sukses sebelum data/berkas tersedia. |
| Kosong | Daftar semester kosong dan bulan valid tanpa siswa perlu copy tindakan berikutnya. Model dapat mengembalikan `members: []`; perilaku mencetak tabel header tanpa baris siswa belum ditentukan dan perlu diputuskan PM sebelum task UI/cetak. |
| Gagal | Pesan aman dan tindakan mencoba kembali; pertahankan pilihan periode/kertas. Jangan membocorkan SQL atau detail sesi. |
| Akses ditolak | Halaman yang memerlukan login mengikuti redirect auth existing; API menolak tanpa sesi dan mengembalikan respons aman untuk semester milik akun lain/tidak ada. Tidak ada cache publik. |
| HP/laptop | Pada HP, kontrol pilihan tetap dapat dipakai dan tabel lebar dapat digulir mendatar; pada laptop tersedia preview sesuai desain. Uji browser localhost pada viewport sasaran oleh PM sesuai delegasi LAB-002. |

Untuk model, buat fixture sintetis dengan semester parsial Jan–Mar dan Februari kabisat: rutin Senin–Jumat, satu libur, satu membership berakhir di tengah bulan dan satu mulai di tengah bulan. Isi H/S/I/A, koreksi, hari libur yang mengecualikan catatan, dan satu hari sekolah kosong. Tetapkan expected total eksplisit; contoh hitungan: anggota pertama H=1/S=1/I=0/A=1 menghasilkan S=1, I=0, A=1; anggota kedua H=1/S=1/I=1/A=1 menghasilkan S=1, I=1, A=1. Periksa awal/akhir semester dan masa membership inklusif, tanggal tidak ada (Februari 30/31), sebelum/sesudah periode, status clear/holiday, nama sama, NIPD/JK kosong, serta semester lintas tahun. Bandingkan isi tabel domain sebelum/sesudah GET untuk membuktikan tidak ada write.

Untuk tahap output sesudah model: uji setiap ukuran kertas di preview browser dan PDF nyata; fixture sekurangnya 45 siswa serta nama panjang multiline; ulangi header, pastikan baris utuh dan catat halaman pertama/terakhir. Pisahkan bukti PDF valid/dimensi dari browser dialog print. Printer fisik tidak diuji atau diklaim lulus.

## Rencana urutan dan file yang diperkirakan

1. **Model/API baca-saja (draft REP-001A):** tambah repository/model laporan dan GET terlindungi, tipe response, fixture/runner tes laporan, serta dokumentasi kontrak response/laporan. Kandidat path: `app/server/database/repositories/reports.ts`, `app/server/api/reports/[semesterId].get.ts`, `app/tests/reports.test.ts` dan runner/package script bila pola runner memerlukannya. Tidak perlu dependency atau migration.
2. **UI dan browser print:** halaman pilihan/preview laporan dan komponen tabel bersama; implementasi loading/kosong/error, scrolling layar, CSS print untuk ukuran/landscape/header/baris serta dialog cetak atas tindakan pengguna.
3. **PDF nyata dan logo:** route/renderer server PDFKit versi yang telah diverifikasi dan dipin; integrasi aset logo privat/snapshot sesuai OPS sebelum mengklaim laporan arsip memiliki logo historis. Tidak memasang paket pada preflight.
4. **Pemeriksaan end-to-end lokal:** fixture/output seluruh ukuran, PDF/render/unduhan, viewport HP/laptop dan regresi data absensi; PM mencatat browser/versi/evidence. Tidak mengklaim printer fisik.

Kandidat path di atas adalah perkiraan; PM mengunci ownership, nama task dan daftar perubahan saat menyiapkan assignment berikutnya. Tidak ada source yang diubah pada preflight ini.

## Blocker, risiko dan keputusan berikutnya

- **Model/API REP-001A:** tidak ada blocker data/arsitektur yang ditemukan. Rekomendasi preflight: `READY_TO_EXECUTE` untuk scope model/API/tes yang tercatat di draft, setelah PM menyelesaikan review task dan lifecycle/assignment. Status draft saat ini tetap `ANALYSIS`; laporan ini tidak mengubah status atau memberi izin implementasi.
- **REP-001 penuh:** belum siap untuk keseluruhan laporan UI/print/PDF/logo. Dependency logo OPS belum selesai; snapshot logo arsip tidak ada di schema saat ini. PDFKit belum dipin atau diverifikasi kompatibilitasnya. Pisahkan dependency itu ke tahap output/OPS tanpa mengurangi scope task induk.
- **Unknown non-blocking untuk model:** perilaku ketika periode valid tidak memiliki anggota perlu ditetapkan untuk halaman/print (tampilkan keadaan kosong atau izinkan tabel tanpa baris). Model read-only dapat mengembalikan daftar kosong dan tetap dikerjakan.
- **Risiko utama:** query yang hanya memakai roster satu hari menghilangkan anggota yang keluar di tengah bulan; hitungan berbasis semua `attendance_records` akan menghitung riwayat, clear, atau status libur yang dikecualikan; beberapa query tanpa snapshot konsisten dapat mencampur versi data.
- **Next owner: PM** untuk review laporan preflight, menetapkan REP-001A sebagai task siap dan mengatur assignment sesuai delegasi lokal yang sudah tercatat; selanjutnya menyusun urutan UI/print, PDFKit, dan dependency OPS. PM tetap memvalidasi hasil secara terpisah.

## Produksi dan pemeriksaan

Perubahan source: **tidak ada**. Test/build: **tidak dijalankan** (preflight-only).
Data/credential/`.data`: **tidak dibaca**. Cloud/remote: **tidak diakses**.
Commit/push/deploy: **tidak dilakukan**.
Production Actions: **NONE**.
