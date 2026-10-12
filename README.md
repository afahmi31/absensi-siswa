# Website Absensi Siswa — fondasi lokal

LAB-002 / PROD-002, task LAB002-SET-001. Aplikasi minimal ini menampilkan halaman persiapan. Login, pengisian absensi, data siswa, Excel dan PDF belum dibuat. Tidak ada database atau layanan yang dihubungkan.

Prasyarat: Node.js 24, minimal 24.15.0 (diperiksa dengan 24.19.0), dan npm 10.9.3. Jangan memakai Node 22.19.0 yang ada di PATH komputer ini. `.npmrc` menolak runtime di luar `engines`. Dependency langsung memakai versi tetap; `package-lock.json` menetapkan hasil resolusi lengkap.

```powershell
npm ci
npm run typecheck
npm run dev
```

Dev memakai `127.0.0.1:3000`. Jika port terpakai, Nuxt dapat memilih port berikutnya; lihat URL aktual pada terminal. Hentikan dengan Ctrl+C. `npm run reproduce` juga menjalankan `npm ci`; perintah ini memasang ulang dependency lokal dari lockfile.

```powershell
npm run build
npm run build:node
npm run start:node
```

`build` memilih preset Vercel. `build:node` menghasilkan paket portable Node terpisah untuk pemeriksaan lokal. `start:node` hanya menjalankan paket Node pada loopback; jangan menjalankan output Vercel memakai script ini. Lihat [panduan build](docs/build-and-verification.md) untuk output dan batas bukti.

Environment tidak diperlukan untuk build/start dasar. [.env.example](.env.example) hanya menyisakan `NUXT_DATABASE_URL` dan `NUXT_SUPABASE_URL` kosong. Kontrak privat/future ada pada [panduan environment](docs/environment.md). Jangan mengisi `NUXT_PUBLIC_` dengan kredensial database.

Pada komputer ini, PowerShell dapat memakai runtime bundled tanpa memasang global:

```powershell
$env:PATH = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
$npmCli = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
node --version
node $npmCli --version
node $npmCli ci
node $npmCli run typecheck
node $npmCli run build
node $npmCli run build:node
node $npmCli run start:node
```

Path bundled bersifat khusus komputer ini. Shell biasa dengan Node 24/npm 10.9.3 memakai perintah npm standar di atas. PATH di contoh hanya berubah pada sesi PowerShell tersebut.

Target hosting yang disetujui adalah Nuxt/Vue full-stack di Vercel, Node 24.x. Tidak ada project Vercel, koneksi Supabase, deployment, remote Git, commit atau push dari setup ini. Build lokal tidak membuktikan hasil deployment.

Untuk uji Ardy: jalankan dev atau build Node/start, buka URL loopback dari terminal, lalu periksa judul “Website Absensi Siswa”, pesan “Fondasi aplikasi sedang disiapkan.” dan “Pengisian absensi belum tersedia.” Catat browser dan temuan. Halaman tidak mempunyai form login/signup maupun aksi simpan. Uji browser/responsive/fitur bisnis belum dilakukan Executor.

[Peta salinan studio](docs/studio/README.md) menjelaskan sumber keputusan aktif, manifest, dan sinkronisasi sebelum task berikutnya. Source, dokumen dan evidence tetap dapat dilacak di Git; paket runtime hanya berisi bahan runtime. Git init tidak berarti riwayat sudah disimpan melalui commit. Laporan Executor berada di registry `reports/LAB002-SET-001-report.md`.
