# LAB002-REP-001B — Pratinjau dan cetak laporan

Tanggal: 15 Oktober 2026. Status: CLOSED untuk tahap UI/pratinjau/cetak browser lokal. PM menerima hasil melalui delegasi lokal Ardy setelah source/diff review dan uji browser/print independen; lihat reports/LAB002-REP-001B-pm-review.md. Assignment aktual /root/lab002_rep_preflight, Codex gpt-6-luna/max. Kelanjutan diotorisasi Ardy “oke lanjutkan”. Next owner PM untuk PDF nyata dan dependency logo/arsip. Task induk belum selesai dan belum ada deployment versi ini.

## Tujuan dan dependency

Guru memilih semester, bulan atau kumpulan bulan semester, serta ukuran kertas, lalu melihat dan mencetak laporan. Acuan PRD R11–R14 dan desain UI-002 layar 15–19. Dependency wajib: REP-001A diterima PM; kontrak model dan respons API final; solusi logo privat/snapshot arsip dirinci sebelum klaim output lengkap. Task ini tidak menghapus kebutuhan unduh PDF nyata, yang disiapkan terpisah di REP-001C.

## Scope dan acceptance criteria

- Halaman mengikuti navigasi, proteksi sesi, kontrol dan arah desain existing. Pilihan semester/periode/kertas terlihat; mode semester menghasilkan tabel bulanan berurutan. Gunakan model REP-001A yang sama; jangan menghitung ulang total di UI dengan aturan berbeda.
- Pilihan dipertahankan saat gagal; loading/empty/error terlihat dan akses data terlindungi. Periode tanpa siswa menampilkan keadaan kosong; rincian tombol cetak pada keadaan itu ditetapkan PM sebelum READY, tanpa membuat siswa dummy.
- Preview HP mendukung tabel lebar dengan gulir mendatar di area tabel, bukan membuat seluruh layar melebar. Kontrol pilihan dan cetak tetap dapat digunakan. Laptop menampilkan pratinjau sesuai desain.
- Cetak hanya dipicu tindakan guru, menggunakan dialog browser. UI tidak mengklaim kertas sudah tercetak setelah window.print. Browser Save as PDF tidak dianggap implementasi Unduh PDF.
- Ketiga ukuran landscape: A4, F4 21,6×33 cm, Letter. Semua 31 kolom dan S/I/A terlihat; header berulang, baris siswa utuh, nama panjang membungkus tanpa menimpa kolom lain. Tiap bulan dimulai pada halaman baru; bulan panjang boleh berlanjut ke halaman berikutnya.
- Sel kosong tetap kosong tanpa label tambahan, watermark development atau tanda tangan. Metadata dan logo mengikuti periode/snapshot yang ditetapkan, bukan identitas arsip yang ditimpa pengaturan aktif.
- Fixture sintetis mencakup beberapa halaman, nama panjang, NIPD/JK kosong, semester parsial, serta pembandingan isi preview dengan model. PM memeriksa browser HP/laptop lokal; cetak fisik memerlukan bukti Ardy/guru dan tidak diasumsikan dari screenshot.

## Rincian PM dalam delegasi lokal

Tahap ini membuktikan tabel/pratinjau/cetak tanpa logo; tidak membuat logo palsu, banner status development atau tombol PDF yang tidak bekerja. Logo privat, snapshot logo arsip dan unduh PDF sungguhan tetap pada tahap terpisah sebelum task induk lengkap. Endpoint/model REP-001A tidak perlu diubah kecuali ditemukan bug yang memblokir dan dilaporkan ke PM.

Halaman tersendiri /reports sesuai desain layar15–19; filter di halaman yang sama karena tindakan memilih laporan perlu melihat pratinjau. Tambahkan navigasi Laporan pada header dan kartu beranda. Perbarui copy beranda yang menyebut laporan belum tersedia sesuai hasil nyata, tanpa iklan fitur belum ada. Tidak mengubah handler logout/input absensi.

Default semester aktif jika ada, selain itu semester paling baru dari endpoint existing. Default mode bulanan, pilih bulan awal semester (deterministik dan valid). Pilihan semester mengatur ulang bulan ke awal semester itu; kertas tetap. Laporan dimuat setelah tombol “Tampilkan laporan”, termasuk perubahan filter berikutnya. Bila filter berubah, hasil lama harus jelas sebagai pratinjau pilihan sebelumnya atau disembunyikan; Cetak tidak boleh mencetak hasil lama seolah sesuai pilihan baru. Respons request yang terlambat tidak menimpa hasil pilihan terbaru. Simpan parameter query pada URL hanya jika mengikuti pola existing, bukan syarat task.

Tombol Cetak aktif hanya saat laporan yang sesuai pilihan terakhir berhasil dimuat, tidak sedang loading, dan setidaknya satu bulan memiliki siswa. Jika seluruh hasil tanpa siswa, tampilkan “Tidak ada siswa pada periode ini.” dan tombol cetak nonaktif. Pada mode semester dengan beberapa bulan tanpa siswa, bulan kosong tetap memiliki identitas/header tanpa baris siswa; bulan lain tetap dicetak. Tidak ada semester: tampilkan tindakan menuju Semester. Tidak ada data sekolah: arahkan menyiapkan sekolah melalui flow existing, jangan membuat data contoh otomatis.

Loading menonaktifkan pemicu request ganda dan Cetak. Gagal memuat mempertahankan pilihan serta menyediakan coba lagi, tanpa sukses palsu. Label mode “Bulanan”/“Semester”, ukuran kertas diberi dimensi dan orientasi mendatar. Fokus keyboard, label kontrol, header tabel dan status/error aksesibel. Tidak menambahkan modal atau editor baru. Cetak memakai data yang sudah dimuat, tanpa menulis data atau otomatis menyimpan draft.

CSS print menyembunyikan header/nav/filter/tombol aplikasi, menampilkan tabel penuh tanpa overflow clip/sticky; cetak hitam putih terbaca. Ukuran page portrait tidak boleh dipakai untuk hasil landscape. Tetapkan dimensi CSS @page sesuai kertas dipilih; browser dapat menimpa setting printer sehingga laporan evidence membedakan output browser dan kertas fisik. Header dan baris tidak dipotong. Jika nama sangat panjang membuat satu baris melebihi halaman, sampaikan batas bukti, jangan diam-diam crop.

## Ownership dan deliverable

Root kode app. Executor memiliki app/pages/reports.vue, komponen laporan baru bila perlu, CSS laporan baru/terarah, app/layouts/default.vue bagian navigasi/print-only, app/pages/index.vue bagian tautan/copy laporan, serta tooling fixture sintetis dan laporan reports/LAB002-REP-001B-report.md pada registry. Shared type murni boleh diekstrak tanpa membawa modul DB/server ke client bundle. Jangan mengubah kode auth/DB/report API, schema, pool atau paket tanpa melapor ke PM.

Siapkan fixture lokal terisolasi yang dapat dipakai PM untuk uji browser tanpa membaca/memodifikasi .data nyata atau data cloud: satu akun sintetis, semester aktif/arsip, minimal45 siswa termasuk nama panjang, NIPD/JK kosong, beberapa bulan dan status H/S/I/A. Sertakan cara start/stop yang aman dan cara PM mengakses akun fixture privat. Tidak menggunakan database persisten atau akun guru. Fixture/test harness boleh di scripts/tests; hanya buat yang diperlukan, jangan menambah library tes/runner/global install. Baca skill browser yang sesuai jika melakukan otomasi.

Executor: preflight singkat, implementasi scope ini, typecheck/build Node24/npm10.9.3, suite laporan regresi jika runtime/shared type terpengaruh, dan pemeriksaan browser/output cetak yang tersedia. PM: review diff, uji browser localhost laptop/HP, minimal satu keluaran browser PDF per ukuran sebagai bukti CSS/pagination; itu bukan implementasi endpoint Unduh PDF. Cetak fisik pending Ardy. Laporkan file, AC, evidence faktual dan batas. Jangan tutup task; next owner PM validation.

## Verifikasi dan batas lingkungan

Typecheck/build, regresi API/absensi yang relevan, bukti preview dan output browser lokal pada fixture sintetis. Tidak mengubah input absensi, akun, schema, data atau konfigurasi cloud. Tidak push main/deploy. Ownership dan AC tahap ini telah dirinci di atas; implementasi UI/cetak lokal diizinkan melalui assignment. Logo dan PDF terpisah tetap belum ditugaskan.
