# LAB002-REP-001 — Preflight laporan

Tanggal: 15 Oktober 2026. Status: CLOSED untuk subtask preflight-only. PM menerima hasil berdasarkan delegasi lokal Ardy, setelah membaca laporan dan mencocokkan source view effective_attendance, snapshot arsip serta pola API semester. Tidak ada kode yang diimplementasikan atau diuji pada tahap ini. Laporan: reports/LAB002-REP-001-preflight.md. Owner berikutnya: PM untuk REP-001A.

Kesiapan diperiksa PM sebelum dispatch: READY untuk preflight-only. Assignment aktual: /root/lab002_rep_preflight, Codex worker gpt-6-luna/max. ACK diterima. Task induk REP-001 tetap ANALYSIS sampai readiness implementasi diperiksa.

## Tujuan dan sumber

Rinci implementasi lokal laporan bulanan/semester dari PRD R11–R14, task induk REP-001, desain UI-002 dan kontrak lokal C05. Ardy meminta melanjutkan task setelah menyatakan guru telah memakai absensi online tanpa masalah. Konfirmasi itu adalah bukti penggunaan alur inti yang dilaporkan Ardy, bukan pengujian semua state atau fitur laporan.

Root dokumentasi: D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa.
Root kode: subfolder app, checkout develop. Main adalah rilis bersih; jangan checkout/merge/push main.

## Tahap dan batas

Preflight dan laporan saja; belum mengubah source, dependency, database atau konfigurasi. Baca instruksi yang berlaku, desain UI-002/README, PRD, kontrak lokal, source repository attendance/calendar/semester/snapshot serta shell UI terkait. Jangan membaca credential, .data, Excel/data guru, atau mengakses layanan online. Gunakan sumber sintetis bila ilustrasi diperlukan.

Delegasi lokal Ardy 12 Oktober tetap berlaku: Codex subagent gpt-6-luna / max; PM mengatur dan memvalidasi. Konfigurasi tidak diganti sepihak.

## Acceptance criteria

1. Petakan path aktual sumber data, proteksi akun, snapshot semester tertutup, kalender dan keanggotaan ke model laporan. Rekap S/I/A hanya status efektif pada hari sekolah dalam periode serta masa terdaftar; kosong bukan Alpa. Kolom tetap 1–31 dan sel nonberlaku kosong, tanpa penanda tambahan/tanda tangan.
2. Periksa desain laporan yang telah disetujui dan identifikasi gap implementasi secara konkret, tanpa mengubah flow. Bulanan dan semester berupa kumpulan tabel bulanan; header berulang, baris siswa utuh, nama panjang tidak terpotong; A4/F4 21,6×33/Letter landscape.
3. Susun pembagian implementasi yang bisa diuji lokal, dependency (termasuk logo privat), endpoint/model/UI yang diusulkan, AC/verification dan urutan. Bedakan browser print dan PDF download nyata. Kontrak lokal memilih PDFKit; tidak memasang/mengganti paket pada preflight. Identifikasi versi/kompatibilitas sebagai kebutuhan verifikasi implementasi, jangan mengarang hasil.
4. Rinci loading, kosong, gagal, pilihan periode/kertas, akses ditolak, dan perilaku HP/laptop mengikuti pola existing. Tentukan cara uji data sintetis, angka rekap, pagination, serta regresi absensi. Tidak menambah writer ke data absensi.
5. Laporkan konflik/unknown yang benar-benar memblokir dan rekomendasi. Jangan menganggap task OPS historis lengkap tanpa bukti; pisahkan dependency yang sudah relevan dari pekerjaan operasional lain.

## Deliverable dan verifikasi

Tulis hanya reports/LAB002-REP-001-preflight.md. Sertakan Git state, acuan yang dibaca, hasil per AC, path evidence, rencana file yang akan disentuh, risiko dan next owner PM. Tidak menjalankan suite/build karena belum ada perubahan kode; klaim hanya inspeksi yang benar-benar dilakukan. Tidak commit/push/deploy/akses cloud. Executor tidak menutup task.
