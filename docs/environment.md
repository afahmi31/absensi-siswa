# Environment dan database lokal

DATA-001 memakai binary PostgreSQL 16 di `C:\Program Files\PostgreSQL\16\bin` untuk schema dan repository. Cluster task berada di `.data/postgres`, hanya mendengarkan `127.0.0.1:55432`, dan menerima password SCRAM-SHA-256. `.data/local-db.json` menyimpan URL role runtime dan migrator yang dibuat acak oleh `db:start`; file tersebut diabaikan Git. AUTH-001 menaruh kata sandi akun lokal pada `.data/teacher-account.json` dan kunci penyegel cookie pada `.data/auth-env.ps1`. Folder `.data` membatasi akses ke akun Windows saat ini dan SYSTEM. Jangan salin isinya ke issue, report, screenshot, log, browser state, atau file yang dilacak.

| Variable | Tempat | Maksud/batas |
|---|---|---|
| `NUXT_DATABASE_URL` | `runtimeConfig.databaseUrl`, privat server | URL role runtime lokal. Dibuat pada `.data/local-env.ps1`; tidak memakai prefiks `NUXT_PUBLIC_`. Server database baru dibuat saat repository dipanggil. |
| `NUXT_DATABASE_MODE` | `runtimeConfig.databaseMode`, privat server | `local` (default) hanya menerima host loopback. `supabase` memeriksa project ref, role runtime, Session pooler port 5432, dan CA sebelum membuka koneksi. Mode Supabase membatasi pool ke satu koneksi per instance. |
| `NUXT_DATABASE_CA` | `runtimeConfig.databaseCa`, privat server | Sertifikat CA PEM untuk koneksi Supabase. TLS selalu memeriksa sertifikat dan nama host. Jangan gunakan konfigurasi yang mematikan verifikasi. |
| `NUXT_LOGIN_THROTTLE_HMAC_KEY` | `runtimeConfig.loginThrottleHmacKey`, privat server | Kunci acak minimal 32 karakter untuk meng-HMAC alamat IP sebelum disimpan pada throttle online. Gunakan kunci rahasia yang berbeda dari kunci sesi. |
| `NUXT_SUPABASE_URL` | `runtimeConfig.supabaseUrl`, privat server | Placeholder kosong untuk project URL masa depan; belum digunakan aplikasi. |
| `NUXT_SESSION_PASSWORD` | `runtimeConfig.session.password`, privat server | Kunci acak lokal yang tersimpan pada `.data/auth-env.ps1`; dibutuhkan untuk membuka sealed session cookie. Jangan ganti saat sesi browser masih dipakai. Tidak ada nilai production yang disediakan. |

Konfigurasi tidak memiliki `runtimeConfig.public` untuk database atau kunci sesi. Driver `postgres` dipakai server-only; tidak ada SDK Supabase, ORM, resource cloud, atau route HTTP bisnis pada task ini. Login lokal menyimpan session ID acak di bagian secure dari sealed cookie dan mengecek record server-side serta versi akun pada setiap request privat. Logout mencabut satu sesi; reset akun menaikkan versi dan mencabut semua sesi yang tersimpan.

`.env.example` aman disimpan dalam source. `.env`/variasinya berisi nilai lokal dan diabaikan Git; output/cache/log juga diabaikan. Jangan menaruh database URL, password, service-role key, data siswa atau PDF siswa di `public/`, state frontend, route publik, log atau dokumen.

Gunakan perintah lokal berikut setelah memakai Node 24.15+ dan npm 10.9.3:

```powershell
npm run db:start
npm run db:migrate
npm run auth:account:provision -- guru@example.invalid
npm run db:status
npm run db:smoke
. .\.data\local-env.ps1
. .\.data\auth-env.ps1
npm run dev
npm test
npm run db:stop
```

Ganti alamat contoh tersebut dengan alamat lokal yang diinginkan. `auth:account:provision` hanya membuat akun pertama; `auth:account:reset` adalah tindakan terpisah yang mengubah kata sandi dan memutus semua sesi lama. Password dihasilkan otomatis dan tidak ditampilkan; baca hanya file privat lokal ketika perlu masuk. `db:migrate` menggunakan role migrator terpisah. `db:rollback` membutuhkan argumen eksplisit `--confirm-local-data-loss`. Tes membuat cluster sementara sendiri, tidak memakai `NUXT_DATABASE_URL`, dan menolak environment DB yang menunjuk ke luar target managed loopback. File `.data/local-env.ps1` dan `.data/auth-env.ps1` tidak mencetak rahasia ketika di-dot-source.

`db:smoke` membuat satu schema berisi marker sintetis, menghentikan lalu menjalankan lagi cluster yang sama, memeriksa marker, dan menghapus schema sementara.

Login tetap memakai akun dan sesi aplikasi yang ada, tanpa signup atau reset email. Mode lokal tetap memakai throttle per-process nonproduction. Mode Supabase memakai throttle database bersama untuk setiap instance; alamat IP hanya disimpan sebagai HMAC, dengan batas dan waktu blokir yang sama. Cookie lokal memakai plain HTTP hanya di host loopback; host lain saat production harus memakai HTTPS. Deployment harus mengisi URL role `lab002_app`, mode `supabase`, CA PEM dan kunci HMAC secara privat. Jangan memakai URL owner/migrator pada runtime aplikasi.

Nuxt CLI dapat membaca `.env` ketika development/build, atau menerima variable dari proses PowerShell. Paket Node production tidak otomatis membaca `.env`; deployment kelak harus menyuntikkan environment privat sesuai keputusan Ardy. Tidak ada credential atau data siswa nyata di repository.
