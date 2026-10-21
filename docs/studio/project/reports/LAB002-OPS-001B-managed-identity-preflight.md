# OPS-001B — Kajian identitas managed tanpa tambahan hak

22 Oktober 2026. Executor `/root/ops_backup_preflight`, Codex gpt-6.1-sol/medium; next owner PM. Tahap **kajian/preflight saja**. Sumber keputusan: PM meneruskan pilihan dialog Ardy “Kaji verifikasi identitas tanpa tambahan hak”. Tidak ada perubahan source aplikasi/CLI, kebijakan privilege, dump, migrasi, restart atau koneksi ke managed pada kajian ini. Factory sintetis existing tetap membuat role/DB dan grant disposable sesuai kontrak lamanya; tidak ada grant managed atau tambahan privilege Windows.

## Kesimpulan

Rekomendasi: ganti kebutuhan membaca `current_setting('data_directory')` **pada source managed saja** dengan bukti gabungan filesystem + proses Windows + endpoint TCP + satu sesi SQL read-only yang tetap hidup. Semua bukti harus cocok; satu field hilang/ambigu/berubah berarti menolak. Jangan menjadikan path, PID, pg_ctl status, nama proses atau port sebagai bukti tunggal. Target restore disposable mempertahankan kontrak factory/privilege/verifikasi existing; tidak diperluas pada kajian ini.

Dua eksperimen sintetis mendukung kelayakan pendekatan pada Windows komputer ini tanpa elevasi. Ini belum guard terimplementasi atau bukti managed sudah lolos. Guard existing tetap menolak managed, sesuai probe PM42501. PM perlu menerima kontrak dan scope di bawah sebelum implementasi; operasi identity-only managed sesudahnya memerlukan batas otorisasi tersendiri, dan tidak otomatis mengizinkan create/dump data guru.

## Bukti yang dibaca dan dilakukan

1. `reports/LAB002-OPS-001B-managed-probe.md`: PM menguji role lab002_migrator nonsuperuser, tidak anggota pg_read_all_settings; query data_directory ditolak42501. Cluster managed dibiarkan menyala sesuai keputusan Ardy. Kajian ini tidak melakukan ulang probe atau menyentuh cluster itu.
2. Source app `scripts/local-db.mjs:61–89,186–238`: metadata existing memakai formatVersion1/postgresMajor16/port55432/database lab002_local/clusterPath/migrationUrl; PG16 diluncurkan pg_ctl -D cluster root, loopback127.0.0.1, SCRAM, migrator nonsuperuser. Metadata/credential aktual tidak dibaca.
3. `scripts/local-backup-core.mjs:56–86`: guard current source membuat capability tetapi pemeriksaan SQL data_directory memerlukan hak yang tidak ada. `sourceDetails` juga membuka lalu menutup koneksi terpisah; sekadar menghapus kolom terlarang tidak cukup untuk mengikat snapshot/dump pada identitas yang diperiksa.
4. `scripts/local-backup-postgres.mjs`: factory, pool max1/idle_timeout2s, child sanitizer, PG16 executable absolut dan cleanup ownership existing. `local-backup-files.mjs`: canonical ancestor/no-link/readPrivate/receipt existing dapat direuse untuk file identitas.
5. Tidak memakai PID/path nyata managed sebagai input eksperimen. Kedua run memakai `newCluster()` existing, generated root `.cache/local-backup-tests/cluster-UUID`, port bebas selain5432/55432. SQL hanya fungsi identitas/session, tanpa tabel bisnis. OS query difilter pada port/PID run sintetis; tidak menginventaris commandline proses lain. Tidak menjalankan pg_dump atau migration. Cluster masing-masing dihentikan/dibersihkan oleh capability sendiri.

### Observasi sintetis aktual

| Run | Expected | Observed |
|---|---|---|
| Session35067, ordinary pool | Periksa keterbacaan field proses/endpoint/status | Exit0. Port52249 listener ownerPID19160; exe canonical PG16/postgres.exe, CommandLine -D root generated, CreationDate tersedia; pg_ctl status PID19160. SQL sempat mengembalikan backend20620 tetapi backend sudah tidak ada saat query OS: idle_timeout2s dapat menutup sesi. Ini membuktikan perlunya reserved/live session, bukan bukti backend mismatch yang boleh diabaikan. |
| Session18049, transaksi READ ONLY ditahan | SQL backend tetap hidup selama query OS, fungsi identitas tidak butuh pg_read_all_settings | Exit0. Role runtime lab002_app, read_settings=false. Port56197; postmasterPID20256; SQLbackend23256, clientPort57138. LISTEN dan established tuple server127.0.0.1:56197 -> client127.0.0.1:57138 sama-sama ownerPID20256. Backend23256 mempunyai PPID20256, exe PG16 yang sama, commandline --forkbackend. Query SQL sesudah OS kembali memberi backend/start time yang sama. |
| Token dan cleanup | Tidak menambah/elevasi privilege; hanya root eksperimen | WindowsPrincipal current token Administrator=False. Tidak meminta RunAs/elevasi/SeDebugPrivilege. Root cluster-f2151029-05d8-4692-bbb4-8b30f83b9ba0 dan cluster-a9966ea5-cc8f-46a3-834f-4612fae070b7 tidak ada sesudah teardown. Tidak stop/start managed. |

Waktu run kedua: process creation2026-10-21T20:55:32.6085860Z; SQL postmaster start epoch1792616132.698365. Keduanya berbeda normal sekitar90ms, sehingga jangan menuntut CreationDate sama persis dengan pg_postmaster_start_time. Gunakan CreationDate sebagai identitas instance proses yang stabil, serta epoch detik file PID untuk mencocokkan SQL server-start. Tidak mengambil tanggal OS sebagai tanggal domain siswa.

Perintah eksperimen berupa Node24 stdin module yang memakai factory existing + query readonly + child Windows PowerShell absolut; tidak menyimpan perubahan kode. Child menggunakan -NoProfile/-NonInteractive/-EncodedCommand, timeout15s, output bounded32KiB, sanitized env dan PSModulePath dibersihkan hanya pada child. pg_ctl status timeout5s. Semua credential hanya di memory capability, tidak dicetak/disimpan pada laporan.

## Mengapa bukti perlu digabung

PostgreSQL mencatat PID, data-directory path, start timestamp, port dan listen address dalam postmaster.pid. `-D` sendiri bisa menunjuk direktori konfigurasi; `data_directory` dapat menggantikan lokasi data sebenarnya. Maka argumen -D saja tidak membuktikan data root. Periksa file postmaster.pid **di root yang diizinkan** dan field path-nya, lalu ikat ke proses dan SQL yang sama. [Layout file PG16](https://www.postgresql.org/docs/16/storage-file-layout.html), [lokasi konfigurasi PG16](https://www.postgresql.org/docs/16/runtime-config-file-locations.html).

Windows CIM menyediakan PID, parent PID, creation time, executable path dan commandline. Parent PID dapat merujuk PID yang sudah digunakan ulang; creation time perlu ikut dibandingkan. ExecutablePath dapat tidak terbaca pada konteks keamanan tertentu: null/access denied wajib gagal, bukan alasan meminta admin atau menerima nama postgres.exe saja. [Win32_Process](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process).

Get-NetTCPConnection memberi endpoint/state/owner PID. Observasi Windows PG16 di atas menunjukkan owner socket adalah **postmaster**, sedangkan pg_backend_pid adalah anak backend. Kontrak tidak boleh menuntut kedua PID itu sama. SQL menyediakan backend PID dan client/server endpoint untuk mengikat sesi tersebut. [Get-NetTCPConnection](https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-nettcpconnection?view=windowsserver2025-ps), [fungsi identitas SQL PG16](https://www.postgresql.org/docs/16/functions-info.html).

## Kontrak guard yang diusulkan

### A. Batas input dan trust

- Tetap tidak ada CLI input target/source URL/path/port/role/force. Identitas managed tetap konstanta root `.data/postgres`, loopback127.0.0.1:55432, database lab002_local, session_user=current_user=lab002_migrator, major16. Metadata privat hanya dibaca saat operasi yang telah diotorisasi, memakai format existing; bukan pada kajian ini.
- Root directory dan setiap ancestor canonical, bukan junction/symlink/UNC/alias. Simpan identitas filesystem root (dev/ino) dalam receipt in-process yang tidak dapat diterbitkan dari JSON pengguna. Baca `PG_VERSION` dan `postmaster.pid` sebagai regular/nlink1/no-follow bounded bytes dengan helper filehandle existing; tidak baca business files, configuration secrets atau credential selain metadata yang sudah menjadi kontrak operasi.
- Trusted executables literal: `C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe`, postgres.exe dan pg_dump.exe; OS query memakai `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`. Periksa canonical executable path dan versi16; path/identitas binary tidak berubah sepanjang operasi. Tidak mencari lewat PATH, cmd/c, script profile, Invoke-Expression, file .ps1 dari direktori pengguna atau fallback executable lain.
- Script OS query tetap dari source tool, parameter PID/port integer tervalidasi dan path sebagai data, tidak disambung menjadi kode. shell:false/windowsHide; strip libpq/PGDATA/service/options, credential cloud/NUXT, PSModulePath serta override launcher dari child; output JSON exact schema/size bounded, timeouts finite. Commandline lengkap hanya untuk validasi lokal dalam memory, tidak log/manifest.

### B. Pemeriksaan OS/filesystem sebelum sesi SQL

1. Canonical root + PG_VERSION16; file postmaster.pid harus mengandung PID positif32bit, canonical data path tepat root, timestamp epoch detik valid, port55432, listen127.0.0.1 dan status ready. Tolak file malformed/partial/stale/extra-field ambigu; simpan bytes hash+file identity. Jangan memakai mtime sebagai process creation time.
2. Jalankan pg_ctl status -D fixedRoot, hanya mode status. Exit harus0, PID yang dilaporkan tepat file PID; grammar status yang tidak dikenali gagal. Status mendukung crosscheck, tidak menggantikan CIM/socket/SQL. Tidak start/stop/reload/kill/promote. [pg_ctl16](https://www.postgresql.org/docs/16/app-pg-ctl.html).
3. CIM candidate postmaster harus hidup, ExecutablePath canonical tepat binary PG16 yang disetujui; commandline tokenized Windows mempunyai tepat satu -D absolute yang cocok root, tanpa override data_directory/config di luar kontrak managed. Jangan split whitespace/contains prefix. Source manager managed yang dibaca memakai -D tanpa override; konfigurasi startup lain ditolak untuk review, tidak dilonggarkan otomatis. Windows mempunyai aturan quote/backslash khusus; tokenizer perlu tes path berspasi, quoted argument dan duplicate/unterminated flags. [Aturan Windows argv](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-commandlinetoargvw).
4. Capture `(PID, CreationDateUTC string presisi, executable identity/path)` sebagai identitas instance. Parent postmaster boleh proses pg_ctl yang sudah berakhir; jangan menuntut parent pg_ctl tetap hidup. Yang wajib hidup adalah postmaster dan backend sesi saat crosscheck.
5. Snapshot TCP harus mempunyai tepat satu listener untuk address/port yang diizinkan, ownerPID=postmaster. Tolak wildcard0.0.0.0/IPv6, tambahan listener owner lain, null/ambigu/akses ditolak atau endpoint tidak ada. Query hanya port fixed; tidak menghentikan listener apa pun.

### C. Ikat satu koneksi SQL hidup pada instance OS

6. Buka/reserve koneksi max1 dan mulai READ ONLY sebelum query identitas; gunakan transaksi ini juga sebagai exporter backup nanti. Tidak mengandalkan pool idle yang dapat menutup lalu mengganti backend. Query nonprivileged: current_database/current_user/session_user, server_version_num, inet_server_addr/port, inet_client_addr/port, pg_backend_pid, pg_postmaster_start_time, database owner dari katalog. Tidak query data_directory atau fungsi/file privileged. Require expected role/database/owner/major/loopback; tidak SET ROLE dari URL/PGOPTIONS.
7. Backend PID SQL harus hidup menurut CIM, exe canonical PG16, PPID tepat postmaster yang instance-nya sudah dicatat; backend creation tidak sebelum postmaster creation. CreationDate dan postmaster instance harus tetap identik saat diambil ulang. Jangan menerima arbitrary ancestor/descendant chain atau sekadar nama postgres.exe. PID tidak pernah dipakai sendiri sebagai identitas permanen.
8. Established **server-side** tuple harus tepat SQLserverHost:serverPort -> SQLclientHost:clientPort, state established, ownerPID=postmaster menurut baseline Windows yang diuji. Bukan semua established connection harus milik sesi ini; sesi aplikasi lain sah. Tidak mencari hanya LocalPort lalu menerima baris pertama. BackendPID yang berbeda dari socket-owner adalah kondisi normal yang harus dibuktikan lewat PPID + sesi yang tetap hidup, bukan fallback.
9. `floor(epoch(pg_postmaster_start_time()))` harus sama dengan epoch start di postmaster.pid. OS process creation harus tidak sesudah SQL server-start (dengan presisi konversi yang ditentukan); perbedaan normal creation/start tidak dituntut nol. Clock/precision ambiguity gagal dan dilaporkan, tidak ditoleransi tanpa batas. Tuple PID+creation dari OS, start SQL, file hash/dev/ino, root identity dan listener dipin sebagai receipt operasi.
10. Sesudah pengambilan OS, query identitas kembali pada transaksi yang **sama**: backendPID/clientport/server-start tidak berubah. Ambil ulang file/CIM/listener; semua identity key masih sama. Baru sesudah ini boleh lanjut ledger/business reads dalam create yang memang telah diotorisasi.

### D. Sepanjang snapshot/dump dan publikasi

11. Pertahankan exporter READ ONLY sampai pg_dump dan pembacaan aset selesai. pg_dump tetap explicit fixed host/port/user/db, password hanya child env privat dan `--snapshot` dari transaksi itu. Jangan kembali ke URL/default environment/reconnect otomatis ketika exporter/guard gagal.
12. Ulangi guard file/OS/listener dan SQL receipt pada transaksi sama tepat sebelum spawn pg_dump dan sesudah child selesai; lakukan cek terakhir sebelum publikasi. Exporter connection loss, postmaster/backend exit/restart, PID reuse/CreationDate berubah, endpoint berpindah atau file/root berubah membatalkan operasi, menutup koneksi dan hanya membuang staging miliknya. Tidak stop managed, kill process lain atau retry dengan baseline baru dalam operasi yang sama.
13. Jika child berjalan ketika kegagalan terdeteksi, cancel hanya child pg_dump handle milik operasi. Sebelum final publikasi, semua hash/metadata/snapshot check existing tetap wajib. Guard baru tidak menggantikan ledger/schema/asset/privacy/atomic checks.

Ini pembatasan race operasional dengan receipt berlapis dan exporter hidup; bukan transaksi atomik lintas Windows kernel, filesystem dan PostgreSQL. Tidak ada jaminan terhadap administrator/owner OS yang sengaja mengganti binary/file/endpoint dengan race terkoordinasi. Boundary owner OS tepercaya sudah melekat pada CLI privat existing; jika diperlukan ketahanan terhadap owner OS bermusuhan, pendekatan ini tidak cukup dan butuh keputusan arsitektur terpisah. Jangan menjanjikan “TOCTOU hilang”.

## Attack/failure cases dan expected

| Kasus | Expected guard / verification nanti |
|---|---|
| Stale PID file, PID tidak ada, PID reused | Tidak menerima PID saja; process creation/exe/start/SQL/endpoint mismatch menolak sebelum business read. |
| PID file diganti untuk menunjuk proses asing | Exe/argv/root/listener dan backend PPID harus cocok; tidak mencetak commandline asing; fail. |
| Port sama dimiliki server/proxy lain | Listener owner+exe+creation dan established tuple/SQLbackend relation menolak. Tidak attach/stop process asing. |
| Genuine PG16 tetapi root/database/role berbeda | Root file/argv atau SQL identity gagal; port/versi saja tidak cukup. |
| -D path palsu/prefix mirip/spasi/duplicate/relative/config override | Tokenizer exact canonical path + file data-directory field; ambiguous flags gagal. Data_directory override tidak diabaikan hanya karena -D cocok. |
| PID/root/junction/file identity/endpoint berubah antara fase | Receipt tidak sama, abort child sendiri dan gagal atomik; bukan recapture baseline lalu melanjutkan. |
| Pool mengganti backend atau backend timeout | Reserved read-only session harus tetap hidup dan backend/clientport sama; gagal jika berubah. |
| SQL backendPID != listenerPID | Bukan langsung gagal atau langsung diterima: wajib direct PPID ke postmaster + tepat established tuple. Baseline saat ini listener owner=postmaster. Variasi OS yang berbeda belum didukung, tetap fail-closed. |
| CIM/NetTCPIP missing/timeout/ExecutablePath null/access denied | Gagal aman, tanpa elevation/admin/dependency/grant/fallback nama proses. |
| postgres/pg_ctl binary/path atau process creation berubah | Identity pinned menolak. Tidak menganggap --version saja bukti binary sama. |
| Server restart sesudah precheck/sebelum/during dump | Exporter harus putus atau server-start/instance berubah; paket tidak diterbitkan, tidak retry source otomatis. |
| Source ledger/schema/aset tidak cocok setelah identity lolos | Existing checks tetap gagal; jangan migrate/grant/reset source untuk melewati masalah berikutnya. Actual managed ledger belum dibaca pada kajian. |

## Scope implementasi yang tepat bila PM menerima

- Satu helper baru `app/scripts/local-backup-managed-identity.mjs`: strict PID/Windows argv/OS-output parsers, bounded trusted child query dan composite receipt validator. Tidak endpoint/config publik baru.
- `local-backup-core.mjs`: managedSource/sourceDetails/createBackup saja untuk lifecycle managed receipt dan satu exporter session yang sama; hapus kebutuhan query privileged pada jalur managed setelah replacement tersedia. Fixture/restore target behavior existing dipertahankan.
- `local-backup-postgres.mjs` hanya jika diperlukan helper child absolute/sanitized environment; tidak mengubah factory grant/restore/auth/runtime/migration/local-db/cloudtool. Small refactor lain dilaporkan dulu.
- Tests identity khusus dan tambahan integration sintetis pada task suite, menggunakan factory existing dan role tanpa pg_read_all_settings untuk pemeriksaan nonprivileged. Negative parsers/receipt snapshots dan barrier untuk process/endpoint changes harus menguji expected refusal/sentinel, bukan assertion source string.
- Docs/local-backup dan laporan diperbarui dengan observed checks, OS compatibility, failure codes, managed identity-only evidence yang benar-benar diizinkan. Tidak mengubah status/mirror/Git milik PM.

## Verification dan batas sebelum acceptance

1. Synthetic positive pada retained READ ONLY session dengan role tanpa pg_read_all_settings: OS parent/listener/established tuple dan SQL start matching; tidak menyentuh domain data.
2. Synthetic negatives untuk semua identity components, malformed/duplicate Windows argv, false/stale/reused PID snapshot, foreign/occupied port, missing/null/denied OS output, root/file swap, restart barrier dan exporter disconnect. Sentinel/proses asing tidak berubah; hanya child milik operasi dihentikan.
3. Jalankan ulang task roundtrip/atomic/concurrency untuk membuktikan guard baru tidak mengubah format/ref/hash/auth semantics. Source fixture sebelum/sesudah exact, cleanup capability sendiri; typecheck/build hanya bila perubahan source/checks memerlukan.
4. Sesudah hasil diterima PM, identity-only managed probe memerlukan otorisasi yang jelas: metadata privat existing untuk koneksi, file identitas nonbusiness, OS candidate PID/port serta SQL functions read-only. Tidak pg_dump/business rows/logo read atau managed start/stop. Probe berhasil belum mengizinkan create data guru.

Tidak ada blocker yang mengharuskan grant/dependency baru pada **desain** ini. Blocker operasional tetap: replacement belum diimplementasikan/diverifikasi, compatibility managed belum diperiksa, dan create data guru tidak diotorisasi. Hak baca proses/endpoint dapat berbeda antar instalasi Windows/account; eksperimen membuktikan current non-admin token pada proses sintetisnya sendiri, bukan akses universal ke semua service.

**Preflight decision: kajian siap direview PM; implementasi belum dimulai.** Hanya laporan ini ditambahkan. Source/app tetap; tidak commit/push/deploy/menutup task. Production Actions Performed: NONE.
