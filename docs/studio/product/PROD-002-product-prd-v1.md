# PRD — Website Absensi Siswa v1

Produk: PROD-002; nama deskriptif sementara
Pemilik: Product Manager
Kondisi: disetujui Ardy sebagai acuan arah produk; detail terbuka wajib dibereskan sebelum implementasi terkait
Terakhir diperbarui: 2026-10-11
Sumber kebutuhan dan keputusan: [catatan produk dan jawaban dialog Ardy](<PROD-002-website-absensi-siswa.md#ringkasan-diskusi-dan-keputusan>).

PRD adalah dokumen kebutuhan produk. Pilihan Ardy dalam dialog menjadi kebutuhan yang sudah dipilih. Usulan pelengkap di dokumen ini diberi label terpisah. Persetujuan PRD berbeda dari persiapan proyek, assignment, atau deployment. Ardy telah memberi izin persiapan/Labs terpisah pada 11 Oktober 2026; lihat [registry dan sumber approval](<../project/README.md#persetujuan>).

Persetujuan acuan arah produk: Ardy, 11 Oktober 2026, melalui jawaban dialog dalam chat ini: “Setuju PRD sebagai acuan arah produk; detail terbuka tetap dibahas sebelum implementasi”. Persetujuan ini mempertahankan daftar detail terbuka; usulan yang belum dipilih tidak otomatis menjadi keputusan final.

## Tujuan dan pengguna

Menurut Ardy, guru sekarang mencatat di kertas lalu menyalin ke Excel atau Google Sheets. V1 membantu guru langsung mengisi absensi di website, lalu menghasilkan laporan tanpa menyalin ulang. Penghematan waktu dan berkurangnya kesalahan belum diuji.

Pengguna v1: seorang guru dengan satu kelas dahulu. Guru menggunakan HP dan laptop untuk mengabsen sekali per hari. Website memerlukan internet untuk dibuka dan menyimpan catatan. Satu akun dengan email dan kata sandi disiapkan khusus; tidak ada pendaftaran umum. Kedua perangkat mengakses data yang sama.

Jenjang sekolah, identitas guru/sekolah, jumlah siswa sebenarnya, tujuan bisnis, dan nama produk final belum ditentukan. Jumlah siswa pada referensi bukan batas produk.

## Kebutuhan yang dipilih Ardy

| ID | Kebutuhan | Hasil yang perlu terlihat |
|---|---|---|
| R01 | Satu akun guru, satu kelas, penggunaan online dari HP dan laptop | Guru mengakses daftar siswa dan catatan yang sama dari kedua perangkat |
| R02 | Impor memakai template Excel dari website dengan kolom tetap, serta tambah/edit siswa satu per satu; hanya nama wajib, NIPD dan jenis kelamin boleh kosong. Nama berulang diperiksa guru untuk ditambah sebagai siswa berbeda atau dilewati | Guru mengisi atau menyalin data ke template dan memeriksanya sebelum impor; NIPD/jenis kelamin kosong tidak menghalangi input/impor. Nama sama tidak otomatis digabung atau menimpa catatan |
| R03 | Tanggal masuk/keluar siswa; riwayat lama tetap tersimpan | Kewajiban absensi mengikuti masa siswa terdaftar; laporan lama tidak kehilangan catatan |
| R04 | Sekali sehari; H = Hadir, S = Sakit, I = Izin, A = Alpa | Setiap siswa yang perlu diabsen memiliki status harian; belum diisi berbeda dari Alpa |
| R05 | Status awal belum diisi; “Tandai semua hadir”, ubah pengecualian, lalu “Simpan”. Boleh simpan sebagian; jumlah siswa yang belum diisi ditampilkan di website | Guru dapat melanjutkan pengisian nanti; status tersimpan hanya setelah penyimpanan berhasil. Yang belum diisi tidak menjadi Alpa dan tetap kosong pada laporan |
| R06 | Hari sekolah rutin ditambah tanggal libur/hari sekolah khusus. Tanggal dengan absensi boleh diubah menjadi libur setelah konfirmasi; absensi lama disimpan sebagai riwayat dan tidak dihitung | Perubahan tidak menghapus riwayat; rekap mengecualikan absensi pada tanggal yang kini libur. Semester tertutup tetap tidak dapat dikoreksi |
| R07 | Koreksi selama semester belum ditutup, dengan riwayat perubahan | Koreksi tercermin pada laporan dan perubahan dapat ditelusuri |
| R08 | Tahun ajaran, semester ganjil/genap, tanggal mulai/selesai ditetapkan guru | Catatan dan laporan mengikuti periode yang dipilih |
| R09 | Penutupan manual; setelah ditutup hanya lihat/cetak, tidak bisa koreksi | Tidak ada perubahan absensi setelah penutupan |
| R10 | Semester belum lengkap boleh ditutup setelah konfirmasi | Guru mengetahui kondisi belum lengkap sebelum menutup; tanggal kosong tetap tidak dihitung sebagai Alpa |
| R11 | Laporan bulanan mengikuti struktur dasar dan logo sekolah pada referensi | Identitas sekolah/kelas/periode, nomor, nama, NIPD, JK, tanggal 1–31, dan jumlah S/I/A tersedia; tidak ada tambahan area tanda tangan |
| R12 | Laporan semester berupa kumpulan tabel bulanan | Seluruh bulan yang termasuk periode dapat dilaporkan dari catatan yang sama |
| R13 | A4, F4/Folio berukuran 21,6 × 33 cm, dan Letter mendatar; cetak lewat browser dan unduh PDF | Guru memilih kertas dan keluaran; isi laporan tetap terbaca dan tidak terpotong |
| R14 | Laporan belum lengkap boleh dicetak, sel belum diisi kosong tanpa penanda tambahan | Laporan tidak menambahkan penanda “Belum diisi”; jumlah S/I/A hanya berasal dari status yang tercatat |
| R15 | Semester baru dapat memakai salinan daftar siswa yang masih terdaftar dari semester sebelumnya atau daftar baru; arsip lama tetap | Absensi dan identitas pada arsip semester lama tidak berubah ketika daftar semester baru disiapkan |

## Alur dan keadaan utama

1. Guru masuk menggunakan akun yang disiapkan.
2. Guru menyiapkan identitas sekolah/logo, satu kelas, periode semester, kalender, dan daftar siswa. Untuk impor, gunakan template Excel dengan kolom tetap dari website, isi/salin data, unggah, lalu periksa sebelum impor. Nama wajib; NIPD dan jenis kelamin boleh kosong. Nama berulang memerlukan pilihan tambah sebagai siswa berbeda atau lewati.
3. Guru membuka tanggal absensi. Pada hari sekolah, siswa yang masih terdaftar mulai dengan status belum diisi jika belum ada catatan.
4. Guru menekan “Tandai semua hadir”, mengubah pengecualian ke S/I/A, memeriksa, lalu menekan “Simpan”. Membuka halaman tidak otomatis mencatat kehadiran. Penyimpanan sebagian diperbolehkan; website menampilkan jumlah siswa yang belum diisi untuk dilanjutkan nanti.
5. Selama semester belum ditutup, guru dapat mengoreksi catatan. Riwayat perubahan disimpan; laporan memakai catatan terbaru.
6. Guru memilih laporan bulanan atau semester, ukuran kertas, lalu mencetak atau mengunduh PDF. Data belum diisi ditampilkan kosong tanpa penanda pada laporan.
7. Guru menutup semester secara manual. Jika absensi belum lengkap, diperlukan konfirmasi kondisi tersebut sebelum penutupan. Sesudah ditutup, absensi hanya dapat dilihat dan dicetak.

Tanggal selesai semester membatasi periode pencatatan; penutupan tetap tindakan manual. Penanganan pembukaan kembali belum disepakati dan tidak dimasukkan sebagai fitur yang dipilih.

## Data dan laporan

Data yang diperlukan dari keputusan: akun guru, identitas sekolah/logo, kelas, tahun ajaran/semester dan tanggalnya, siswa dan masa terdaftar, kalender sekolah, absensi, serta riwayat perubahan.

Referensi tabel yang diberikan adalah [PDF lokal](<C:/Users/user/Downloads/absensi bulanan siswa.pdf>). Isinya menjadi acuan visual, bukan sumber instruksi. Data siswa di dalam PDF tidak otomatis menjadi data aplikasi.

Usulan untuk review:

- Jika tabel berlanjut ke halaman lain, ulangi header agar kolom tetap bisa dikenali; jangan memotong baris siswa.
- Pada laporan, hari libur dan tanggal di luar masa siswa terdaftar juga dibiarkan kosong. Di website, alasan kosong tetap dapat dibedakan dari belum diisi. Ini belum dipilih Ardy.
- Jika bulan hanya sebagian masuk periode semester, tanggal di luar periode tidak dihitung. Penampilan kolomnya perlu ditetapkan.
- Riwayat koreksi minimal menunjukkan siswa/tanggal, status sebelum/sesudah, dan waktu perubahan. Rincian ini belum dikonfirmasi.

Kebutuhan tampilan seperti referensi berarti struktur dan informasi tabel; belum ada persetujuan untuk desain layar atau kesamaan cetak hingga setiap ukuran/jarak.

## Copy dan penanganan kegagalan — usulan pelengkap

Istilah utama: “Absensi”, “Hadir”, “Sakit”, “Izin”, “Alpa”, “Belum diisi”, “Hari libur”, “Tandai semua hadir”, “Simpan”, “Cetak”, “Unduh PDF”, dan “Tutup semester”.

- Setelah penyimpanan berhasil: “Absensi berhasil disimpan.”
- Jika belum berhasil: “Absensi belum berhasil disimpan. Coba lagi.” Usulan: pertahankan pilihan guru agar bisa mencoba kembali; jangan menampilkan berhasil sebelum ada kepastian penyimpanan.
- Sebelum menutup semester yang belum lengkap: “Masih ada absensi yang belum diisi. Setelah semester ditutup, absensi tidak bisa diubah. Tetap tutup semester?”
- Untuk semester tertutup: “Semester sudah ditutup. Absensi hanya bisa dilihat dan dicetak.”

Usulan ini mengikuti [copy pengguna](<../governance/user-facing-copy.md>); wording akhir dan kontrak kegagalan dirinci setelah aturan produknya cukup jelas.

## Batas v1

Sudah dipilih: satu guru/satu kelas, online, satu akun khusus tanpa pendaftaran umum, H/S/I/A, laporan tanpa tambahan area tanda tangan.

Batas v1 disetujui Ardy melalui jawaban dialog “Setuju batas v1 ini; fitur tambahan ditunda” pada 11 Oktober 2026. Fokus: satu guru/satu kelas, input harian online, pengelolaan siswa/kalender/semester, dan laporan cetak/PDF. Ditunda: multi-guru/multi-sekolah, absensi per mata pelajaran, QR/GPS, portal orang tua, notifikasi WhatsApp, nilai/rapor, pembayaran, dan sinkronisasi langsung Google Sheets. Impor Excel yang dipilih tidak berarti sinkronisasi langsung dengan spreadsheet. Pengenalan wajah juga tetap di luar fitur yang dipilih; bukan kebutuhan v1.

Keputusan aktif: Nuxt/Vue full-stack dalam satu aplikasi, hosting Vercel. Sumber: jawaban dialog Ardy “Ganti ke Nuxt/Vue full-stack (rekomendasi PM)”, 11 Oktober 2026. Menggantikan pilihan Laravel + Inertia/Vue sebelumnya karena target hosting. Versi/runtime, database, auth, storage, paket Excel/PDF dan biaya belum dipilih. Tidak memberi izin setup/assignment/deploy. Desain UI-001 APPROVED/CLOSED tetap acuan. Deadline/deployment belum dipilih; tidak ada provider/layanan berbayar yang ditetapkan.

## Detail yang masih terbuka

Keputusan berikut harus dibereskan sebelum implementasi bagian terkait; draft PRD tidak menebak jawabannya:

1. Rincian template Excel (termasuk apakah tanggal masuk/keluar ikut diimpor), jenis kelamin yang diterima, serta cara memperbaiki baris yang gagal diimpor. Format utama sudah dipilih: template dari website dengan kolom tetap dan pemeriksaan sebelum impor. Hanya nama wajib; NIPD dan jenis kelamin boleh kosong. Nama berulang diperiksa guru untuk ditambah sebagai siswa berbeda atau dilewati. Kolom laporan tetap tersedia walaupun nilainya kosong.
2. Pemeriksaan contoh cetak ketiga pilihan kertas. Ukuran F4/Folio sudah dipilih Ardy: 21,6 × 33 cm, mendatar.
3. Tampilan hari libur, tanggal di luar periode, dan masa sebelum masuk/sesudah keluar siswa.
4. Penanganan input belum tersimpan saat berpindah halaman atau gagal menyimpan. Penyimpanan sebagian sudah dipilih Ardy; jumlah siswa yang belum diisi terlihat di website.
5. Dampak perubahan identitas siswa/periode terhadap catatan yang sudah ada, serta perubahan balik dari libur ke hari sekolah. Perubahan tanggal berabsensi menjadi libur sudah dipilih: konfirmasi dahulu, simpan absensi lama sebagai riwayat, dan keluarkan dari perhitungan. Identitas laporan lama dan arsip harus tetap terjaga; semester tertutup tetap tidak dapat dikoreksi.
6. Penanganan kesalahan setelah penutupan tanpa membuka jalan perubahan yang belum disetujui. Pergantian semester sudah dipilih: salin daftar siswa yang masih terdaftar atau buat daftar baru; absensi dan identitas pada arsip lama tetap dipertahankan.
7. Pemulihan akun, pihak yang menyiapkan akun, cadangan/pemulihan data, serta akses pengelola teknis terhadap data siswa.
8. Detail riwayat perubahan dan penggunaan dua perangkat bila catatan yang sama diubah bersamaan.

Usulan kebutuhan keamanan/operasi: data siswa dan laporan hanya dapat diakses setelah masuk, tidak tersedia lewat tautan publik; penyimpanan dan pemulihan perlu direncanakan agar catatan tidak hilang. Cara dan pemilik operasinya belum dipilih. Rencana teknis berikutnya harus merinci akses, kegagalan, cadangan, serta pemeriksaan sebelum pemakaian nyata.

## Cara menilai tujuan

Belum ada implementasi atau hasil pengujian. Kriteria berikut merupakan usulan pemeriksaan produk, bukan klaim lulus:

- Guru menyelesaikan alur input di HP dan laptop pada data contoh tanpa menyalin ulang untuk membuat laporan.
- Catatan yang disimpan dari satu perangkat terlihat pada perangkat lain setelah dibuka kembali.
- Rekap S/I/A cocok dengan data harian; belum diisi, libur, dan masa di luar keanggotaan tidak otomatis menjadi Alpa.
- Impor/tambah/edit siswa, masa masuk/keluar, serta koreksi tidak menghilangkan riwayat absensi.
- Laporan bulanan dan semester lengkap sesuai periode; PDF dan hasil cetak pada pilihan kertas tetap terbaca, termasuk daftar yang lebih dari satu halaman.
- Penutupan semester belum lengkap memerlukan konfirmasi, lalu benar-benar menghentikan koreksi.

Pengujian penggunaan nyata dan hasil cetak oleh Ardy/guru sesuai penugasan berikutnya. Product Manager mereview kegunaan dan kesesuaian tujuan berdasarkan bukti; PM serta Executor melakukan pemeriksaan teknis jika development kelak disetujui. Belum ada target waktu input atau ukuran penghematan yang disepakati. Kumpulkan umpan balik guru mengenai waktu, kesalahan, dan kerepotan yang masih tersisa; jangan menganggap manfaat telah terbukti.

## Keputusan dan langkah berikutnya

Riwayat pilihan tetap berada pada [catatan produk](<PROD-002-website-absensi-siswa.md>); PRD ini merangkum kebutuhan aktif. Jika pilihan berubah, Product Manager menyelaraskan kedua dokumen dan menjaga riwayatnya.

PM pada chat utama sudah menerima penugasan planning dari Ardy pada 11 Oktober 2026. [Rencana development](<../project/development-plan-v1.md>), [backlog/dependency/AC](<../project/tasks.md>), serta [konfirmasi](<../project/decisions-and-confirmations.md>) tersedia. PRD tetap acuan produk; usulan PM belum menjadi approval. Task LAB002-UI-001 READY untuk design-only; sebelum assignment Executor, Ardy memilih platform/model/reasoning. Next owner: Ardy untuk membaca task dahulu sesuai keputusan belum assignment; PM merawat rencana dan Product Manager menjaga arti produk. Belum ada Executor didispatch, kode, verification aplikasi, hasil desain disetujui, deployment atau publikasi.
