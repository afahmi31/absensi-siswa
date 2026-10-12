# Copy untuk Pengguna

Acuan untuk Product Manager, PM, Executor dan Brand & Content. Berlaku pada teks yang benar-benar dibaca pengguna: judul, label, tombol, petunjuk, loading, empty state, informasi, validasi, pesan berhasil/gagal, notice, alert dan notifikasi.

## Tulis sejak requirement dan development

Product Manager menetapkan pengguna, istilah produk dan cara penyampaian. PM memastikan requirement menjelaskan keadaan, pemicu pesan, isi yang perlu diketahui dan tindakan berikutnya. Executor menerapkan copy yang layak dibaca sejak hasil pertama. PM memeriksanya sebelum handoff; Product Manager menilai konsistensi dan kegunaan saat review produk.

Gunakan bahasa sehari-hari yang sesuai pembaca. Istilah teknis boleh dipakai jika pembaca membutuhkannya, dengan penjelasan ketika perlu. Produk untuk pengembang dapat memakai istilah domain yang familiar; aplikasi untuk pengguna umum tidak menjelaskan implementasi tanpa alasan.

Tampilkan informasi jika membantu memahami keadaan atau mengambil tindakan. Catatan task, nama komponen internal, placeholder development, debug, nama database/queue dan status implementasi ditempatkan pada dokumentasi atau log sesuai pembacanya. Jangan menambah banner/notice hanya untuk menjelaskan bagaimana aplikasi dibuat.

## Pesan mengikuti perilaku sebenarnya

- Jelaskan apa yang terjadi, objek yang terdampak dan tindakan yang bisa dilakukan, secukupnya.
- Jangan menyalahkan pengguna atau mengarang penyebab kegagalan yang belum diketahui.
- Jangan menjanjikan retry otomatis, pengiriman, penyimpanan atau pemulihan jika aplikasi tidak melakukannya.
- Hubungkan validasi dengan isian yang perlu diperbaiki. Pertahankan input ketika kontrak menyatakan demikian.
- Pesan akses/error mengikuti kebijakan keamanan; jangan membocorkan secret, stack trace atau detail sensitif.
- Label/tombol konsisten dengan istilah dan tindakan produk. Hindari jargon dan kalimat panjang.

| Keadaan | Contoh pesan pengguna | Catatan |
|---|---|---|
| Perubahan tersimpan | Perubahan berhasil disimpan. | Hanya setelah penyimpanan berhasil. |
| Isian wajib kosong | Masukkan alamat email. | Tampil pada field yang sesuai kontrak validasi. |
| Permintaan gagal, penyebab belum diketahui | Belum berhasil menyimpan perubahan. Coba lagi. | Jangan mengklaim masalah koneksi tanpa bukti. |
| Data belum ada | Belum ada situs yang ditambahkan. | Tampilkan tindakan menambah jika pengguna berwenang. |
| Situs terlalu lama merespons | Situs terlalu lama merespons. Coba periksa lagi. | Hanya untuk kondisi timeout yang benar-benar dikenali. |

Contoh ini tidak menetapkan flow baru. Copy spesifik mengikuti requirement produk dan keadaan aktual.

## Requirement dan pemeriksaan

Untuk interaksi terkait, dokumentasikan: keadaan/pemicu, pembaca, pesan atau pola pesan, tindakan tersedia, dan informasi internal yang masuk log. Sertakan normal, loading, kosong, berhasil, validasi, gagal dan akses ditolak hanya jika keadaan itu berlaku. Jangan menciptakan state fiktif agar tabel lengkap.

Pilihan wording kecil yang mengikuti istilah dan perilaku yang disetujui dapat diselesaikan Executor/PM. Arti bisnis, janji layanan atau behavior yang belum jelas kembali kepada Product Manager/Ardy. Jangan membuat setiap kalimat memerlukan approval terpisah.

Task UI belum memenuhi kriteria copy jika masih memakai placeholder, istilah internal yang tidak membantu, pesan yang tidak sesuai keadaan, atau tindakan yang tidak tersedia. Copy yang terbaca pada desain belum membuktikan hasil runtime; bukti pemeriksaan menyebut sumber dan lingkungan. Hasil pertama harus layak dibaca pengguna, sementara revisi berdasarkan feedback tetap dapat terjadi.
