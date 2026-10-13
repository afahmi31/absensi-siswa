# Persiapan pilot Supabase dan Vercel

13 Oktober 2026. Rencana operasional; belum bukti deployment atau transfer cloud. Target database hanya absensi-siswa/jkiewjlohgmsujcwerpi, Singapore, paket gratis. Target Vercel yang disiapkan adalah project baru absensi-siswa pada team afahmi/team_H6SK8CqNqKS3KArd4BLOGIxC; versi dan lingkungan release ditunjukkan setelah pemeriksaan kode dan commit siap.

## Koneksi dan role

Session pooler port5432, maksimal satu koneksi per instance, Postgres.js existing, tanpa prepared statements. CA dan hostname diverifikasi. Owner credential disimpan privat hanya untuk bootstrap; runtime memakai lab002_app, migrasi memakai lab002_migrator. Password kuat dan secret sesi/HMAC cloud dibuat terpisah dari lokal dan tidak masuk Git/chat/log.

Bootstrap menyiapkan dua role LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS, tanpa keanggotaan admin bagi runtime. Owner mencabut schema public USAGE dari PUBLIC dan role API; memberi migrator USAGE/CREATE pada public WITH GRANT OPTION serta CREATE pada database untuk membuat schema private; app hanya USAGE. Tidak mengganti pemilik schema public atau mengubah default privileges milik Supabase. Jalankan migration0001–0006 sebagai migrator; jangan sebagai postgres. Pemeriksaan CLI check/up memakai project-ref eksplisit dan CA; up memerlukan confirm-up. Verifikasi actual grants/RLS/view, lalu advisors setelah perubahan.

## Data dan pemulihan

Gunakan alat CLOUD-DATA-001 yang sudah diperiksa, snapshot database lokal terbaru dan target kosong. Backup konsisten privat dan rehearsal restore mendahului transfer nyata. Pertahankan UUID/relasi/hash akun/audit; abaikan sesi perangkat, ledger lama dan counter throttle. Impor dilakukan satu transaksi dengan FK aktif, USER triggers dipulihkan sebelum commit, dan pembandingan penuh secara privat. Jika gagal, rollback dan jangan membuka aplikasi online. Jangan mencetak rincian error yang berisi nilai siswa.

Bandingkan seluruh tabel yang dipindahkan, status absensi, audit, constraint, trigger dan sequence. Hitungan terakhir yang dikenal bukan pengganti pembandingan snapshot terbaru. Database lokal dan backup tetap tersedia. Hindari penulisan paralel lokal dan online setelah cutover; guru menggunakan sumber online setelah data/URL diterima. Tetapkan waktu cutover ketika data target dan URL siap, bukan selama alat masih dikerjakan.

## Vercel

Repo aplikasi sudah berada di afahmi31/absensi-siswa, root aplikasi adalah root repo Git. Runtime Node24; npm10.9.3 mengikuti packageManager melalui konfigurasi Corepack yang diperiksa pada log install. Env koneksi app-role, mode Supabase, CA, secret session dan HMAC hanya server-side; owner/migrator URI tidak menjadi env runtime. Jangan memasukkan dump, data asli, env/log lokal atau fixture ke paket server.

Setelah commit konkret diperiksa, tampilkan target project/team, preview atau production, versi/hash dan langkah rollback untuk keputusan deployment Ardy. Preview protection diperiksa sebelum handoff guru; tidak menonaktifkan perlindungan atau membagikan bypass secara diam-diam. Smoke sesudah deployment memeriksa login, pembacaan kelas/roster, sesi/logout, header IP platform dan perlindungan API. Pengujian perubahan data sintetis harus terisolasi atau rollback, tanpa absensi/audit palsu permanen pada kelas guru. UAT HP/laptop guru tetap bukti terpisah.

## Titik pemeriksaan

PRE-001 lokal: lulus pemeriksaan teknis; cloudPG17 belum. CLOUD-DATA-001: alat sedang dikerjakan lokal. Bootstrap/migrasi/restore cloud: belum dijalankan. Vercel project/deployment: belum dibuat. Next owner Executor untuk alat; PM untuk review dan handoff tindakan operasional sesuai otorisasi.
