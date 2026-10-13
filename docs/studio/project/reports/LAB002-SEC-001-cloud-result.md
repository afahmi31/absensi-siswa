# SEC-001 — Hasil penerapan Supabase

13 Oktober 2026. Target absensi-siswa/jkiewjlohgmsujcwerpi. Ardy memberi izin 'oke lanjutkan penerapan nya sekarang' sesudah verifikasi plugin dan review lokal migration0007. Snapshot source87d922b4263d2102f8fd199ac02ccd8063d38ef2 disimpan dan pushmain sebelum penerapan. Seluruh berkas SQL dicek byte-identik dengan Git sebelum CLI dijalankan.

Penerapan melalui migrator aplikasi existing sebagai lab002_migrator pada Session pooler, TLS CA/hostname verified. Migration0001–0006 dilaporkan Unchanged,0007 Applied, post-migration runtime-only/RLS check PASS. Tidak memakai owner untuk migration atau mengubah checksum lama.

Verifikasi baca-saja plugin Supabase:20fungsi aplikasi dimiliki migrator dan20memiliki search_path pg_catalog, public, pg_temp. Ledger mempunyai7entry. Tabel siswa/absensi/akun/audit/sesi masih kosong dan RLS enabled. Securityadvisors tidak lagi melaporkan function_search_path_mutable; hanya INFO schema_migrations RLS/no-policy, disengaja agar runtime/API tidak mengakses ledger. Ini tidak berarti seluruh keamanan aplikasi/deployment telah diuji.

Tidak ada data guru dipindahkan atau deployment Vercel. Runtime/database lokal guru dipertahankan. Langkah berikut PM: snapshot/backup lokal dan pemeriksaan target untuk transfer, lalu izin import nyata yang terpisah. Deployment membutuhkan versi/target konkret. Rollback tidak dijalankan; migration down hanya tersedia untuk uji lokal, jangan melemahkan path cloud dengan rollback tanpa keputusan.
