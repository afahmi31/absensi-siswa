# Environment dan database lokal

DATA-001 memakai binary PostgreSQL 16 di `C:\Program Files\PostgreSQL\16\bin` untuk schema dan repository. Cluster task berada di `.data/postgres`, hanya mendengarkan `127.0.0.1:55432`, dan menerima password SCRAM-SHA-256. `.data/local-db.json` menyimpan URL role runtime dan migrator yang dibuat acak oleh `db:start`; file tersebut diabaikan Git. Folder `.data` membatasi akses ke akun Windows saat ini dan SYSTEM. Jangan salin isinya ke issue, report, screenshot, log, browser state, atau file yang dilacak.

| Variable | Tempat | Maksud/batas |
|---|---|---|
| `NUXT_DATABASE_URL` | `runtimeConfig.databaseUrl`, privat server | URL role runtime lokal. Dibuat pada `.data/local-env.ps1`; tidak memakai prefiks `NUXT_PUBLIC_`. Server database baru dibuat saat repository dipanggil. |
| `NUXT_SUPABASE_URL` | `runtimeConfig.supabaseUrl`, privat server | Placeholder kosong untuk project URL masa depan; belum digunakan aplikasi. |

Konfigurasi tidak memiliki `runtimeConfig.public` untuk database. Driver `postgres` dipakai server-only; tidak ada SDK Supabase, ORM, resource cloud, atau route HTTP bisnis pada DATA-001. Nuxt belum memanggil repository pada halaman yang ada.

`.env.example` aman disimpan dalam source. `.env`/variasinya berisi nilai lokal dan diabaikan Git; output/cache/log juga diabaikan. Jangan menaruh database URL, password, service-role key, data siswa atau PDF siswa di `public/`, state frontend, route publik, log atau dokumen.

Gunakan perintah lokal berikut setelah memakai Node 24.15+ dan npm 10.9.3:

```powershell
npm run db:start
npm run db:migrate
npm run db:status
npm run db:smoke
. .\.data\local-env.ps1
npm run dev
npm test
npm run db:stop
```

`db:migrate` menggunakan role migrator terpisah. `db:rollback` membutuhkan argumen eksplisit `--confirm-local-data-loss`. Tes membuat cluster sementara sendiri, tidak memakai `NUXT_DATABASE_URL`, dan menolak environment DB yang menunjuk ke luar target managed loopback. File `.data/local-env.ps1` tidak mencetak rahasia ketika di-dot-source.

`db:smoke` membuat satu schema berisi marker sintetis, menghentikan lalu menjalankan lagi cluster yang sama, memeriksa marker, dan menghapus schema sementara.

Auth/Storage/cloud belum dipilih. Jangan menganggap variable lokal ini sebagai kontrak auth atau deployment. Konfigurasi environment production tetap menunggu keputusan Ardy; setup ini tidak menulisnya.

Nuxt CLI dapat membaca `.env` ketika development/build, atau menerima variable dari proses PowerShell. Paket Node production tidak otomatis membaca `.env`; deployment kelak harus menyuntikkan environment privat sesuai keputusan Ardy. Tidak ada credential atau data siswa nyata di repository.
