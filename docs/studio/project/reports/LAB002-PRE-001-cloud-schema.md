# LAB002-PRE-001 — Persiapan role dan skema Supabase

13 Oktober 2026. Target absensi-siswa/jkiewjlohgmsujcwerpi. Sumber izin: jawaban dialog Ardy “Izinkan persiapan role dan skema Supabase tersebut (Rekomendasi)”, untuk commit6569819. Izin ini belum mencakup transfer data guru atau deployment Vercel.

Sebelum write, PM memeriksa target public kosong, dua role khusus belum ada, PG17.11, database owner postgres dan hak bootstrap tersedia. Seluruh dua belas berkas SQL up/down migration0001–0006 sama persis dengan commit yang diizinkan. Owner credential hanya dibaca dari file privat. CA serta hostname diverifikasi, koneksi Session pooler max1.

Bootstrap berhasil dalam transaksi: dua role LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT dibuat dengan password baru kuat. Migrator mendapat hak pembuatan objek yang diperlukan; runtime tidak mendapat CREATE pada public. Akses public schema untuk PUBLIC/anon/authenticated/service_role dicabut. PM memeriksa hak efektif melalui plugin, bukan hanya log GRANT.

Credential baru tersimpan pada app/.data/supabase-cloud-private.json, diabaikan Git dan ACL hanya pengguna pemilik serta SYSTEM. Tidak mencetak credential/URI/hash/password. Sesi dan HMAC cloud terpisah dari lokal. File operasional privat tidak masuk repo.

Percobaan penerapan skema berhenti di precheck CLI dengan SQLSTATE42883: text[] dibandingkan dengan name[] pada daftar pg_roles. Koneksi migrator dan TLS lulus; publictables masih kosong dan belum ada SQL migration yang diterapkan. PM meminta Executor memperbaiki cast pada pemeriksaan alat serta regression lokal. SQL0001–0006 tidak berubah; belum mengulang write sampai perbaikan diperiksa.

Next owner Executor untuk perbaikan pemeriksaan CLI, PM untuk penerapan migrasi yang telah diizinkan dan verifikasi. Alat CLOUD-DATA-001 tetap tahap lokal; data guru tidak dipindahkan.

## Hasil setelah koreksi pemeriksaan CLI

Executor memisahkan pemeriksaan role ke helper parameter JSONB untuk menghindari perbedaan tipe array. Pengujian terfokus lokal lulus pada Node24/PG16 untuk semua role tersedia dan role tidak ditemukan. PM memeriksa source dan mengulang dua kasus pada PG17 aktual: PASS. Perubahan hanya pada alat pemeriksaan; seluruh SQL migration0001–0006 tetap byte-identik dengan commit6569819 yang disetujui.

CLI check dan up lalu berhasil sebagai lab002_migrator melalui TLS verified. Keenam migration diterapkan dan ledger aplikasi mempunyai enam entry. Empat belas tabel public/private yang diperiksa semuanya RLS enabled dan dimiliki migrator. Runtime lab002_app dapat membaca seluruh tabel aplikasi dan view effective_attendance yang masih kosong; akses ledger ditolak dengan42501. Role anon/authenticated/service_role tidak mempunyai USAGE public/private atau SELECT siswa/audit. Tidak ada data guru atau sesi perangkat yang dipindahkan.

Advisors menemukan fungsi event-trigger bawaan public.rls_auto_enable() milik postgres masih memberi EXECUTE kepada role publik/API. PM mencabut hanya EXECUTE dari PUBLIC/anon/authenticated/service_role sesuai izin pembatasan akses; body/owner/search_path fungsi platform tidak berubah. Pemeriksaan hak sesudahnya false untuk ketiga role API, dan dua peringatan advisor akses fungsi tersebut hilang.

Pemeriksaan keamanan tersisa: WARN function_search_path_mutable pada19 fungsi aplikasi; perlu usulan migrasi forward baru, belum diterapkan karena izin cloud saat ini terbatas0001–0006. INFO RLS enabled/no-policy hanya schema_migrations, disengaja karena runtime/API tidak boleh mengakses ledger. Pemeriksaan performa INFO enam FK tanpa covering index dan delapan indeks belum dipakai pada database kosong; bukan bukti perlambatan dan tidak menghapus indeks atau menambah migrasi performa dalam tahap ini.

Rujukan: [search_path fungsi](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [ledger RLS tanpa policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [FK index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

Hasil tahap yang diizinkan: role/skema0001–0006 diterapkan dan verifikasi dasar akses/TLS lulus. Ini belum kesiapan rilis: penguatan fungsi, rehearsal pemindahan data, penggunaan aktual PG17 dan smoke Vercel masih diperlukan. Next owner Executor untuk alat lokal dan usulan penguatan; PM untuk review, handoff/izin migrasi tambahan serta release konkret. Tidak ada deployment atau transfer data nyata.
