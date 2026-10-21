# Cadangan lokal dan uji pemulihan

Alat owner: `scripts/local-backup.mjs`, Node.js24 dan binary PostgreSQL16 existing di Windows. Belum ada paket baru, endpoint web, jadwal otomatis, provider cloud atau layanan retensi. Alat cloud-data-transfer lama tetap terpisah dan tidak diperluas ke logo.

## Status pekerjaan

Revisi identitas managed mengganti query privileged data_directory dengan bukti filesystem, proses dan endpoint Windows, serta satu sesi SQL read-only yang dipertahankan. Suite gabungan Executor pada source stabil lulus20/20, exit0; hash kode/tes sama sebelum dan sesudah run. Typecheck serta build Vercel/Node pada salinan terisolasi lulus; helper CLI/lifecycle terakhir tidak masuk bundle runtime dan diverifikasi suite tersebut. Hasil dan kegagalan antara dicatat di laporan managed-identity-report pada registry. Review PM dan penerimaan tetap langkah terpisah. Probe PM sebelumnya membuktikan role migrator managed tidak memiliki pg_read_all_settings dan query data_directory ditolak42501. Revisi ini tidak menambah hak tersebut. **Guard baru belum diprobe pada managed nyata dan create data guru belum dijalankan atau dinyatakan siap operasional.** Hasil sintetis tidak membuktikan operasi data guru/production.

## Command owner

```powershell
node --experimental-strip-types scripts/local-backup.mjs create
node --experimental-strip-types scripts/local-backup.mjs restore-test --backup=backup-<UTCstamp>-<uuid>
```

`create` membaca metadata managed existing hanya setelah dipilih owner. Source wajib PostgreSQL16 loopback127.0.0.1:55432/lab002_local dan identitas cluster cocok. Jika bukti identitas tidak tersedia, alat berhenti; jangan menambah grant sebagai workaround.

Guard mengikat root canonical, PG_VERSION, bytes/identitas postmaster.pid, pg_ctl status, executable PG16, argv -D, creation time proses, listener dan tuple TCP sesi, serta SQL database/role/owner/backend/server-start. Backend SQL harus anak langsung postmaster yang dibuktikan CIM. Seluruh bukti wajib cocok; OS query ditolak/null/hilang/ambigu, pergantian PID/proses/path/endpoint/binary dan sesi putus menggagalkan operasi. Tidak ada fallback ke nama proses atau port saja. Pengamatan OS berasal dari fixed Windows PowerShell dengan environment child dibersihkan, bounded output dan timeout; tidak meminta admin.

Satu reserved backend memegang READ ONLY/exported snapshot sampai dump dan logo selesai. Guard diulang sebelum/sesudah dump dan sebelum publikasi; pemeriksaan akhir ledger/schema memakai transaksi read-only baru pada backend yang sama. Tidak ada reconnect/retry/baseline baru. Jika operasi gagal, koneksi read-only miliknya ditutup langsung agar cleanup tidak mengirim SQL pada socket mati.

Timestamp postmaster.pid berpresisi detik dan ditulis lebih awal dari SQL server-start PG16. Require creation < akhir detik PID, PID <= SQLstart, creation <= SQLstart <= backendcreation; nilai mentah masing-masing tetap dipin exact. Pembandingan memakai100ns untuk CIM dan microsecond SQL, tanpa delta toleransi sembarang. System32 PowerShell menerima nlink1/2 karena servicing Windows; hanya reader fixed binary ini yang berbeda, dengan dev/ino/nlink/size/hash dipin. Binary PG, paket dan PID tetap nlink1.

Guard membatasi race operasional, bukan transaksi atomik lintas OS/filesystem/DB. Owner/admin OS tepercaya adalah batas alat; administrator bermusuhan dapat mengubah proses/file/binary dan tidak tercakup. Akses CIM/NetTCPIP dapat berbeda antar akun atau service; kompatibilitas managed nyata masih belum diperiksa.

Paket final berada di `app/.data/local-backups/`, privat dan ignored Git. Command tidak menerima parameter URL, target, output/path, --force atau flag tambahan. Simpan ID yang dikeluarkan command; nama sekolah/siswa dan credential tidak ditampilkan. Pending package bukan cadangan sukses.

`restore-test` hanya rehearsal: memeriksa paket, membuat cluster/database baru di `.cache/local-backup-tests/` pada loopback port acak selain5432/55432, menjalankan migration lokal yang checksum-nya cocok, memulihkan data dan logo, membandingkan data, reset akun target, lalu menghentikan/menghapus target miliknya. Command tidak mengganti database guru, menghidupkan server aplikasi atau menerbitkan credential. Pemulihan menjadi lingkungan persisten memerlukan keputusan dan scope terpisah.

Factory target sintetis memberikan `pg_read_all_settings` hanya kepada migrator disposable untuk memeriksa `data_directory` langsung dari server. Role runtime tetap tidak mendapat privilege ini. Ini persetujuan PM khusus verifikasi target baru, bukan perubahan role/schema managed atau production.

## Isi dan batas

Custom dump PG16 data-only mencakup12tabel bisnis termasuk metadata logo. Manifest format `lab002-local-backup/v1` mencatat migration0001–0008 exact checksum up/NUL/down, schema descriptor, digests data, hash dump dan aset serta referensi aktif/arsip. Seluruh bytes logo metadata snapshot dibawa; filesystem orphan tidak disalin. Exported REPEATABLE READ snapshot menjaga daftar metadata dan pg_dump sejalan ketika logo berubah atau semester ditutup. Missing/tampered/decode salah menggagalkan paket.

Dump berisi data privat dan hash password akun. Jangan bagikan dump, SQL hasil ekstraksi atau folder operasinya. Manifest/log tidak membawa password, hash akun, session, URI, email atau nama siswa. Sesudah restore, password target acak baru dan session_version baru membuat credential lama tidak dipakai; sesi/throttle/env/secret/role passwords tidak dipindahkan. Akun guru asal tidak diubah. Hash sidecar mendeteksi korupsi, bukan tanda tangan yang menjamin keaslian paket.

Batas alat: manifest1MiB, dump/SQL hasil ekstraksi256MiB, tiap logo2MiB/max4096×4096, total aset256MiB/max10000; child120s, connect/lock5s, overall5menit. Batas ini bukan kapasitas produk sekolah. Symlink/junction/hardlink, path traversal/drive/UNC/ADS/casealias, duplicate keys/descriptor, extra file, manifest/hash/schema yang tidak cocok ditolak. SQL mentah/DDL arsip tidak dijalankan; hanya COPY data allowlist yang di-stage lalu dimasukkan melalui generated SQL lokal.

ACL privat memakai owner Windows+SYSTEM. Kegagalan ACL/ownership adalah alasan berhenti. Jika stop/cleanup gagal, jangan menghapus folder secara manual tanpa memastikan path canonical, nonce/receipt, PID dan ownership. Alat tidak membersihkan folder lama atau process/service lain.

## Verifikasi development

```powershell
node scripts/test-local-backup.mjs
node --experimental-strip-types --test tests/local-backup-validation.test.ts
```

Runner menghapus connection overrides turunan dan membuat data sintetis sendiri. Jangan mengarahkan tes ke database managed/cloud. Evidence aktual, kegagalan, proses dan batas tersedia pada laporan OPS-001B di registry proyek; dokumen ini bukan bukti tes lulus.

Kegagalan awal ACL berasal dari module path PowerShell yang diwariskan. Verifier membersihkan PSModulePath hanya di child Windows PowerShell; ACL tetap owner+SYSTEM dan kegagalan tetap menolak operasi. Build checks awal meninggalkan salinan ignored karena guard menolak symlink keluaran Nitro; itu terpisah dari cleanup cluster backup/restore yang lulus. Script development checks mengenali hanya link keluaran yang menuju root miliknya sendiri dan melepas link itu sebelum cleanup; tidak mengubah guard paket backup.
