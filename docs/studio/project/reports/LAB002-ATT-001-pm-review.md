# Review PM — LAB002-ATT-001

Status PM_VALIDATION; next owner Ardy untuk uji interaksi lokal, PM untuk tindak lanjut hasil uji. Teknis server diterima; belum seluruh AC browser terpenuhi, bukan READY_FOR_ARDY_REVIEW/CLOSED. Git dan final acceptance versi menunggu uji Ardy sesuai instruksi terbaru.

## Pemeriksaan yang selesai

PM membaca migration0004, day snapshot/HMAC, API/validation/transaction/history, UI dan actualdiff. Migration0001–0003 tidak diubah. HMAC atas satu snapshot koheren mencakup timezone/semester/eligibility/roster/routine/exception/attendance/audit; school/class metadata terkunci, save1728->1727->1729 sebelum rowlocks. Payload divalidasi dan saveatomik; clearingNULL hanya manual_clear non-effective, version+1 dan audit old/new, inactiveimmutable. Down menolak historyclear alih-alih menghapusnya.

Review R01: dirty-warning selama save dan menahan navigasi pending. R02: history response diikat capturedscope/sequence. R03: STUDPOST mengambil1728 sebelum SHARE sehingga add yang antre setelah close ditolak409 tanpa orphan. R04: query rule/class memakai kolom schema aktual dan audit eventversion, bukan updated_at yang tidak ada. R05: konflik tetap terlihat sampai GET terbaru berhasil, loadfailure berbeda dariempty, save-success menghapus pesan pending. Perbaikan diperiksa pada source final.

PM test:attendance7/7 exit0; raw app/docs/evidence/LAB002-ATT-001/pm-test-attendance.txt. Executor focused/fullsuite DATA11/AUTH12/STUD-SEM8/CAL5/ATT7, typecheck dan Nodebuild exit0. PM tidak mengklaim menjalankan sendiri fullsuiteATT/build; bukti ini laporan Executor. HTTP mencakup no-writeGET, ownership/origin, invalidbatchrollback, partial/reload/correction/clear/reentry/audit, roster/calendar stale409, future/read-only/DBguard, closerace antre ATTsave+STUDadd409 tanpaorphan, dan downmigrationhistory refusal.

## Browser dan keterbatasan alat

Fixture sintetis3101:3eligibleblank Alya/Bima/Citra, Dimas Future tidakeligible. PM mark-all menjadi3Hdirty; GET tab kedua tetap3blank, membuktikan tanpaautosave. DirtyrouteSiswa memicu nativewindow.confirm. CUA kemudian timeout Emulation.setFocusEmulationEnabled, dan getJsDialog/CDP/Escape/close originatingtab tidak dapat menangani. Tab tambahan dapat membacaDOM tetapi input tidak menjalankan interaksi selama dialog tertahan. Tidak menganggap percobaan click sebagai sukses. Tab tambahan ditutup; tab asal cleanup belum dapat diverifikasi. Tidak mengubahflow untuk menyiasati alat.

Simpan/koreksi/kosongkan/riwayat/409/draftfailure/viewport absensi lengkap belum dibuktikan lewat browser PM; menjadi uji Ardy. Kalender viewport sebelumnya lulus, tetapi bukan bukti viewportATT. AC01/02/04 teknisAPI PASS; AC03/05 interaksi browser sebagian dan pending. Laporan Executor tetapIMPLEMENTED, bukanapprovalArdy.

## Runtime lokal diserahkan

FinalNode build app/.output presetnode-server tanggalUTC2026-10-12T17:37:25.096Z. PersistentserverNode24 PID17520 loopback3000 dan managedPG16port55432. PM memuat envDB/authprivat, akunexisting, kemudian loginpage/loginAPI/schoolAPI/semesterAPI/attendancepage semuanyaHTTP200; sessioncookie tersedia. Tidak mencetakpassword/cookie. Migration0004 applied,0001/2/3 unchanged, backupcustomprivat dibuat sebelumnya, tanpa reset/sekolahseed. Fixture backend akan dihentikan sesuaiownership; runtimeArdy dibiarkan aktif. Tidak ada cloud/Gitcommit/remote/push/deploy.

Panduan local-trial-guide.md memuat URL, lokasi akun privat, langkahuji dan startupulang. Laporan ini menyerahkan versiuntukuji, tidak mengklaim bebasbug atau seluruh PRDv1 selesai. Tindaklanjut dari hasilArdy; tidak assignmentIMP/REP/OPS/taskonline saat ini.
## Hasil uji Ardy dan izin commit lokal — 13 Oktober 2026

Ardy: “commit dulu saja. aku sudah coba untuk flow tidak ada masalah”. Ardy melaporkan uji alur lokal tanpa kendala dan memberi izin commit lokal. Tidak ada rincian skenario/perangkat yang dilaporkan, sehingga catatan ini tidak menyatakan setiap kasus konflik409, kegagalan jaringan atau dialog telah diuji satu per satu. Bukti teknis dan batas uji browser PM sebelumnya tetap dipertahankan.

PM memeriksa 18 file runtime yang berubah terhadap snapshot final fixture ATT: semuanya sama. Tidak ada perubahan kode untuk commit ini dan tidak perlu mengulang suite hanya untuk pencatatan/Git. Commit mencakup kalender, absensi harian, migration0004, regresi penambahan siswa/penutupan semester, tes dan dokumentasi. Rahasia, database, backup, log runtime dan hasil build tetap di luar Git. Tidak ada izin remote/push atau deployment dari pesan ini.
