# Review PM — LAB002-CAL-001

Hasil teknis: AC01–AC05 PASS; dependency kalender diterima untuk ATT. Status task PM_VALIDATION, next owner PM untuk paket uji lokal. Git/commit dan pembahasan online ditunda sesuai instruksi terbaru Ardy; tidak mengklaim CLOSED sementara handoff versi lokal masih dipersiapkan.

PM memeriksa actual source/API/transaksi/UI dan laporan Executor. R01: freeze navigasi tanggal/bulan selama write/reload serta respons memakai state request. R02: bulan awal mengikuti batas semester bila today di luar periode. R03: empty-state tidak menjanjikan browse kalender arsip yang belum ada. Revisi diterapkan dan source final diperiksa.

PM menjalankan test:calendar independen5/5 exit0; raw evidence app/docs/evidence/LAB002-CAL-001/pm-test-calendar.txt. Executor full suite DATA11/AUTH12/STUD-SEM8/CAL5, typecheck dan Vercel/Node builds exit0; build terisolasi dan runtimeVercel24. Migration0001–0003/dependency runtime tidak diubah.

Browser PM desktop1280x900 dan viewportHP390x844 memakai fixture sintetis terisolasi port3101, bukan database persisten. Login/nav/beranda/kalender tersedia. Tanggal12Okt2026 dengan1H: ubah libur meminta konfirmasi history1/effective1, setelah konfirmasi statusLibur/history1/effective0. Restore hari khusus memberi peringatan tidak memulihkan absensi; setelah konfirmasi effective tetap0. Form invalid28Sep di luarsemester mempertahankan tanggal dan pilihan libursemua; valid13Okt all-off tersimpan, reload memperlihatkan semua hariLiburrutin dan tujuhcheckboxkosong. DialogHP terbaca dan aksi dapat dipakai. Browser telah ditutup dan viewport reset.

AC01 akses/DOW/unset-alloff PASS viaHTTP/browser; AC02 atomic/history/period PASS viaHTTP/browser; AC03 staleconfirmation/exclude/restoreblank PASS viaHTTP/browser; AC04 closednote-only409/readonly/noauditGET PASS viaHTTP, failureinput via browser; AC05 tests/typecheck/build/browser PASS sesuai bukti dan batas di atas.

Batas: HP fisik, cloud, teacherUAT, ATT/IMP future endpoint belum diuji. Tidak menganggap build sebagai deployment. Tidak ada commit/push/remote atau data siswa nyata. Fixture proses diminta dihentikan hanya dengan ownership terdaftar; managedPG55432 tetap aktif untuk deliverylokal.

Next: ATT preflight/implementasi setelah readiness, lalu PM validation/integrasi/runtime/handoff uji Ardy. Calendar technically accepted tidak berarti seluruh versi absensi siap.
