# Transfer data lokal ke Supabase

Panduan untuk alat transfer yang disiapkan di `scripts/cloud-data-transfer.mjs`. Hasil uji saat ini hanya berasal dari database PostgreSQL disposable berisi data sintetis. Source sekolah nyata belum dibaca oleh alat ini dan target Supabase belum diperiksa atau ditulis oleh alat ini. PM harus meninjau hasil serta mengotorisasi langkah operasional sebelum penggunaan cloud.

## Persyaratan dan penyimpanan

- Gunakan Node.js 24 dan PostgreSQL client tools 16 pada Windows. Alat memakai `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe`, `pg_restore.exe`, dan `psql.exe`.
- Jalankan dari direktori `app`.
- File snapshot, manifest, dan SQL sementara disimpan di `app/.data/cloud-transfer/`, yang diberi ACL Windows privat dan diabaikan Git. Jangan salin ke folder bersama atau tempel isi manifest/backup ke chat.
- Masukkan URI database dan path sertifikat melalui environment privat sesi lokal. Jangan taruh credential pada argumen perintah, shell history, log, atau dokumen.
- `LAB002_TRANSFER_SOURCE_DATABASE_URL` harus menunjuk ke database lokal terkelola: loopback `127.0.0.1:55432`, database `lab002_local`, role `lab002_migrator`, dengan `sslmode=disable`.
- Untuk pemeriksaan/transfer cloud, `SUPABASE_MIGRATION_DATABASE_URL` harus memakai role migrasi khusus project melalui Supabase Session Pooler. `SUPABASE_CA_CERT_PATH` menunjuk CA resmi yang telah diverifikasi. Koneksi cloud memeriksa sertifikat dan nama host; opsi URI tidak dapat mematikan verifikasi TLS.

## Tahapan alat

1. Siapkan snapshot privat dengan `node scripts/cloud-data-transfer.mjs prepare`. Alat hanya memilih sebelas tabel aplikasi yang diizinkan, memakai custom-format `pg_dump` data-only, dan memeriksa ulang bentuk schema serta ledger checksum migrasi setelah snapshot. Source harus cocok tepat dengan baseline lama 0001–0004 yang checksum-nya dipatok, atau ledger lengkap 0001–0006. Ledger parsial lain dan checksum berbeda ditolak. Manifest mencatat ledger source dan target secara terpisah; ledger source tidak disalin. Target tetap harus cocok dengan seluruh ledger terkini 0001–0006 beserta checksum persisnya. Output hanya menyebut jumlah total baris, ukuran arsip, dan nama manifest.
2. Setelah snapshot dan manifest ditinjau PM, jalankan pemeriksaan target read-only:

   ```text
   node scripts/cloud-data-transfer.mjs check --manifest=snapshot-<waktu>-<uuid>.json --project-ref=jkiewjlohgmsujcwerpi
   ```

   Ganti nilai manifest dengan hanya nama file yang dikeluarkan oleh `prepare`. Pemeriksaan memastikan project/Session Pooler dan role yang disetujui, PostgreSQL 17, ledger checksum dan schema yang cocok, tabel target kosong, trigger aktif, foreign key tervalidasi, RLS hidup, kepemilikan role migrasi, serta tidak ada akses object dari role API Supabase.
3. Langkah tulis memerlukan review operasional tersendiri. Hanya setelah otorisasi spesifik, perintah import berbentuk:

   ```text
   node scripts/cloud-data-transfer.mjs import --manifest=snapshot-<waktu>-<uuid>.json --project-ref=jkiewjlohgmsujcwerpi --confirm-import
   ```

   Flag `--confirm-import` adalah guard alat; flag itu sendiri bukan persetujuan PM atau Ardy. Alat mengulang pemeriksaan target sebelum menulis dan berhenti bila target tidak kosong atau metadata tidak cocok.

## Isi dan pemulihan

Snapshot hanya mencakup `teacher_accounts`, sekolah, kelas, semester, siswa, membership, aturan kalender, pengecualian kalender, kehadiran, snapshot arsip semester, dan audit. UUID, hash akun sintetis/nyata, relasi, identitas audit, isi audit, serta posisi sequence audit dipertahankan. `teacher_sessions`, `schema_migrations`, dan `private.login_throttle_attempts` sengaja tidak dipindahkan.

Restore memakai satu transaksi, mengunci tabel, menyalin ke tabel sementara, lalu memasukkan tabel sesuai urutan foreign key. Hanya USER trigger aplikasi yang dinonaktifkan sementara; trigger tersebut diaktifkan kembali sebelum commit. Foreign key tidak dinonaktifkan. Sequence audit diatur dengan `ALTER SEQUENCE ... RESTART`, dan perbandingan seluruh baris dua arah serta pemeriksaan FK/trigger dilakukan sebelum transaksi commit. Kegagalan membatalkan transaksi. SQL dari `pg_restore` ditulis ke file acak privat yang path-nya diverifikasi lalu dihapus; jangan mengganti alur ini dengan `pg_restore -f -` atau `--file=-` di Windows.

Jika koneksi terputus ketika hasil commit belum diketahui, jangan ulangi import. Hentikan operasi dan minta PM membandingkan source dan target secara privat serta memilih langkah pemulihan. Guard target tidak kosong memang akan menolak import ulang; jangan menghapus data untuk melewati guard tersebut.

## Rehearsal lokal

Rehearsal membuat cluster PostgreSQL 16 disposable dan memakai hanya data sintetis. Ia mempertahankan skenario ledger penuh 0001–0006 ke 0001–0006, lalu menguji source 0001–0004 terhadap target 0001–0006. Source baseline lama dibangun dari salinan sementara migration runner dan hanya empat pasang migration lama; file migration aplikasi tidak diubah.

```text
node scripts/test-cloud-data-transfer.mjs
```

Perintah ini membuat dan membersihkan cluster uji, menguji restore berhasil, rollback untuk baris kehadiran tidak valid, pemeriksaan isi/sequence/trigger/FK, penolakan target berisi data, pemuatan manifest dengan dua ledger terpisah, dan penolakan ledger sumber/target yang tidak cocok. Jangan arahkan URL sintetis atau perintah test ke database lokal guru atau Supabase.

Belum dilakukan di tahap ini: pembuatan snapshot dari source guru, pemeriksaan cloud nyata, import cloud, rehearsalnya pada PostgreSQL 17, perbandingan roster/audit PM, atau uji autentikasi pasca-transfer.
