# Rencana Verification dan Uji Ardy — LAB-002

Pemilik: Project Manager. Tanggal: 2026-10-11.
Sumber: [PRD](<../product/PROD-002-product-prd-v1.md>), [rencana](<development-plan-v1.md>), [task](<tasks.md>), dan keputusan aktif yang kelak dicatat pada [konfirmasi](<decisions-and-confirmations.md>).

Kondisi: skenario direncanakan; belum ada aplikasi, environment atau hasil uji. Semua bukti di bawah belum tersedia. Perintah test/build dan fixture actual ditetapkan setelah stack/codebase dipilih; tidak mengarang script yang belum ada.

## Pemilik dan jenis bukti

- Executor: test/check teknis task sendiri, inspection artefak desain/render, laporan self-check serta command/output/versi yang benar-benar dijalankan.
- PM: membaca actual diff/file, membandingkan AC/flow/kontrak/hasil test, menjalankan pemeriksaan teknis non-production terkait dan menentukan revisi. Laporan Executor saja bukan validation.
- Ardy/guru sesuai penugasan Ardy: uji penggunaan nyata browser HP/laptop dan hasil cetak fisik. PM menyiapkan langkah dan expected; PM tidak melakukan E2E tanpa diminta.
- Product Manager: review goal/UX/copy dari PRD dan bukti hasil, setelah kebutuhan evidence memadai. Final approval/closure/deployment tetap Ardy.

Jika required evidence Ardy belum ada, task terkait tetap PM_VALIDATION dengan daftar AC pending. READY_FOR_ARDY_REVIEW hanya setelah seluruh AC wajib terbukti. Build tidak membuktikan alur atau hasil cetak.

## Data contoh yang perlu disiapkan

Seluruh nama/NIPD/logo uji fiktif. Siapkan: dua siswa bernama sama, NIPD/JK kosong, siswa masuk/keluar di tengah periode, siswa H/S/I/A/belum diisi, hari rutin/libur/hari sekolah khusus, periode yang mulai/berakhir di tengah bulan, bulan dengan jumlah hari berbeda, semester tertutup, dan daftar cukup panjang untuk memerlukan lebih dari satu halaman laporan.

Fixture harus membedakan catatan efektif dan riwayat, serta data periode lama dan baru. Format dan expected boundary mengikuti keputusan C03/C05/C07, bukan asumsi pada test. Data PDF referensi tidak disalin sebagai data aplikasi.

## Skenario teknis Executor dan PM

| ID/task | Trigger | Expected dan evidence |
|---|---|---|
| V01 AUTH | Akses page/write/print/PDF tanpa sesi atau sesi berakhir | Ditolak sesuai kontrak; tidak ada leak akun/secret/data siswa. Bukti auth/authorization test |
| V02 STUD/IMP | Nama kosong; NIPD/JK kosong; nama berulang | Nama wajib; optional boleh kosong; duplikat perlu keputusan guru; tidak overwrite siswa berbeda |
| V03 IMP | Excel invalid/baris invalid; preview→commit; submit berulang | Error/hasil sesuai C03; keputusan preview dipertahankan sesuai kontrak; tidak terjadi commit ganda diam-diam |
| V04 STUD/DATA | Tanggal masuk/keluar/ubah identitas; semester baru | Kewajiban dan identitas mengikuti kontrak; arsip sebelumnya tidak berubah |
| V05 CAL | Hari rutin + libur + sekolah khusus | Kewajiban relevan dan exclusion total benar; tidak mengisi Alpa pada libur |
| V06 CAL/ATT | Tanggal berabsensi jadi libur | Perlu konfirmasi; catatan lama retained as history, tidak dihitung efektif; restore mengikuti keputusan yang kelak dipilih |
| V07 ATT | Buka tanggal kosong; tandai hadir; ubah S/I/A; simpan parsial | Membuka tidak menyimpan; status/partial count benar setelah persist; kosong tidak A |
| V08 ATT | Save gagal/navigasi tanpa simpan/dua perangkat mengubah data sama | Perilaku sesuai C06; tidak fake success atau silent overwrite; evidence transaction/concurrency |
| V09 ATT/DATA | Koreksi sebelum closure | Audit old/new/time/actor sesuai C08, total berubah sesuai status efektif, riwayat tidak dihitung ganda |
| V10 SEM | Tutup lengkap/incomplete | Manual; incomplete confirm; setelah close seluruh jalur write yang terkait ditolak backend |
| V11 SEM | Salin daftar lama atau buat baru | Keanggotaan baru benar; identity/absence arsip lama tetap; tidak menyalin absensi lama menjadi data baru |
| V12 REP | Bulanan/semester, sebagian periode dan incomplete | Total S/I/A tepat, blank tidak A/tidak ada penanda tambahan, filter bulan/tanggal benar sesuai C05 |
| V13 REP | PDF/browser layout, daftar panjang, ketiga ukuran | Semua kolom/baris relevan lengkap dan readable; F4 21,6×33 cm landscape; pagination sesuai desain/kontrak |
| V14 REP/OPS | PDF gagal/akses output/logo/log | Error jelas; tidak menghasilkan sukses palsu; output terlindungi, log tidak bocorkan data yang tidak diperlukan |
| V15 OPS | Backup→restore non-production | Data efektif/riwayat/arsip/logo dapat dipulihkan pada versi/target yang ditetapkan; laporan evidence, batas dan waktu actual |
| V16 REL | Build/package source vs runtime | Runtime punya assets/migrations/dependencies yang diperlukan; docs/evidence tetap Git source; exclusions benar; no deploy otomatis |

Pilih automated checks yang bermakna untuk business rules/date/lock/transaction dan regression; tidak membuat test yang hanya meniru UI atau menandai semuanya PASS. Tool/test yang belum tersedia ditulis belum tersedia, bukan lulus.

## Skenario penggunaan Ardy

Prasyarat semua skenario: versi/ref dan environment lokal/non-production yang diotorisasi, URL cara akses, akun uji tanpa secret di dokumen, fixture fiktif, cara reset fixture yang aman, browser/perangkat/ukuran kertas dicatat. Saat ini prasyarat belum tersedia.

| ID | Langkah utama | Hasil yang perlu diamati |
|---|---|---|
| U01 | Masuk di HP lalu laptop; lihat kelas/data sama | Sesi dan data tersedia; tidak ada register umum; layout terbaca tanpa menghalangi aksi utama |
| U02 | Unduh template; isi nama + optional kosong/nama sama; upload dan periksa | Preview/baris bermasalah serta tambah berbeda/lewati jelas; hasil sesuai pilihan guru |
| U03 | Tambah/edit siswa dengan tanggal masuk/keluar; lihat hari terkait | Hanya siswa yang wajib muncul/dihitung sesuai masa terdaftar; riwayat tetap |
| U04 | Buka hari baru; tandai semua hadir; ubah S/I/A; simpan | Tidak ada status tersimpan hanya karena membuka; data tercatat setelah sukses dan dapat dibaca kembali |
| U05 | Simpan sebagian lalu lanjut pada perangkat lain | Count belum diisi benar; status sebelumnya tetap dan bisa dilanjutkan; rekap tidak menganggap kosong A |
| U06 | Ubah kalender berabsensi menjadi libur | Konfirmasi dampak terlihat; hasil dan rekap sesuai; audit lama dapat ditelusuri |
| U07 | Koreksi status pada semester belum ditutup | Feedback dan riwayat jelas; laporan memakai nilai baru |
| U08 | Tutup semester yang masih incomplete setelah konfirmasi | Tidak bisa koreksi; masih bisa melihat dan mencetak; pilihan konfirmasi tidak disamarkan |
| U09 | Buat semester baru dari daftar lama, kemudian edit daftar baru | Arsip absensi/identitas semester lama tetap; alur jelas |
| U10 | Pilih bulan/semester, kertas, cetak browser dan unduh PDF | Struktur/logo/periode/total sesuai; sel incomplete kosong tanpa penanda; output dapat dibuka |
| U11 | Cetak contoh yang lebih dari satu halaman pada A4/F4/Letter sesuai alat yang tersedia | Tidak ada kolom/baris hilang/terpotong; nama/status cukup terbaca; ukuran dan printer dicatat |

U11 hasil fisik belum bisa disimpulkan dari render PDF. Jika guru/printer tidak mendukung salah satu ukuran, catat bukti belum tersedia/limitasi dan minta keputusan Ardy, jangan mengurangi AC diam-diam. Tidak ada klaim semua perangkat/browser telah diuji.

## Form evidence dan revision

Catat tiap skenario: task/AC, versi/ref, environment/browser/perangkat/kertas, prasyarat, langkah, expected, observed, bukti, PASS/FAIL/pending, pelaksana dan tanggal. Screenshot tidak perlu memuat secret/PII asli.

Jika gagal: PM menyebut expected/observed dan AC spesifik; revision sesuai task asal, scope dan pilihan Executor yang sudah diotorisasi. Masalah di luar scope menjadi usulan task. Setelah dua percobaan perbaikan masalah sama tanpa kemajuan terbukti, PM kembali ke Ardy sesuai workflow.

## Review tujuan produk

Product Manager memeriksa apakah input langsung mengurangi kebutuhan penyalinan ulang, laporan sesuai bentuk dan kebutuhan guru, navigasi/state/copy terbaca pada HP/laptop, serta keterbatasan terlihat. Ukuran waktu/penghematan belum disepakati dan tidak diklaim. Bukti minat/penggunaan pasar berbeda dari technical delivery.

Setelah hasil teknis dan uji nyata memenuhi syarat, PM menyiapkan review akhir; keputusan Ardy dicatat terpisah dari task lifecycle. Brief branding, publikasi dan deployment hanya mengikuti penugasan/approval berikutnya.

## Penugasan bukti lokal terbaru — 12 Oktober 2026

Ardy mendelegasikan uji browser/end-to-end lokal kepada PM, keputusan penerimaan/closure dan assignment Luna/max. Ini menggantikan default owner Ardy untuk pengujian lokal sampai sasaran aplikasi lokal terpenuhi. Fisik printer, cloud, deploy dan penggunaan guru nyata tetap belum dilakukan. SET/UI001 sudah CLOSED; DATA/UI002 sedang assignment. Kontrak lokal v1 merinci aturan dan boundary.
