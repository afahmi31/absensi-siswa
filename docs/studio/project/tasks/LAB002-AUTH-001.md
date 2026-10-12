# TASK LAB002-AUTH-001 — Akun guru dan sesi lokal

Status: READY; DATA-001 validated/CLOSED
Tanggal 2026-10-12. Active owner PM.
Root app D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app.
Sumber PRD R01, UI001 disetujui, local-delivery-contract-v1 C04/C06/C08, delegasi Luna/max/local PM.
Objective login/logout satu akun emailpassword tanpa signup/reset email; semua endpoints bisnis dan output kelak require authentication.
Ownership app auth middleware/util/API/login page/protected home/layout/config/types/package/scriptsaccount/testauth/docs/evidence + reports/AUTH report; no domain/student/attendance features, no DBschema unless minimal auth version field documented and migration owned task.
Implementation choose nuxt-auth-utils official session+hash/verify password (scrypt), exact version compatible majorNuxt4; no OAuth/signup UI. Actor provision/reset owner CLI password generated/interactive (not commandargv), output credentials only ignored .data/private file not log/report. Session secret random envignored, cookie HttpOnly SameSiteLax secure production but HTTP localhost allowed; validate currentteacher/sessionversion each private request so reset revokes old sessions; verify origin on unsafe endpoints/CSRF per frameworkpattern; login throttle non-production storage documented limitation, generic errors not enumerate. No source known creds/sessionpassword. No plaintextpasswordDB. Local config no cloud authSDK. Single teacher enforce provision no silent overwrite; reset explicit CLI owner currentaccount; no empty overwrite. Login UI matchdesign responsive with loading/error/message. Protected pages route middleware plus API guard server; health generic no secret permissible. Header logout and minimal empty state for future modules; no fakeabsensi.
AC01 validlogin/logout/invalid/empty+sessions flow test both API and PM browser.
AC02 unauthbusiness access401/pagesredirect, crosssiteunsafe rejection, passwordhash/cookiesecret notpublic, reset invalidates existing sessions; no register/resetpublic endpoints.
AC03 CLI provision/reset reproducible local only, secretsignored and fixturedata private; actor audited without secrets.
AC04 login HP/laptop same arah UI001, states readable copy no false success; keyboard labels basic.
AC05 auth integration HTTP tests using real localPG and cookiejar, typecheck Vercel/node builds; report actualoutput/bounds no productionPASS.
AC06 docs owner bootstrap/start/reset and AC evidence/unknowns nextPM; no commit/selfclose/cloud.
Stop conditions scope/dependency incompatible/no authutilversion resolve, report PM. Existing docs sync script copiedsource approval remains authority.

Dependency actual: DATAschema teacher_accounts currentlyno authfields; add versionedmigration0002auth passwordhash/sessionversion and anyauthaudit redaction needed. Use currenttyped transactionhelpers. Ownershipall authareas permitted; no conflictingappwriter now. OutputtaskREPORTrequired with actualcookie/crosssite/reset/auth tests. Root user local password must remain ignored .data file; PM can read it for browser without publish.
