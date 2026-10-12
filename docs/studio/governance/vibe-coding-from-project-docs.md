# Bekerja dari Dokumentasi Proyek

Panduan untuk PM, Executor, Discovery, dan Sync Docs ketika proyek memiliki banyak spesifikasi atau codebase-nya terpisah dari dokumentasi.

Gunakan bersama [workflow studio](<studio-workflow.md>), [copy pengguna](<user-facing-copy.md>), dan [Git/lingkungan](<git-and-environments.md>). Referensi `D:\xproject\oches\game-web-docs` dipakai sebagai pola pengaturan dokumen; aplikasi serta domain di dalamnya bukan proyek yang harus dibangun.

Dokumentasi sistem yang diberikan Ardy dapat dipelajari sebagai **contoh cara mengatur bahan untuk vibe coding**. Tujuannya mengambil pola dokumentasi yang bisa dipakai ulang pada berbagai aplikasi, bukan menjadikan aplikasi di dalam dokumentasi itu sebagai proyek build pertama atau menyalin aturan domainnya ke proyek lain.

## Intinya

Dokumentasi memberi arah dan batas kerja; codebase menunjukkan apa yang saat ini tertulis di implementasi; pengujian menunjukkan perilaku yang benar-benar diamati pada lingkungan tertentu. Catat ketiganya sebagai sumber berbeda.

## Sebelum membuat task atau mengubah kode

1. Pastikan root dokumentasi dan root codebase yang benar. Keduanya dapat berada di folder atau repository berbeda. Catat path, versi/commit atau tanggal yang tersedia, dan akses yang benar-benar diperiksa.
2. Baca aturan proyek yang berlaku di kedua lokasi sebelum pekerjaan yang menyentuhnya. Ikuti urutan baca yang ditetapkan dokumen indeks proyek.
3. Mulai dari peta sistem, invariants/aturan lintas modul, keputusan yang disetujui, status fitur, dan urutan dependency. Setelah itu buka dokumen teknis untuk bagian yang diminta saja.
4. Catat dokumen mana yang normatif, mana ringkasan/status, contoh, atau bahan vendor. Jangan menganggap setiap file di folder docs sebagai requirement aktif.
5. Petakan klaim penting dan sumbernya: file/bagian dokumen, lokasi kode/simbol, test, atau langkah runtime. Jangan menyebut kode sudah memenuhi spesifikasi tanpa memeriksanya.

Jangan membaca seluruh dokumentasi besar bila task hanya menyentuh satu area. Ikuti link dari index dan buka dokumen terkait dependency atau invariants seperlunya.

## Pola reusable dari dokumentasi acuan

Gunakan hal berikut sebagai pilihan pola, bukan daftar dokumen wajib untuk semua aplikasi:

- **Peta baca:** index menjelaskan jenis dokumen, lokasi modul, urutan baca, dependency, dan urutan implementasi.
- **Aturan lintas sistem:** prinsip yang menjadi batas semua modul berada di satu acuan yang mudah ditemukan dan ditautkan.
- **Pemisahan level:** overview menjelaskan konteks dan hubungan bagian; spesifikasi per modul menjelaskan tanggung jawab, data, interface/flow, dan perilaku gagal.
- **Jejak perubahan:** temuan review, keputusan, dan revisi mengarah ke bagian spesifikasi yang berubah; sumber lama ditandai historis atau digantikan.
- **Status dengan arti jelas:** status membedakan spec-only, built, tested, blocked, belum dikerjakan, dan live bila sumber proyek memakai kategori tersebut. Ikuti definisi proyek; jangan membuat status tandingan.
- **Cross-cutting sejak awal:** keamanan, infrastruktur, observability, compliance, accessibility, atau operasi masuk sesuai domain dan risikonya, bukan ditempelkan otomatis ke semua aplikasi.
- **Uji dan evidence:** spesifikasi menyebut acceptance dan jenis verification yang dibutuhkan; laporan status mengaitkan klaim implementasi dengan bukti.

Pilih kedalaman sesuai kebutuhan. Website sederhana mungkin cukup dengan tujuan, flow, desain, konten, dan acceptance. Aplikasi dengan akun memerlukan auth/data/API. SaaS, integrasi, atau sistem high-risk membutuhkan kontrak dan kontrol lintas layanan, operasi, pemulihan, serta gate eksternal yang sesuai. Jangan mewarisi arsitektur, stack, invariants, status, atau keputusan domain dari bahan contoh.

## Menilai apakah dokumentasi siap dipakai

Jangan gabungkan dua pertanyaan ini menjadi satu keputusan:

- **Cukup untuk merencanakan atau mengimplementasikan satu scope?** Periksa apakah requirement dan batasnya jelas, aturan/keputusan yang berlaku dapat ditemukan, kontrak dependency terkait tersedia, root codebase diketahui, dan AC serta verification dapat ditentukan.
- **Sistem siap dipakai atau diluncurkan?** Dokumentasi saja tidak cukup. Perlu evidence bahwa implementasi cocok dengan acuan, alur lintas FE/BE berjalan di lingkungan yang dituju, dan persyaratan operasional, keamanan, kepatuhan, pemulihan, serta keputusan owner benar-benar terpenuhi.

Untuk audit lintas sistem, petakan area yang berlaku: user flow/FE, API dan kontrak, layanan/domain/data BE, integrasi eksternal, keamanan dan akses, deployment/environment, test/acceptance, monitoring/backup/recovery, operasional, dan gate hukum/bisnis jika relevan. Jangan menambah domain yang tidak ada pada produk.

Gunakan temuan `TERDOKUMENTASI`, `GAP`, `KONFLIK`, atau `BELUM DIPERIKSA` dalam laporan biasa; ini label temuan, bukan status lifecycle task. Sertakan path/bagian dan versi/tanggal sumber untuk setiap temuan penting. Sebut keterbatasan ketika codebase, environment, runtime, atau konfirmasi pihak luar tidak diperiksa.

Discovery membuat peta evidence dan pertanyaan. PM memakai hasilnya untuk menentukan kesiapan task sesuai protokol dan meminta keputusan Ardy bila diperlukan. Executor tidak memulai pembangunan seluruh produk hanya karena dokumen menyebut sistemnya build-ready; ia menerima scope task yang sudah `READY`.

## Jika dokumen dan kode tidak cocok

Laporkan apa yang disebut setiap sumber, lokasi persisnya, dan dampaknya. Periksa apakah ada decision log, revisi, atau status implementasi yang menjelaskan perbedaan. Jangan memilih dokumen terbaru, kode, atau ringkasan sebagai pemenang hanya berdasarkan nama, tanggal, atau dugaan.

Jika perbedaan mengubah behavior, data, keamanan, biaya, architecture, atau scope, hentikan hanya bagian pekerjaan yang bergantung pada keputusan itu dan kembalikan pertanyaan kepada PM/Ardy. Pekerjaan dokumentasi atau investigasi lain yang tidak bergantung pada konflik boleh dilanjutkan. Setelah keputusan disetujui, gunakan Sync Docs sebelum implementasi yang terdampak dilanjutkan.

## PM — siapkan pekerjaan yang jelas

Untuk produk baru/scope besar, susun rencana menyeluruh dari PRD sampai goal versi tersebut dengan [template development](<D:/ayaa-wae-studio/docs/templates/development-plan-template.md>). Tentukan peta requirement, tahap/dependency, kontrak/flow/state/copy, kontrol keamanan/handling/monitoring yang relevan, task, serta metode dan pemilik bukti. Detail task berikutnya dapat dirinci bertahap; jangan mengganti planning produk dengan satu task lepas.

- Tautkan bagian spesifikasi dan keputusan yang menjadi sumber requirement.
- Tulis kondisi existing dan hasil yang diminta secara terpisah.
- Hubungkan tiap acceptance criteria dengan area/dokumen dan cara verifikasinya.
- Sebutkan dependency yang harus didahulukan, path codebase, batas perubahan, dan hal yang belum diketahui.
- Bila dokumen besar atau berkonflik, minta Discovery memetakan bagian yang relevan sebelum task dinyatakan READY.

Task READY disampaikan kepada Ardy untuk memilih Executor/platform/model/reasoning sebelum assignment. Revisi task yang sama dapat memakai pilihan disetujui. Uji browser E2E default Ardy; bila bukti wajib belum tersedia, task tetap PM_VALIDATION dengan handoff pengujian. PM melakukannya ketika diminta.

## Executor — implementasi terarah

- Baca ulang instruksi, task, aturan lintas modul, dependency, keputusan yang berlaku, dan pola di codebase.
- Buat plan hanya untuk mencapai scope PM; jangan membangun ulang sistem atau menjalankan semua roadmap karena dokumen menyebut urutan besar.
- Ubah codebase pada lokasi yang diizinkan. Jangan mengedit repository spesifikasi, meng-upgrade dependency, atau mengubah behavior di luar task tanpa kewenangan yang sesuai.
- Verifikasi AC dengan pemeriksaan terdekat yang tersedia: test unit/integrasi, lint/typecheck/build, atau pemeriksaan manual yang sesuai. Catat perintah, lingkungan, dan evidence aktual.
- Laporkan gap spesifikasi, sumber yang tidak cocok, dan follow-up; jangan menandai perilaku runtime PASS hanya dari code review.

## Discovery — peta konteks untuk orang berikutnya

Buat peta kecil untuk area request: dokumen acuan, dependency, aturan lintas modul, file/simbol codebase, tests, status implementasi yang tersedia, dan konflik/unknowns. Bedakan tujuan desain, requirement yang disetujui, kondisi di code, serta hal yang pernah diuji. Jangan menciptakan PRD besar bila catatan flow ringkas cukup.

## Sync Docs — setelah keputusan

Perbarui acuan proyek hanya setelah keputusan yang diperlukan disetujui dan sumber approval dicatat. Selaraskan dokumen aktif yang terdampak, tandai keputusan lama sebagai digantikan, dan pertahankan sejarah yang masih berguna. Jangan menyamakan perubahan kode dengan keputusan produk atau mengubah status task demi menyelaraskan teks.

Catatan progress faktual boleh diperbarui dari evidence tanpa mengubah ketentuan normatif. Pertahankan tautan PRD → rencana → task/evidence → hasil uji → review produk → brief branding. Nyatakan siapa memeriksa apa dan bagian yang masih menunggu keputusan atau bukti.

## Batas panduan

Ini adalah metode kerja umum untuk menggunakan dokumentasi build-ready pada proyek dengan dokumen dan codebase terpisah, sekaligus mengekstrak pola dokumentasi yang bisa dipakai ulang. Analisis contoh tidak dengan sendirinya memberi izin membangun aplikasi contoh tersebut. Detail domain, stack, keputusan, dan aturan dari proyek sumber tidak menjadi aturan Ayaa Wae Studio atau proyek lain. Setiap proyek tujuan tetap memakai instruksi dan source of truth miliknya sendiri.
