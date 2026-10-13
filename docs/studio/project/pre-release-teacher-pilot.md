# Pra-rilis uji guru — LAB-002

Tanggal: 12 Oktober 2026. Target Ardy: guru mengisi absensi melalui URL online Vercel dari HP/laptop. Supabase baru paket gratis; uji langsung memakai data siswa kelas sebenarnya. Ini memperbarui prioritas delivery setelah checkpoint SEM, bukan menghapus requirement PRD v1 lengkap.

## Alur yang harus tersedia

Guru masuk dengan akun khusus, mengatur sekolah/kelas/semester/siswa, memilih hari sekolah, membuka tanggal, menandai hadir atau H/S/I/A, menyimpan sebagian/seluruhnya, membuka kembali dan melakukan koreksi. Tidak ada signup publik. Status kosong bukan Alpa, libur hanya baca, semester tertutup terkunci. Konflik lintas perangkat tidak menimpa data diam-diam. Semua data privat di server; tidak menyimpan credential pada browser/repo/log.

## Urutan dan batas task

1. LAB002-CAL-001: kalender rutin/pengecualian. Dependency DATA/AUTH/STUD/SEM/UI002 CLOSED. API dan UI lokal dapat dikerjakan tanpa akses cloud.
2. LAB002-ATT-001: input harian/parsial/koreksi/riwayat/conflict. READY setelah CAL diterima; pertahankan AC task yang sudah ada.
3. LAB002-PRE-001: kesiapan online. Review migrasi pada PostgreSQL Supabase, role runtime terpisah dengan hak minimum, schema tidak terbuka melalui Data API, TLS terverifikasi, koneksi serverless/pool, prepared-statements dan transaksi/audit/lock, env privat, login throttle lintas instance, provisioning/reset akun owner dengan target online eksplisit. Tidak menggunakan script local-only dengan bypass guard. Rinci AC/source sebelum READY; solusi teknis dipilih setelah preflight, belum menambah layanan berbayar.
4. LAB002-PRE-002: backup/restore minimum untuk data absensi nyata. Cadangan data on-demand, lokasi privat, latihan restore ke target terisolasi, panduan pemilik kapan mencadangkan dan cara pemulihan. Tidak mengasumsikan fitur backup paket gratis memenuhi kebutuhan tanpa verifikasi.
5. LAB002-QA-PRE-001: alur guru dan regresi login/STUD/SEM/CAL/ATT, tanggal/timezone, kegagalan/conflict, hak akses, no public data. Browser HP/laptop dan data contoh terisolasi untuk verifikasi teknis; guru memasukkan data sebenarnya setelah release gate lulus.
6. LAB002-REL-PRE-001: paket versi/commit yang diuji, panduan akun/setup siswa manual, pemulihan/rollback, target project/team Vercel dan Supabase, deploy serta smoke online setelah target/ref/akses ditetapkan. URL stabil dibagikan kepada Ardy; tidak menghubungi guru tanpa instruksi.

Ditunda dari pra-rilis: impor Excel, logo, laporan cetak/PDF, serta sisa OPS/QA/REL v1. Daftar siswa dimasukkan satu per satu melalui fitur STUD yang sudah ada. Keamanan/koreksi/audit/backup minimum tetap diperlukan karena data nyata. Tidak ada janji layanan production penuh atau fitur laporan sebelum selesai.

## Akses dan keputusan terbuka

Vercel connector get_git_deployment_context pada12Okt mengembalikan teams kosong. Ini tidak membuktikan Ardy tidak mempunyai akun; target/akses belum terverifikasi. Supabase project belum dibuat menurut Ardy; keputusan sekarang meminta menyiapkan kebutuhan project baru gratis, belum menunjukkan resource/ref/credential. Jangan meminta secret di chat.

Ardy memilih URL Vercel dan penggunaan data siswa nyata. Rencana dan implementasi independen dilanjutkan; resource/cloud writes/deploy harus memakai target dan versi konkret sesuai workflow studio, tanpa biaya/remote/push otomatis. Sebelum deploy, PM menunjukkan versi diuji dan target, lalu memperoleh otorisasi target/ref sesuai workflow. Akun/email guru dan daftar siswa diberikan melalui flow privat aplikasi, tidak dimasukkan dokumen/evidence/Git.

## Sumber dan evidence

Source aktual baseline ecee50e; Nuxt/Vercel telah dibuild, belum deploy. Auth throttle saat ini per-process dan README menyatakan belum kontrol online; migrasi/provisioning scripts local-only. Supabase PostgreSQL tetap provider yang dipilih, auth aplikasi existing bukan persetujuan migrasi ke Supabase Auth.

Rujukan primer: https://supabase.com/docs/guides/database/connecting-to-postgres dan https://supabase.com/docs/guides/platform/backups; periksa detail provider/plan saat preflight online. Runtime serverless diarahkan transaction pooler dengan kompatibilitas transaksi dan prepared statements diperiksa; migrasi/backup memakai koneksi sesi yang sesuai. Jangan melemahkan TLS atau mengganti arsitektur autentikasi sepihak.

Next owner: PM menjaga readiness/validasi; Executor gpt-6-luna/max mengerjakan task READY satu per satu. Target cepat berarti mendahulukan alur absensi dan menunda fitur laporan, bukan mengurangi AC data/simpan.

## Target Vercel dipilih

Ardy memilih project Vercel baru khusus LAB-002 di akunnya melalui dialog. Nama project/team/ref belum tersedia dan resource belum dibuat. Target persiapan disetujui; biaya/remote/push tidak termasuk. Versi konkret dan deployment tetap mengikuti release gate workflow.


## Target terbaru: uji lokal dahulu

Ardy meminta aplikasi siap diuji pada komputer lokal. Acuan aktif local-trial-priority.md. CAL lalu ATT dilanjutkan dengan Executor Luna/max; online Vercel/Supabase dan pembahasan Git ditunda sampai hasil uji Ardy. Tidak ada commit baru, remote/push/deploy/cloud. Setelah alur absensi lokal siap, PM menyerahkan URL/runtime/panduan uji dan menunggu hasil Ardy.
