# Rancangan login dan absensi harian

Task: LAB002-UI-001. Tanggal: 2026-10-11. Executor: /root/lab002_ui001.
Tahap: design-only. Satu arah visual untuk review PM dan Ardy. Belum menjadi aplikasi, bukti runtime, atau desain yang disetujui.

## Buka visual

PNG merupakan hasil render langsung dari SVG dengan nama sama. Ukuran berupa piksel kanvas, bukan hasil uji perangkat. Layar absensi HP adalah halaman panjang; di HP pendek daftar perlu digulir.

| Visual | Kanvas | Isi |
|---|---|---|
| [01-login-hp.png](<01-login-hp.png>) | 390 × 844 | Email, Kata sandi, Masuk |
| [02-login-laptop.png](<02-login-laptop.png>) | 1440 × 960 | Form yang sama, panel ilustrasi sederhana |
| [03-absensi-hp-awal.png](<03-absensi-hp-awal.png>) | 390 × 1080 | Semua siswa belum diisi |
| [04-absensi-laptop-awal.png](<04-absensi-laptop-awal.png>) | 1440 × 960 | Tabel, status lengkap pada tombol |
| [05-absensi-hp-perubahan.png](<05-absensi-hp-perubahan.png>) | 390 × 1080 | H/S/I/A dipilih, belum disimpan |
| [06-absensi-hp-menyimpan.png](<06-absensi-hp-menyimpan.png>) | 390 × 1080 | Menunggu hasil simpan |
| [07-absensi-hp-tersimpan.png](<07-absensi-hp-tersimpan.png>) | 390 × 1080 | Simpan sukses, lengkap |
| [08-absensi-hp-sebagian.png](<08-absensi-hp-sebagian.png>) | 390 × 1080 | Simpan sukses, dua siswa tetap belum diisi |
| [09-absensi-hp-gagal.png](<09-absensi-hp-gagal.png>) | 390 × 1080 | Simpan gagal, tanpa klaim sukses |

## Acuan dan asumsi

Acuan kebutuhan: [task](<../../tasks/LAB002-UI-001.md>), [assignment](<../../tasks/LAB002-UI-001-assignment.md>), [PRD R01/R04/R05](<../../../product/PROD-002-product-prd-v1.md>), [rencana](<../../development-plan-v1.md>) dan [konfirmasi C04/C06](<../../decisions-and-confirmations.md>). Aturan desain/copy: AGENTS studio, seluruh protokol PM–Executor, workflow/keputusan, working-guide, user-facing-copy dan skill studio-ui-design yang dibaca pada preflight. Daftar lengkap di laporan.

Tidak ada referensi layar, Figma atau brand final yang diberikan. PDF cetak tidak dibuka/disalin karena scope task hanya login/input. Tata letak, warna, ikon buku, dan ukuran di sini adalah proposal Executor, bukan kebutuhan baru atau identitas sekolah resmi.

Semua contoh dibuat khusus: Alya Pramesti, Bima Saputra, Citra Nirmala, Damar Wicaksana, kelas 5A, semester ganjil 2026/2027, email guru@example.test. Empat siswa hanya contoh, bukan batas kelas. Tanggal 12 Oktober 2026 dipakai sebagai contoh hari sekolah; tanggal tersebut Senin menurut Python datetime. Tidak ada kalender sekolah nyata yang diperiksa.

## Arah visual yang diajukan

| Bagian | Usulan | Alasan / batas |
|---|---|---|
| Warna | Hijau #126451, latar #F4F7F6, teks #172D29 | Aksi utama mudah dikenali; belum dipilih Ardy sebagai brand |
| Huruf | Arial lokal; isi 14–17 px, judul 28–44 px | Tidak memuat font eksternal; label status kecil HP 13 px perlu dinilai guru |
| Daftar HP | Kartu siswa, tombol H/S/I/A 74 × 40 px, jarak 8 px | Memisahkan nama dan pilihan; tinggi 40 px masih perlu review kenyamanan sentuh |
| Daftar laptop | Tabel, tombol 104 × 44 px dengan arti status | Lebih banyak ruang untuk nama dan pilihan |
| Feedback | Notice dekat daftar; pesan berbeda untuk belum tersimpan, menyimpan, sukses, gagal | Warna selalu disertai teks; tidak dianggap data sudah tersimpan dari warna tombol |
| Simpan | Tombol terpisah setelah daftar; redup bila belum ada perubahan/menyimpan | Proposal tampilan tombol, bukan aturan persistence baru |
| Login laptop | Panel kiri ilustrasi daftar sederhana | Ilustrasi statis; tidak memakai data siswa atau logo sekolah |

Ardy menilai arah warna, kepadatan kartu/tabel, ukuran sentuh, dan penempatan Simpan sebelum implementasi. Nama produk/brand final tetap terbuka. Tidak ada keputusan stack, paket, layanan atau biaya dari rancangan ini.

## Interaksi yang dirancang

1. Login berisi Email, Kata sandi dan Masuk. Tidak ada pendaftaran, reset kata sandi atau jalur akun tambahan. Contoh isian bukan kredensial yang bekerja.
2. Pemilih tanggal sederhana membuka satu hari sekolah yang valid. Gambar hanya menunjukkan keadaan tertutup; batas tanggal/libur/periode dan pengaturan kalender tetap di luar task.
3. Tanggal baru tanpa catatan: semua siswa belum diisi. Tombol membuka layar tidak mengisi Hadir atau menyimpan data.
4. “Tandai semua hadir” mengubah pilihan pada daftar menjadi H; guru mengubah pengecualian S/I/A sebelum “Simpan”. Tindakan memilih hanya mengubah rancangan input, belum menyatakan sukses simpan. Tidak ada autosave.
5. Pilihan per siswa ditandai dengan border, latar, huruf tebal dan label status. Count H/S/I/A dan “belum diisi” merangkum pilihan yang terlihat; pada state belum tersimpan/gagal count ini bukan jumlah catatan yang sudah tersimpan.
6. Guru boleh menekan “Simpan” ketika hanya sebagian siswa diisi. Pada contoh sukses sebagian, H=1/S=1/I=0/A=0 dan dua siswa belum diisi. Kosong tidak berubah menjadi Alpa. Melanjutkan nanti merupakan kebutuhan PRD; gambar tidak membuktikan pembukaan kembali/dua perangkat.
7. Selama menyimpan, tombol bertuliskan “Menyimpan…” dan tidak tampil aktif. Proposal visual menahan aksi batch; status pilihan tetap terlihat. Kendali input saat request berjalan dirinci pada implementasi sesudah kontrak disetujui.
8. Hasil sukses memakai “Absensi berhasil disimpan.” Hasil gagal memakai “Absensi belum berhasil disimpan. Coba lagi.” dan tombol “Simpan”. Tidak ada retry otomatis atau klaim penyebab jaringan. Tampilan pilihan pada contoh gagal hanya konteks visual; pemulihan/retensi input setelah gagal, navigasi dan konflik dua perangkat tetap C06 OPEN, belum diputuskan desain ini.

## Copy dan keyboard/focus untuk implementasi setelah approval

| Keadaan | Copy/pola yang diusulkan | Batas |
|---|---|---|
| Email kosong | Masukkan alamat email. | Di bawah field terkait |
| Kata sandi kosong | Masukkan kata sandi. | Di bawah field terkait |
| Kredensial ditolak | Email atau kata sandi belum cocok. | Tidak mengungkap apakah akun ada; bukan reset flow |
| Login diproses | Sedang masuk… | Mengganti label Masuk selama request, bukan sukses sebelum hasil |
| Absensi awal | Belum ada absensi yang diisi. Pilih status siswa, lalu tekan Simpan. | Default belum diisi |
| Pilihan berubah | Ada perubahan yang belum disimpan. Periksa pilihan, lalu tekan Simpan. | Tidak disamakan dengan tersimpan |
| Simpan diproses | Sedang menyimpan absensi… Tunggu hasil penyimpanan. | Tidak menjanjikan waktu |
| Simpan lengkap sukses | Absensi berhasil disimpan. Semua siswa sudah diisi. | Hanya setelah hasil sukses |
| Simpan sebagian sukses | Absensi berhasil disimpan. 2 siswa belum diisi. Lanjutkan nanti. | Jumlah mengikuti data, bukan teks tetap |
| Simpan gagal | Absensi belum berhasil disimpan. Coba lagi. | Tombol Simpan, tanpa sebab/retensi/retry otomatis yang dijanjikan |

Login state tambahan di tabel adalah catatan copy dari rencana, belum punya visual terpisah. Implementasi tetap perlu kontrak auth/C04.

Proposal akses keyboard: urutan fokus sesuai urutan visual; Email → Kata sandi → Masuk; Tanggal → Tandai semua hadir → kelompok pilihan setiap siswa → Simpan. Kelompok H/S/I/A memberi nama siswa serta arti status untuk pembaca layar; pilihan ditandai sebagai terpilih. Panah berpindah pilihan dalam kelompok dan Space memilih. Focus menggunakan outline hijau 2 px dengan jarak 2 px, tidak hanya perubahan warna. Notice hasil simpan diumumkan tanpa memindahkan fokus paksa. Ini spesifikasi desain untuk review, belum terbukti pada DOM/pembaca layar/keyboard.

## Batas pemeriksaan dan reproduksi

Sembilan SVG valid secara XML; PNG final dirender langsung dari SVG memakai Sharp lokal. Semua sembilan PNG final dibuka dengan view_image dan diperiksa untuk teks, posisi, count/state dan overlap. Hasil pada kanvas contoh tidak membuktikan responsive browser, nama panjang, kelas besar, focus, scroll/sticky, atau penggunaan guru pada perangkat fisik. Tidak ada klaim WCAG/performa/auth/persistence/production PASS.

Data/ukuran file: [artifact-inventory.json](<artifact-inventory.json>). Alat produksi: [render_design.py](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/design/LAB002-UI-001/render_design.py>) menggambar SVG dengan ukuran teks dari Pillow, lalu [render_svgs.cjs](<D:/ayaa-wae-studio/Labs/LAB-002-website-absensi-siswa/design/LAB002-UI-001/render_svgs.cjs>) mengekspor PNG final langsung dari SVG. Jalankan berurutan memakai Python/Node bundled; path runtime di skrip Node khusus komputer ini. Tidak ada install/dependency proyek atau akses network. Keduanya alat artefak, bukan kode aplikasi.

Next owner: PM untuk validation aktual; Ardy untuk review arah desain setelah validation. Task tidak ditutup oleh Executor.
