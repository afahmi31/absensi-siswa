# LAB002-PRE-001 — Pemeriksaan PM

13 Oktober 2026. Status task PM_VALIDATION. Hasil tahap persiapan kode lokal: PASS; kesiapan cloud/release belum disimpulkan.

Acuan: task PRE-001, keputusan Session pooler satu koneksi per instance dari Ardy, laporan preflight beserta addendum implementasi, source/diff aktual. Executor online_preflight, Codex GPT-6-luna/MAX. Baseline sebelum perubahan main 2ac5cdb.

PM mengulang scripts/test-data.mjs pada Node24: 13/13 PASS, exit0; scripts/test-auth.mjs: 14/14 PASS, exit0. Data sintetis pada cluster disposable, bukan database guru. Cakupan hak minimum/API denial/RLS, audit/calendar/closure, login/sesi/logout/reset dan throttle serentak. PM memeriksa actual diff dan git diff --check PASS. Perubahan FOR SHARE pada akun menjadi baca versi menjaga akun read-only; stale session ditolak melalui versi akun.

Executor melaporkan typecheck dan build Vercel staging PASS. PM memeriksa metadata staging .vercel/output/functions/__fallback.func/.vc-config.json: nodejs24.x. Folder staging privat verify-a26def44-c1ff-4227-8c6e-c2d8c4d965ff-RdmPh1 pada app/.data/tests. Instalasi remote Vercel belum diuji.

TLS endpoint sebelumnya diperiksa dengan CA/hostname yang benar dan penolakan hostname salah. Metadata cloud diperiksa ulang: project absensi-siswa/jkiewjlohgmsujcwerpi ACTIVE_HEALTHY, PG17.11, tabel public dan migrationhistory kosong. Tidak ada write cloud dalam pemeriksaan ini.

Belum terverifikasi: bootstrap role/ACL aktual dan migration/rehearsal PG17, pemindahan lengkap database guru, perbandingan data target, proxy IP/session/login aktual pada Vercel, log install npm/Corepack serta UAT online. Header sintetis pada HTTP test hanya memeriksa cabang kode; bukan bukti proxy Vercel. Runtime lokal aktif masih menggunakan build sebelumnya; source dan data guru tidak diganti.

Keputusan PM: lanjutkan persiapan alat transfer lokal dalam CLOUD-DATA-001. PRE-001 belum CLOSED dan tidak memberikan izin deployment. Pertahankan backup/database lokal; release masih memerlukan versi dan target Vercel yang konkret sesuai workflow. Next owner Executor untuk alat transfer lokal, PM untuk pemeriksaan dan keputusan operasional cloud.
