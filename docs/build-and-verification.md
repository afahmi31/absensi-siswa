# Build dan pemeriksaan lokal

Gunakan Node 24/npm 10.9.3, root app, lalu `npm ci` dan `npm run typecheck`. Typecheck memakai `nuxt typecheck --checker vue-tsc`, dengan TypeScript dan vue-tsc sebagai dependency development. Tidak ada lint/test suite pada fondasi minimal ini; install/typecheck/build/smoke HTTP adalah pemeriksaan task yang ditugaskan.

| Perintah | Preset/output | Kegunaan |
|---|---|---|
| `npm run build` | `vercel`; `.vercel/output/` | Build Output API untuk target Vercel. Tidak deploy atau menghubungkan project. |
| `npm run build:node` | `node-server`; `.output/` | Paket portable Node untuk startup lokal. |
| `npm run start:node` | `.output/server/index.mjs` | Menjalankan paket Node pada `127.0.0.1`, port 3000/default `PORT`. |

Build kedua dapat menulis ulang `.output/` perantara Nuxt. `.vercel/output/` adalah output Vercel yang berbeda. Periksa output aktual/log sesudah build, jangan menebak output dari nama script. `start:node` memaksa `HOST`/`NITRO_HOST` loopback. Contoh ganti port pada PowerShell: `$env:PORT = '3100'`, lalu `npm run start:node`.

Nitro 2.13.4 membatasi auto-detection runtime Vercel hingga Node 22. `nuxt.config.ts` menetapkan `nitro.vercel.functions.runtime: 'nodejs24.x'` agar metadata function sesuai baseline Node 24. Periksa `.vercel/output/functions/__fallback.func/.vc-config.json`; runtime harus `nodejs24.x`. Ini konfigurasi paket lokal, bukan perubahan project Vercel. [Node 24 didukung Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Fondasi memakai `app/app.vue` tanpa pages bisnis. Path lain saat ini juga merender halaman persiapan dengan HTTP 200; tidak ada route login/absensi atau file docs yang disajikan. Perilaku 404/routes fitur kelak dirinci pada task terkait.

Smoke teknis yang ditugaskan: server portable Node mulai tanpa credential; HTTP `/` memberikan 200 dan ketiga teks halaman persiapan; koneksi listener hanya loopback. Hentikan proses milik pemeriksaan sesudah selesai. Pemeriksaan source/output memastikan tidak ada form login/route bisnis atau docs yang masuk public bundle. Ini tidak menggantikan uji browser Ardy.

Dokumen development berada pada `docs/` dan source, tidak pada `public/`, `app/pages/` atau `server/routes/`. Nuxt membangun source aplikasi dan assets yang diperlukan. Jangan menyalin seluruh repo ke static assets. Paket `.vercel/output/` dan `.output/` tidak memuat salinan PRD, task, laporan, desain statis atau evidence development; periksa kembali jika konfigurasi bundling berubah. Repo Git tetap melacak bahan development tersebut.

Tidak ada `.vercel/project.json`, Vercel CLI, `vercel dev`, remote, CI cloud atau deployment dalam setup ini. Ardy menentukan target/ref/config/layanan sebelum deployment. Dukungan target: [Nuxt di Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt). Runtime lokal: [Nitro Node](https://nitro.build/deploy/runtimes/node). Perintah pemeriksaan: [Nuxt typecheck](https://nuxt.com/docs/4.x/api/commands/typecheck).

Output build/typecheck/HTTP/Git yang benar-benar dijalankan tersedia di `docs/evidence/LAB002-SET-001/`. Baca laporan registry untuk versi, exit code, keterbatasan dan hasil self-check. Build lokal bukan bukti database, auth, absensi, penggunaan HP/laptop atau deployment berhasil.
