# TASK LAB002-AUTH-001 — Akun guru dan sesi lokal

Status: CLOSED — diterima PM berdasarkan delegasi Ardy untuk delivery lokal
Tanggal 2026-10-12. Active owner PM; tidak ada delivery action AUTH yang tersisa.
Root app D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app.
Sumber PRD R01, UI001 disetujui, local-delivery-contract-v1 C04/C06/C08, delegasi Luna/max/local PM.
Objective login/logout satu akun emailpassword tanpa signup/reset email; semua endpoints bisnis dan output kelak require authentication.
Ownership app auth middleware/util/API/login page/protected home/layout/config/types/package/scriptsaccount/testauth/docs/evidence + reports/AUTH report; no domain/student/attendance features, migration 0002 owns password hash, account version and teacher_sessions per C04 decision; no domain schema changes.
Implementation choose nuxt-auth-utils official session+hash/verify password (scrypt), exact version compatible majorNuxt4; no OAuth/signup UI. Actor provision/reset owner CLI password generated/interactive (not commandargv), output credentials only ignored .data/private file not log/report. Session secret random envignored, cookie HttpOnly SameSiteLax secure production but HTTP localhost allowed; validate currentteacher/sessionversion each private request so reset revokes old sessions; verify origin on unsafe endpoints/CSRF per frameworkpattern; login throttle non-production storage documented limitation, generic errors not enumerate. No source known creds/sessionpassword. No plaintextpasswordDB. Local config no cloud authSDK. Single teacher enforce provision no silent overwrite; reset explicit CLI owner currentaccount; no empty overwrite. Login UI matchdesign responsive with loading/error/message. Protected pages route middleware plus API guard server; health generic no secret permissible. Header logout and minimal empty state for future modules; no fakeabsensi.
AC01 validlogin/logout/invalid/empty+sessions flow test both API and PM browser.
AC02 unauthbusiness access401/pagesredirect, crosssiteunsafe rejection, passwordhash/cookiesecret notpublic, reset invalidates existing sessions; no register/resetpublic endpoints.
AC03 CLI provision/reset reproducible local only, secretsignored and fixturedata private; actor audited without secrets.
AC04 login HP/laptop same arah UI001, states readable copy no false success; keyboard labels basic.
AC05 auth integration HTTP tests using real localPG and cookiejar, typecheck Vercel/node builds; report actualoutput/bounds no productionPASS.
AC06 docs owner bootstrap/start/reset and AC evidence/unknowns nextPM; no commit/selfclose/cloud.
Stop conditions scope/dependency incompatible/no authutilversion resolve, report PM. Existing docs sync script copiedsource approval remains authority.

Dependency actual: DATAschema teacher_accounts currentlyno authfields; add versionedmigration0002auth passwordhash/sessionversion and anyauthaudit redaction needed. Use currenttyped transactionhelpers. Ownershipall authareas permitted; no conflictingappwriter now. OutputtaskREPORTrequired with actualcookie/crosssite/reset/auth tests. Root user local password must remain ignored .data file; PM can read it for browser without publish.

Dispatch collaboration.followup_task pada worker gpt6luna/max yang sama, taskbaruAUTH001 diotorisasi delegasi12Oktober. No modelchange.

## Titik berhenti — 12 Oktober 2026

Ardy: “Hentikan dulu pengerjaan di titik yang aman”. Assignment dihentikan; perubahan AUTH yang belum selesai dipertahankan tanpa commit. Tidak ada acceptance AUTH atau claim tests lulus. Lihat local-pause-checkpoint.md dan laporan stop Executor bila tersedia. Tidak lanjut otomatis.

## Resume — 12 Oktober 2026

Ardy: “lanjutkan kembali task yang terhenti. mulai dari titik aman”. PM membaca checkpoint/status/report dan meneruskan AUTH001 ke worker yang sama gpt6luna/max. Tidak reset perubahan tersimpan, tidak resume taskfiturbaru. ACK/preflightdelta dan checks terbaru wajib; hasil sebelumstop bukanPASSsourceterbaru.


## Acceptance PM — 12 Oktober 2026

AC01–AC06 terpenuhi untuk scope lokal AUTH. PM memeriksa source, laporan, suite DATA 6/6 + AUTH 12/12 dan typecheck secara independen; build Vercel/Node dan metadata nodejs24.x diperiksa. Alur browser login/logout pada laptop dan viewport HP, serta home build terbaru, lulus. Provision CLI dijalankan Executor; reset CLI akun fiktif persisten diuji PM: password/sesi lama ditolak dan password baru berhasil login/logout.

Revisi timeout harness dan copy selesai. Kegagalan login persisten 503 berasal dari cara memulai dev server yang tidak memuat environment DB; restart dengan kedua file privat menyelesaikannya tanpa perubahan source/data. Lihat review PM untuk rincian dan batas evidence.

Keputusan: diterima dan CLOSED oleh PM sesuai delegasi Ardy, bukan approval atau pengujian langsung Ardy. Tidak ada commit oleh Executor. PM menyiapkan commit lokal setelah staging diperiksa. Tidak ada remote, push atau deploy. Task fitur berikut tetap menunggu readiness/assignment PM.
