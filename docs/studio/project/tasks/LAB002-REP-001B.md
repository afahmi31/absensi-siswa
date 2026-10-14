# LAB002-REP-001B — Pratinjau dan cetak laporan

Tanggal: 15 Oktober 2026. Status: ANALYSIS. Owner PM; belum assignment.

## Tujuan dan dependency

Guru memilih semester, bulan atau kumpulan bulan semester, serta ukuran kertas, lalu melihat dan mencetak laporan. Acuan PRD R11–R14 dan desain UI-002 layar 15–19. Dependency wajib: REP-001A diterima PM; kontrak model dan respons API final; solusi logo privat/snapshot arsip dirinci sebelum klaim output lengkap. Task ini tidak menghapus kebutuhan unduh PDF nyata, yang disiapkan terpisah di REP-001C.

## Batas dan kriteria yang perlu dikunci sebelum READY

- Halaman mengikuti navigasi, proteksi sesi, kontrol dan arah desain existing. Pilihan semester/periode/kertas terlihat; mode semester menghasilkan tabel bulanan berurutan. Gunakan model REP-001A yang sama; jangan menghitung ulang total di UI dengan aturan berbeda.
- Pilihan dipertahankan saat gagal; loading/empty/error terlihat dan akses data terlindungi. Periode tanpa siswa menampilkan keadaan kosong; rincian tombol cetak pada keadaan itu ditetapkan PM sebelum READY, tanpa membuat siswa dummy.
- Preview HP mendukung tabel lebar dengan gulir mendatar di area tabel, bukan membuat seluruh layar melebar. Kontrol pilihan dan cetak tetap dapat digunakan. Laptop menampilkan pratinjau sesuai desain.
- Cetak hanya dipicu tindakan guru, menggunakan dialog browser. UI tidak mengklaim kertas sudah tercetak setelah window.print. Browser Save as PDF tidak dianggap implementasi Unduh PDF.
- Ketiga ukuran landscape: A4, F4 21,6×33 cm, Letter. Semua 31 kolom dan S/I/A terlihat; header berulang, baris siswa utuh, nama panjang membungkus tanpa menimpa kolom lain. Tiap bulan dimulai pada halaman baru; bulan panjang boleh berlanjut ke halaman berikutnya.
- Sel kosong tetap kosong tanpa label tambahan, watermark development atau tanda tangan. Metadata dan logo mengikuti periode/snapshot yang ditetapkan, bukan identitas arsip yang ditimpa pengaturan aktif.
- Fixture sintetis mencakup beberapa halaman, nama panjang, NIPD/JK kosong, semester parsial, serta pembandingan isi preview dengan model. PM memeriksa browser HP/laptop lokal; cetak fisik memerlukan bukti Ardy/guru dan tidak diasumsikan dari screenshot.

## Verifikasi dan batas lingkungan

Typecheck/build, regresi API/absensi yang relevan, bukti preview dan output browser lokal pada fixture sintetis. Tidak mengubah input absensi, akun, schema, data atau konfigurasi cloud. Tidak push main/deploy. Sebelum assignment, PM merinci ownership file dan AC final berdasarkan hasil REP-001A dan kesiapan logo; draft ini belum memberi izin implementasi.
