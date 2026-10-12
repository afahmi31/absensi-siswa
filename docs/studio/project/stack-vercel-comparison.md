# Perbandingan stack untuk target Vercel

Tanggal: 2026-10-11. Pemilik: PM. Status: rekomendasi, belum keputusan penggantian stack.
Sumber request: Ardy menetapkan Vercel sebagai hosting, kemudian memilih “Bandingkan Nuxt/Vue dan Laravel di Vercel dahulu”. Tidak ada izin deploy, setup atau layanan berbayar.

## Fakta dan batas

Nuxt mempunyai jalur deployment full-stack yang didokumentasikan Vercel; halaman/API server dapat dijalankan sebagai Functions. PHP tersedia melalui runtime komunitas vercel-php dengan contoh Laravel. Dokumentasi Vercel terbaru juga menyediakan Container Runtime berstatus Beta: image OCI dapat membawa runtime aplikasi sendiri. Menjalankan Laravel melalui container adalah kemungkinan teknis yang diinferensikan dari kemampuan tersebut, belum diuji untuk LAB-002. Penjelasan awal tentang PHP komunitas bukan seluruh jalur yang tersedia.

Sumber primer diperiksa tanggal di atas:
- [Nuxt di Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt)
- [Runtime Vercel](https://vercel.com/docs/functions/runtimes)
- [PHP komunitas/contoh Laravel](https://github.com/vercel-community/php)
- [Container Runtime Beta](https://vercel.com/docs/functions/runtimes/container)
- [Autentikasi Laravel](https://laravel.com/framework/docs/12.x/authentication) — referensi fasilitas, bukan pemilihan versi 12.
- [Database/transaksi Laravel](https://laravel.com/framework/docs/12.x/database)
- [Storage Vercel](https://vercel.com/docs/storage)

## Penilaian PM untuk LAB-002

| Bagian | Nuxt/Vue | Laravel + Inertia/Vue |
|---|---|---|
| Aplikasi | Vue dan server routes dalam satu proyek; Inertia tidak diperlukan | PHP untuk backend, Vue melalui Inertia; satu aplikasi |
| Hosting Vercel | Jalur framework langsung terdokumentasi | Pilih/evaluasi PHP komunitas atau container Beta; kompatibilitas belum dibuktikan |
| Login | Pilih paket/provider auth dan kontrak akses; tidak mengimplementasikan kriptografi sendiri | Fasilitas auth/session bawaan tersedia; adaptasi sesi persisten dan provisioning tetap diperlukan |
| Data/semester/audit | Pilih lapisan database, migrasi, validation dan transaksi; aturan PRD tetap dibangun | Fondasi backend Laravel membantu; aturan PRD tetap dibangun dan diuji |
| Excel | Pilih dan uji parser JS/TS, validation dan preview | Pilih/uji paket PHP, extension/runtime dan preview |
| Cetak/PDF | Cetak browser dan unduh PDF tetap wajib; pendekatan PDF belum dipilih | Requirement sama; paket/render perlu sesuai lingkungan |
| Pemeliharaan | Dominan JS/TS; lebih sedikit adaptasi PHP ke Vercel menurut penilaian PM | PHP dan JS; jalur deploy tambahan perlu dipelihara |

Keduanya membutuhkan database persisten dan penyimpanan logo. Vercel Marketplace dapat menghubungkan penyedia database; Blob menyediakan penyimpanan objek. Provider, akses, region, biaya dan backup belum dipilih. Filesystem lokal Functions tidak digunakan sebagai penyimpanan data permanen.

Rekomendasi PM: Nuxt/Vue full-stack bila Vercel tetap target utama. Alasannya kesesuaian jalur hosting, bukan klaim framework lebih cepat/aman atau biaya lebih murah. Laravel tetap layak dievaluasi bila fondasi/keahlian PHP menjadi prioritas; lakukan pembuktian kompatibilitas sebelum mengunci jalur. Container Beta tidak dipilih otomatis.

Desain UI-001 sudah APPROVED/CLOSED dan dapat menjadi acuan kedua opsi. Tidak ada kode aplikasi yang perlu dimigrasikan saat ini. Versi, database/auth/paket Excel-PDF/storage/biaya dan keputusan C02–C08 tetap terbuka. Tidak ada benchmark, uji deploy, perhitungan biaya, atau klaim paket gratis cukup. Task SET-001 tetap ANALYSIS menunggu keputusan.

## Keputusan aktif setelah perbandingan

Keputusan aktif: Nuxt/Vue full-stack dalam satu aplikasi, hosting Vercel. Sumber: jawaban dialog Ardy “Ganti ke Nuxt/Vue full-stack (rekomendasi PM)”, 11 Oktober 2026. Menggantikan pilihan Laravel + Inertia/Vue sebelumnya karena target hosting. Versi/runtime, database, auth, storage, paket Excel/PDF dan biaya belum dipilih. Tidak memberi izin setup/assignment/deploy. Desain UI-001 APPROVED/CLOSED tetap acuan. Semua pernyataan evaluasi/pilihan sebelumnya di atas adalah riwayat. SET-001 tetap ANALYSIS.
