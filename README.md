# Website Absensi Siswa — autentikasi lokal dan fondasi data

LAB-002 / PROD-002. DATA-001 menyiapkan PostgreSQL lokal, schema, invariant, dan repository server-only. AUTH-001 menambahkan satu akun guru lokal, sesi privat, layar masuk, dan halaman awal terlindungi. Fitur siswa/absensi, Excel, dan PDF belum dibuat. Tidak ada koneksi cloud.

Prasyarat: Node.js 24, minimal 24.15.0 (diperiksa dengan 24.19.0), dan npm 10.9.3. Jangan memakai Node 22.19.0 yang ada di PATH komputer ini. `.npmrc` menolak runtime di luar `engines`. Dependency langsung memakai versi tetap; `package-lock.json` menetapkan hasil resolusi lengkap.

```powershell
npm ci
npm run typecheck
npm test
npm run db:start
npm run db:migrate
npm run auth:account:provision -- guru@example.test
npm run db:status
npm run db:smoke
. .\.data\local-env.ps1
. .\.data\auth-env.ps1
npm run dev
```

`guru@example.test` adalah alamat contoh lokal pada domain `.test`; ganti dengan alamat yang ingin dipakai untuk akun lokal. Perintah awal membuat kata sandi acak dan menyimpan email/kata sandi hanya ke `.data/teacher-account.json`. Perintah ini menolak menimpa akun; pemulihan kata sandi harus eksplisit melalui `npm run auth:account:reset`. Nilai tidak dicetak ke terminal atau laporan. File sesi privat `.data/auth-env.ps1` mempertahankan kunci cookie saat server dimulai ulang; dot-source file itu pada PowerShell yang menjalankan Nuxt.

`db:start` hanya mengelola PostgreSQL 16 dengan binary dari `C:\Program Files\PostgreSQL\16\bin` di `app/.data/postgres`. Cluster hanya mendengarkan loopback `127.0.0.1:55432`; koneksi memakai password SCRAM-SHA-256 dengan role acak terpisah untuk runtime dan migrasi. Nilainya disimpan di `.data/`, yang diabaikan Git dan dikunci ke akun Windows saat ini serta SYSTEM. Script menolak cluster yang ada tanpa metadata dan tidak menyediakan perintah reset. Jangan menghapus `app/.data` jika datanya masih diperlukan.

`db:smoke` memakai schema sementara berisi satu marker sintetis untuk membuktikan data bertahan melewati restart cluster managed. Setelah pemeriksaan, schema sementara itu dihapus.

Dot-source `.data/local-env.ps1` pada sesi PowerShell yang akan menjalankan Nuxt; file ini menetapkan hanya `NUXT_DATABASE_URL` untuk role runtime dan tidak mencetak nilainya. Koneksi masih lazy: halaman dan proses dev tidak mengirim query selama belum ada kode bisnis yang memanggil repository. Dev memakai `127.0.0.1:3000`; jika port terpakai, lihat URL aktual pada terminal. Hentikan Nuxt dengan Ctrl+C. `npm run reproduce` memasang ulang dependency dari lockfile.

`npm test` menjalankan tes repository/invariant DATA dan tes login/sesi HTTP. Kedua suite menyiapkan cluster PostgreSQL 16 sementara, memakai data sintetis, lalu menghentikan dan menghapus cluster tesnya. Tes autentikasi memeriksa asal request, respons generik, sesi per perangkat, logout, reset kata sandi, dan throttle lokal. Tes tidak membaca data siswa nyata atau memakai database dari environment. URL DB yang bukan target managed lokal ditolak.

Untuk membatalkan migration pada database lokal persisten, perintahnya meminta konfirmasi kehilangan schema:

```powershell
npm run db:rollback -- --confirm-local-data-loss
```

Ini menjatuhkan schema DATA-001 pada database `lab002_local`. Jangan jalankan untuk menyimpan data yang ingin dipertahankan.

```powershell
npm run build
npm run build:node
npm run start:node
```

`build` memilih preset Vercel. `build:node` menghasilkan paket portable Node terpisah untuk pemeriksaan lokal. `start:node` hanya menjalankan paket Node pada loopback; jangan menjalankan output Vercel memakai script ini. Lihat [panduan build](docs/build-and-verification.md) untuk output dan batas bukti.

Build tidak membutuhkan credential database. Untuk menjalankan login lokal, dot-source `.data/local-env.ps1` dan `.data/auth-env.ps1` sebelum `dev` atau `start:node`. [.env.example](.env.example) hanya menyisakan `NUXT_DATABASE_URL` dan `NUXT_SUPABASE_URL` kosong. Kontrak privat/future ada pada [panduan environment](docs/environment.md). Jangan mengisi `NUXT_PUBLIC_` dengan kredensial.

Pada komputer ini, PowerShell dapat memakai runtime bundled tanpa memasang global:

```powershell
$env:PATH = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
$npmCli = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
node --version
node $npmCli --version
node $npmCli ci
node $npmCli run typecheck
node $npmCli test
node $npmCli run db:start
node $npmCli run db:migrate
node $npmCli run db:status
node $npmCli run db:smoke
node $npmCli run auth:account:provision -- guru@example.test
node $npmCli run build
node $npmCli run build:node
node $npmCli run start:node
```

Pada sesi PowerShell yang sama, dot-source `.data/local-env.ps1` dan `.data/auth-env.ps1` sebelum `dev` atau `start:node`. Hentikan cluster persisten dengan `npm run db:stop` setelah selesai.

Path bundled bersifat khusus komputer ini. Shell biasa dengan Node 24/npm 10.9.3 memakai perintah npm standar di atas. PATH di contoh hanya berubah pada sesi PowerShell tersebut.

Target hosting yang disetujui adalah Nuxt/Vue full-stack di Vercel, Node 24.x. Tidak ada project Vercel, koneksi Supabase, deployment, remote Git, commit atau push dari setup ini. Build lokal tidak membuktikan hasil deployment.

Untuk pemeriksaan lokal: jalankan `dev`, buka URL loopback dari terminal, masuk memakai nilai pada `.data/teacher-account.json`, lalu coba halaman awal dan keluar. Logout menonaktifkan sesi perangkat tersebut; reset kata sandi menonaktifkan semua sesi lama. Cookie tetap `HttpOnly` dan `SameSite=Lax`; pada HTTPS production juga `Secure`. Plain HTTP hanya mengizinkan cookie tanpa `Secure` pada host loopback. Throttle percobaan gagal adalah bantuan development per-process saja; belum ada kontrol production yang didukung. Browser/responsive acceptance tetap menunggu pemeriksaan PM.

[Peta salinan studio](docs/studio/README.md) menjelaskan sumber keputusan aktif, manifest, dan sinkronisasi sebelum task berikutnya. Source, dokumen dan evidence tetap dapat dilacak di Git; paket runtime hanya berisi bahan runtime. Git init tidak berarti riwayat sudah disimpan melalui commit. Laporan Executor berada di registry `reports/LAB002-SET-001-report.md`.
