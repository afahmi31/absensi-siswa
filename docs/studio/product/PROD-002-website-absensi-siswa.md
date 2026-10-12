# Website Absensi Siswa

ID: PROD-002
Bentuk: website; model penggunaan belum dipilih
Kondisi terkini: Nuxt/Vue full-stack dengan hosting Vercel dipilih; desain UI-001 disetujui dan CLOSED; setup menunggu rincian.
Sumber ide: permintaan Ardy dalam chat ini, 11 Oktober 2026
Terakhir diperbarui: 2026-10-11

## Ide dan tujuan

Ardy ingin website yang membantu guru mencatat absensi harian siswa dan mencetak tabel absensi bulanan atau selama satu semester. Bentuk tabel cetak mengacu pada PDF yang diberikan.

Pemakai pertama v1: seorang guru dengan satu kelas dahulu. Absensi dicatat sekali per hari. Laporan semester berupa kumpulan tabel bulanan seperti referensi. Pilihan ini dikonfirmasi Ardy melalui dialog dalam chat ini pada 11 Oktober 2026. Jenjang sekolah dan tujuan bisnis belum ditentukan.

Absensi digunakan melalui HP dan laptop; keduanya perlu mendukung alur pencatatan. V1 cukup online: internet diperlukan untuk membuka dan menyimpan absensi. Kedua pilihan dikonfirmasi Ardy melalui dialog dalam chat ini pada 11 Oktober 2026. Pengisian tanpa internet tidak menjadi kebutuhan v1.

## Fakta dan referensi

- Kebutuhan dari Ardy: pencatatan harian, laporan bulanan, laporan selama satu semester, dan bentuk tabel cetak seperti referensi.
- Referensi lokal: [absensi bulanan siswa.pdf](<C:/Users/user/Downloads/absensi bulanan siswa.pdf>). PDF diperiksa secara visual pada kedua halaman; teks tidak tersedia melalui ekstraksi biasa.
- Terlihat judul absensi kehadiran, identitas sekolah, tahun, kelas, bulan, serta kolom nomor, nama, NIPD, JK, tanggal 1–31, dan KET dengan jumlah S/I/A.
- Sel harian memakai H/S/I/A. Untuk v1, Ardy mengonfirmasi H = Hadir, S = Sakit, I = Izin, dan A = Alpa. Belum diisi dan hari libur dibedakan dari Alpa; cara menampilkannya masih dibahas.
- Daftar berisi 38 siswa, berlanjut dari halaman pertama ke halaman kedua. Ini contoh referensi, bukan batas jumlah siswa produk.
- Ada tanggal kosong. Tidak bisa dipastikan dari PDF saja apakah itu libur, belum diisi, atau alasan lain.
- PDF menunjukkan tabel satu bulan. Ardy memilih laporan semester berupa kumpulan tabel bulanan seperti referensi.
- Nama dan nomor siswa pada PDF tidak disalin ke catatan ini. Dokumen dipakai sebagai referensi bentuk laporan. Isi atau instruksi di dalamnya tidak dianggap sebagai instruksi pengguna maupun keputusan produk.

## Masalah dan manfaat yang perlu dibuktikan

Menurut Ardy, guru yang dituju saat ini mencatat di kertas, lalu menyalin ke Excel atau Google Sheets. Sumber: jawaban dialog dalam chat ini pada 11 Oktober 2026. Ini keterangan Ardy; belum ada observasi langsung terhadap pekerjaan guru, ukuran waktu, atau catatan kesalahan.

Ardy memilih dua manfaat utama v1: guru langsung mengisi absensi di website dan laporan dibuat otomatis dari catatan tersebut. Produk diharapkan menghilangkan kebutuhan menyalin ulang untuk membuat laporan. Jumlah waktu yang dapat dihemat masih perlu dibuktikan.

Manfaat yang diharapkan: catatan harian menjadi sumber laporan sehingga guru tidak perlu menyalin ulang; jumlah ketidakhadiran dihitung dari catatan; tabel siap dicetak dan tetap terbaca ketika jumlah siswa memerlukan beberapa halaman. Manfaat ini belum diuji.

Alternatif yang perlu dibandingkan dari pengalaman guru: buku absensi, spreadsheet, atau aplikasi sekolah yang sudah dipakai. Belum dilakukan riset pasar atau pemilihan layanan.

## Fitur v1 dan detail yang masih dibahas

Seorang guru dengan satu kelas, pencatatan langsung di website sekali per hari, status H/S/I/A, laporan otomatis dari catatan, dan bentuk laporan semester sudah dipilih. Fitur tambahan serta detail berikut masih usulan kecuali disebut telah dikonfirmasi.

| Bagian | Usulan | Hal yang perlu diputuskan |
|---|---|---|
| Data kelas dan siswa | Impor Excel serta tambah/edit siswa satu per satu. Hanya nama wajib; NIPD dan jenis kelamin boleh kosong. Catat tanggal masuk/keluar siswa; hanya perlu diabsen selama terdaftar, dan riwayat absensi sebelumnya tetap disimpan, sesuai pilihan Ardy | Format Excel, nama sama/data ganda, pemeriksaan data impor, data kelas/tahun ajaran, dan tampilan masa di luar keanggotaan pada laporan |
| Absensi harian | Sekali per hari untuk satu kelas dengan status H/S/I/A, sesuai pilihan Ardy | Cara input dan penyimpanan |
| Input cepat | Tombol “Tandai semua hadir”, ubah pengecualian, lalu “Simpan”. Boleh simpan sebagian; website menampilkan jumlah siswa yang belum diisi. Status awal belum diisi; perubahan belum menjadi catatan tersimpan sebelum penyimpanan berhasil, sesuai pilihan Ardy | Penanganan input belum tersimpan dan kegagalan penyimpanan |
| Koreksi | Guru boleh mengoreksi selama semester belum ditutup, dengan riwayat perubahan. Setelah ditutup, catatan tetap bisa dilihat/dicetak tetapi tidak bisa dikoreksi, sesuai pilihan Ardy | Isi riwayat dan penanganan kesalahan yang baru ditemukan setelah penutupan |
| Kalender | Guru memilih hari sekolah rutin, lalu menambahkan tanggal libur atau hari sekolah khusus. Hari libur dan belum diisi dibedakan dari Alpa. Tanggal berabsensi boleh diubah menjadi libur setelah konfirmasi; absensi lama disimpan sebagai riwayat dan tidak dihitung, sesuai pilihan Ardy | Tampilan pada laporan dan perubahan balik dari libur menjadi hari sekolah; semester tertutup tetap tidak dapat dikoreksi |
| Laporan bulanan | Struktur dasar dan logo sekolah seperti referensi: identitas sekolah/kelas/periode, nomor, nama, NIPD, JK, tanggal 1–31, dan jumlah S/I/A; tanpa tambahan area tanda tangan untuk v1. Pilihan A4, F4/Folio 21,6 × 33 cm, atau Letter mendatar; cetak lewat browser dan unduh PDF. Absensi belum diisi boleh dicetak sebagai sel kosong tanpa penanda tambahan pada laporan, sesuai pilihan Ardy | Pengulangan header, tampilan libur, dan pemeriksaan hasil cetak |
| Laporan semester | Kumpulan tabel bulanan seperti referensi, dengan pilihan kertas dan keluaran yang sama seperti laporan bulanan. Guru mengisi tahun ajaran, semester ganjil/genap, tanggal mulai/selesai, dan menutup semester secara manual. Semester baru bisa memakai salinan daftar siswa sebelumnya atau daftar baru; absensi dan identitas arsip lama tetap, sesuai pilihan Ardy | Penanganan kesalahan yang baru ditemukan setelah penutupan |
| Akses dan penyimpanan | Satu akun guru dengan email dan kata sandi, disiapkan khusus tanpa pendaftaran umum. HP dan laptop mengakses data yang sama; perlu internet untuk membuka dan menyimpan absensi, sesuai pilihan Ardy | Pemulihan akses dan kebutuhan cadangan |

Usulan alur: siapkan daftar siswa untuk satu kelas → pilih tanggal → isi dan periksa absensi → simpan → pilih periode → periksa tampilan cetak → cetak.

Batas v1 disetujui Ardy: satu guru/satu kelas, input harian online, pengelolaan siswa/kalender/semester, dan laporan cetak/PDF. Multi-guru/sekolah, absensi per mata pelajaran, QR/GPS, portal orang tua, WhatsApp, nilai/rapor, pembayaran, serta sinkronisasi langsung Google Sheets ditunda. Pengenalan wajah tidak termasuk fitur yang dipilih.

Tidak ada stack, hosting, biaya, deadline, model bisnis, atau arsitektur yang dipilih.

## Ringkasan diskusi dan keputusan

| Tanggal | Pembahasan / keputusan | Oleh | Sumber | Status |
|---|---|---|---|---|
| 2026-10-11 | Membahas ide website absensi siswa untuk guru, pencatatan harian, dan cetak tabel bulanan/semester dengan referensi PDF | Ardy | Pesan pembuka diskusi produk dalam chat ini | Arah awal dari Ardy; detail belum disepakati |
| 2026-10-11 | Boleh mencatat ringkasan di koleksi produk bila ide cukup jelas; jangan masukkan ke registry Labs sebelum persetujuan mulai mengerjakan | Ardy | Pesan yang sama | Disetujui untuk diskusi/pencatatan; bukan izin development |
| 2026-10-11 | Fitur dan alur v1 di atas diajukan untuk pembahasan | Product Manager | Analisis kebutuhan awal dan pemeriksaan visual PDF | Usulan |
| 2026-10-11 | Pemakai pertama: seorang guru dahulu | Ardy | Jawaban dialog “Seorang guru dahulu” dalam chat ini | Disetujui sebagai arah v1 |
| 2026-10-11 | Absensi sekali per hari untuk setiap kelas | Ardy | Jawaban dialog “Sekali per hari untuk setiap kelas” dalam chat ini | Disetujui sebagai arah v1 |
| 2026-10-11 | Laporan semester berupa kumpulan tabel bulanan seperti referensi | Ardy | Jawaban dialog “Kumpulan tabel bulanan seperti referensi” dalam chat ini | Disetujui sebagai arah v1 |
| 2026-10-11 | Proses sekarang: mencatat di kertas lalu menyalin ke Excel atau Google Sheets | Ardy | Jawaban dialog tentang cara pencatatan saat ini | Keterangan Ardy; belum diamati langsung |
| 2026-10-11 | Fokus manfaat v1: langsung mengisi di website dan laporan otomatis | Ardy | Jawaban dialog “Keduanya: langsung mengisi di website dan laporan otomatis” | Disetujui sebagai arah v1; manfaat belum diuji |
| 2026-10-11 | HP dan laptop sama-sama dipakai untuk absensi | Ardy | Jawaban dialog tentang perangkat dalam chat ini | Disetujui sebagai kebutuhan v1 |
| 2026-10-11 | V1 cukup online; internet diperlukan untuk membuka dan menyimpan absensi | Ardy | Jawaban dialog tentang koneksi internet dalam chat ini | Disetujui sebagai batas v1 |
| 2026-10-11 | Satu kelas saja dahulu | Ardy | Jawaban dialog tentang cakupan kelas dalam chat ini | Disetujui sebagai batas v1 |
| 2026-10-11 | Cukup H/S/I/A; belum diisi dan hari libur dibedakan dari Alpa | Ardy | Jawaban dialog tentang status absensi dalam chat ini | Disetujui sebagai kebutuhan v1 |
| 2026-10-11 | Input harian: tombol “Tandai semua hadir”, ubah pengecualian, lalu “Simpan”; status awal belum diisi | Ardy | Jawaban dialog tentang cara input harian dalam chat ini | Disetujui sebagai alur v1 |
| 2026-10-11 | Impor Excel, serta bisa tambah/edit siswa satu per satu | Ardy | Jawaban dialog tentang penyiapan daftar siswa dalam chat ini | Disetujui sebagai kebutuhan v1 |
| 2026-10-11 | Pilih hari sekolah rutin, lalu tambahkan libur atau hari sekolah khusus | Ardy | Jawaban dialog tentang pengaturan kalender dalam chat ini | Disetujui sebagai alur v1 |
| 2026-10-11 | Boleh koreksi selama semester aktif, dengan riwayat perubahan | Ardy | Jawaban dialog tentang koreksi absensi dalam chat ini | Disetujui sebagai aturan v1 |
| 2026-10-11 | Guru mengatur tahun ajaran, semester ganjil/genap, tanggal mulai/selesai, dan menutup semester secara manual. Semester tertutup tetap bisa dilihat/dicetak tetapi tidak bisa dikoreksi | Ardy | Jawaban atas dialog pengaturan dan penutupan semester dalam chat ini | Disetujui sebagai aturan v1 |
| 2026-10-11 | Satu akun guru dengan email dan kata sandi; tanpa pendaftaran umum; data yang sama di HP dan laptop | Ardy | Jawaban atas dialog akses akun dalam chat ini | Disetujui sebagai kebutuhan v1 |
| 2026-10-11 | Mendukung pilihan A4, F4/Folio, dan Letter, semuanya mendatar | Ardy | Jawaban bebas “A4, F4/FOLIO atau Letter medatar” pada dialog ukuran kertas dalam chat ini | Disetujui sebagai kebutuhan v1; ukuran tepat F4/Folio belum dikonfirmasi |
| 2026-10-11 | Cetak lewat browser dan unduh PDF | Ardy | Jawaban dialog keluaran laporan dalam chat ini | Disetujui sebagai kebutuhan v1 |
| 2026-10-11 | Struktur dasar dan logo sekolah seperti referensi; tidak memilih tambahan area tanda tangan | Ardy | Jawaban dialog isi laporan dalam chat ini | Disetujui sebagai kebutuhan v1 |
| 2026-10-11 | Catat tanggal masuk/keluar; pertahankan riwayat absensi sebelumnya. Siswa hanya perlu diabsen selama terdaftar | Ardy | Jawaban atas dialog siswa masuk/pindah dalam chat ini | Disetujui sebagai aturan v1 |
| 2026-10-11 | Laporan belum lengkap boleh dicetak dengan sel kosong, tanpa penanda pada laporan; belum diisi tetap tidak dihitung sebagai Alpa | Ardy | Jawaban dialog tentang laporan belum lengkap dalam chat ini | Disetujui sebagai aturan v1 |
| 2026-10-11 | Semester boleh ditutup setelah konfirmasi bahwa data belum lengkap; aturan tidak bisa dikoreksi setelah ditutup tetap berlaku | Ardy | Jawaban dialog tentang penutupan semester belum lengkap dalam chat ini | Disetujui sebagai aturan v1 |
| 2026-10-11 | Setuju batas v1: satu guru/satu kelas, input harian online, pengelolaan siswa/kalender/semester, dan laporan cetak/PDF; fitur tambahan yang disebut dalam dialog ditunda | Ardy | Jawaban dialog “Setuju batas v1 ini; fitur tambahan ditunda” dalam chat ini | Batas produk disetujui; bukan persetujuan dokumen keseluruhan atau izin mulai proyek |
| 2026-10-11 | Hanya nama siswa wajib; NIPD dan jenis kelamin boleh kosong | Ardy | Jawaban dialog tentang data wajib siswa dalam chat ini | Disetujui sebagai aturan input/impor v1 |
| 2026-10-11 | Nama berulang saat impor diperiksa guru: tambah sebagai siswa berbeda atau lewati; tidak digabung atau menimpa catatan otomatis | Ardy | Jawaban dialog tentang nama berulang saat impor dalam chat ini | Disetujui sebagai aturan impor v1 |
| 2026-10-11 | Boleh simpan absensi sebagian; tampilkan jumlah siswa yang belum diisi di website | Ardy | Jawaban dialog penyimpanan absensi harian dalam chat ini | Disetujui sebagai alur v1; laporan tetap memakai sel kosong tanpa penanda |
| 2026-10-11 | Semester baru bisa memilih salin daftar siswa yang masih terdaftar atau buat daftar baru; absensi dan identitas arsip semester lama tetap dipertahankan | Ardy | Jawaban atas dialog pergantian semester dalam chat ini | Disetujui sebagai alur dan aturan arsip v1 |
| 2026-10-11 | Tanggal berabsensi boleh diubah menjadi libur setelah konfirmasi; absensi lama disimpan sebagai riwayat dan tidak dihitung | Ardy | Jawaban dialog perubahan kalender dalam chat ini | Disetujui sebagai aturan v1; berlaku sebelum semester ditutup sesuai aturan koreksi yang sudah dipilih |
| 2026-10-11 | Ukuran F4/Folio: 21,6 × 33 cm, mendatar | Ardy | Jawaban dialog ukuran tepat F4/Folio dalam chat ini | Disetujui sebagai ukuran cetak v1; melengkapi pilihan kertas sebelumnya |
| 2026-10-11 | Impor memakai template Excel dari website dengan kolom tetap; isi/salin data lalu periksa sebelum impor | Ardy | Jawaban atas dialog format impor Excel dalam chat ini | Disetujui sebagai alur impor v1 |
| 2026-10-11 | PRD v1 disetujui sebagai acuan arah produk; detail terbuka tetap dibahas sebelum implementasi | Ardy | Jawaban dialog “Setuju PRD sebagai acuan arah produk; detail terbuka tetap dibahas sebelum implementasi” dalam chat ini | Acuan arah produk disetujui; bukan izin mulai proyek atau membuat registry Labs |
| 2026-10-11 | Menyetujui mulai persiapan produk, pencatatan Labs dan handoff PM untuk rencana lengkap/dependency/task/konfirmasi; tampilkan task READY sebelum memilih platform/model/reasoning dan assignment | Ardy | Pesan terbaru dalam chat ini; kutipan pada [registry](<../project/README.md#persetujuan>) | Persiapan/Labs disetujui; menggantikan batas sebelumnya yang menunggu izin mulai. Belum memberi pilihan Executor atau izin coding per task |
| 2026-10-11 | Menugaskan peran Project Manager untuk menjalankan planning dari handoff LAB-002 | Ardy | Pesan “Gunakan peran Project Manager dan jalankan planning dari handoff LAB-002” | Planning dijalankan agent utama; rencana/backlog tersedia, bukan assignment Executor |
| 2026-10-11 | Belum memilih stack; meminta perbandingan terlebih dahulu | Ardy | Jawaban dialog stack dalam chat ini | [Perbandingan dan C01](<../project/decisions-and-confirmations.md#c01--stack-aplikasi>) tersedia; pilihan tetap terbuka |

| 2026-10-11 | Memilih Laravel + Inertia/Vue dalam satu aplikasi; belum assignment UI-001 karena ingin membaca task dahulu | Ardy | Dua jawaban dialog stack dan task READY dalam chat ini | Stack dipilih; versi/database/paket/hosting tetap terbuka. UI-001 READY tanpa dispatch |

Ardy menyertakan skill Template Creator. Skill tersebut dibaca; PDF tidak termasuk jenis referensi langsung yang didukung. Belum dibuat artifact-template skill. Kebutuhan template terpisah belum dipastikan; PDF tetap dipakai sebagai acuan produk.

## Pertanyaan terbuka

Detail yang belum dipilih mengikuti [PRD v1](<PROD-002-product-prd-v1.md#detail-yang-masih-terbuka>). Pertanyaan dan konfirmasi disampaikan melalui dialog pilihan sesuai permintaan Ardy dalam chat ini.

## Cara menilai hasil — usulan

- Guru dapat menyelesaikan pencatatan harian pada kelas contoh tanpa menyalin ulang untuk membuat laporan.
- Jumlah status pada laporan cocok dengan catatan harian; belum diisi dan hari libur tidak diam-diam menjadi alpa.
- Laporan bulanan tetap terbaca dan lengkap ketika daftar siswa berlanjut ke halaman berikutnya.
- Laporan semester mengikuti format yang dipilih Ardy dan periode yang benar.
- Koreksi catatan tercermin pada laporan sesuai aturan yang disepakati.

Belum ada target waktu input, pengujian, atau bukti manfaat dari guru.

## Hubungan dengan delivery

PRD: [v1](<PROD-002-product-prd-v1.md>), disetujui sebagai acuan arah produk. Registry: [LAB-002](<../project/README.md>). Planning dijalankan PM pada chat utama: [rencana](<../project/development-plan-v1.md>), [task](<../project/tasks.md>), [konfirmasi](<../project/decisions-and-confirmations.md>), [verification](<../project/verification-plan.md>). LAB002-UI-001 READY untuk design-only; belum ada Executor ASSIGNED. Codebase, implementasi, pengujian aplikasi, hasil desain disetujui, deployment, dan publikasi belum ada.

Acuan pencatatan: [aturan workspace](<../governance/instructions.md>), [Product Manager](<D:/ayaa-wae-studio/docs/product-manager.md>), [workflow studio](<../governance/studio-workflow.md>), [keputusan workflow](<../governance/workflow-decisions.md>), [copy pengguna](<../governance/user-facing-copy.md>), dan [template catatan produk](<D:/ayaa-wae-studio/products/product-note-template.md>). Permintaan Ardy serta referensi yang diamati menjadi sumber kebutuhan produk; usulan Product Manager belum menjadi keputusan Ardy.

## Langkah berikutnya

Ardy telah memilih Laravel + Inertia/Vue dalam satu aplikasi, dan memilih membaca task desain READY dahulu tanpa assignment. Pilihan Executor/platform/model/reasoning belum diberikan. PM merawat planning, menyampaikan keputusan terkait tahap/task, dan baru dispatch setelah pilihan diberikan. Product Manager tetap rujukan PRD. Izin persiapan/Labs/planning tidak perlu ditanyakan ulang.


## Keputusan teknis terbaru — 11 Oktober 2026

Keputusan aktif: Nuxt/Vue full-stack dalam satu aplikasi, hosting Vercel. Sumber: jawaban dialog Ardy “Ganti ke Nuxt/Vue full-stack (rekomendasi PM)”, 11 Oktober 2026. Menggantikan pilihan Laravel + Inertia/Vue sebelumnya karena target hosting. Versi/runtime, database, auth, storage, paket Excel/PDF dan biaya belum dipilih. Tidak memberi izin setup/assignment/deploy. Desain UI-001 APPROVED/CLOSED tetap acuan. Pernyataan stack/assignment sebelumnya merupakan riwayat dan digantikan oleh pembaruan ini.
