# Environment dan kontrak database berikutnya

Task ini berjalan tanpa `.env` atau kredensial. Supabase dipilih sebagai penyedia PostgreSQL; project URL, region, plan, credential dan resource belum tersedia. Auth/Storage tidak dipilih oleh fondasi ini.

| Variable | Tempat | Maksud/batas |
|---|---|---|
| `NUXT_DATABASE_URL` | `runtimeConfig.databaseUrl`, privat server | Placeholder kosong untuk alamat PostgreSQL. Bentuk koneksi/direct/pooler/driver menunggu DATA-001. |
| `NUXT_SUPABASE_URL` | `runtimeConfig.supabaseUrl`, privat server | Placeholder kosong untuk project URL masa depan; belum digunakan aplikasi. |

Konfigurasi tidak memiliki `runtimeConfig.public` untuk database. Tidak ada SDK Supabase, driver, ORM, schema, migration, seed, resource creation atau request database dari source aplikasi. Dependency transitif framework dapat memiliki adapter opsional; itu tidak berarti aplikasi menggunakannya.

`.env.example` aman disimpan dalam source. `.env`/variasinya berisi nilai lokal dan diabaikan Git; output/cache/log juga diabaikan. Jangan menaruh database URL, password, service-role key, data siswa atau PDF siswa di `public/`, state frontend, route publik, log atau dokumen.

Saat kontrak DATA/AUTH disetujui, tentukan kebutuhan variable baru, validasi server, kebijakan akses dan koneksi. Jangan menganggap placeholder ini sudah memberi kontrak auth/storage atau keberhasilan koneksi. Konfigurasi environment production harus mengikuti keputusan Ardy; setup ini tidak menulisnya.

Nuxt CLI dapat membaca `.env` ketika development/build. Paket Node production tidak otomatis membaca `.env`; konfigurasi produksi kelak diberikan melalui environment proses. Pembuktian task ini dilakukan tanpa file `.env` dan tanpa nilai credential.
