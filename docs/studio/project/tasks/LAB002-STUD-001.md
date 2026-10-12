# TASK — Sekolah, kelas, dan daftar siswa

Task: LAB002-STUD-001
Status: CLOSED — diterima PM melalui delegasi lokal Ardy
Active owner: PM
Tanggal: 12 Oktober 2026
Tahap: implementasi lokal
Root aplikasi: D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app

## Tujuan dan sumber

Guru dapat mengatur satu sekolah/kelas dan mengelola siswa pada semester yang dipilih. Acuan PRD R01–R03/R15, kontrak lokal C07, UI002 yang diterima PM, DATA001/C04 dan delegasi Ardy. Auth server guard dan konteks audit harus digunakan; body request tidak boleh menentukan actor atau teacher lain.

## Scope dan ownership

Executor memiliki halaman/komponen sekolah dan siswa, API terkait, service/repository yang diperlukan, validasi, tests/fixtures, dokumentasi/evidence STUD dan laporan reports/LAB002-STUD-001-report.md. Package/config umum hanya jika diperlukan, dilaporkan sebelum perubahan dependency. Tidak menimpa PM docs atau pekerjaan lain.
Identitas sekolah berisi nama, kelas dan timezone valid IANA default Asia/Jakarta. Satu akun/satu sekolah/satu kelas. Tidak otomatis menanam data contoh sebagai data guru. Logo akan diintegrasikan OPS; slot tampilan tidak mengklaim upload berfungsi.
Daftar siswa per semester menggunakan snapshot; hanya nama wajib, NIPD/JK opsional. Nama sama diperbolehkan sebagai individu berbeda. Tambah/edit dengan tanggal masuk/keluar inklusif di dalam periode. Jangan hard-delete siswa yang memiliki absensi/audit. Perubahan tanggal yang mengecualikan catatan lama ditolak sesuai guard DATA; pesan menjelaskan penyebab tanpa menghapus data.
Jika belum ada semester, halaman memberi langkah membuat semester; implementasi create semester menjadi SEM001 berikutnya. Verifikasi STUD menggunakan fixture lokal tersendiri agar tidak membuat data pengguna palsu. Aktif dan arsip dipilih secara jelas; arsip hanya baca. Nama/NIPD/JK pada semester lain tidak berubah ketika identitas aktif diperbaiki. Daftar HP kartu dan desktop tabel mengikuti UI002, mencari nama/NIPD serta form berlabel. Input tetap saat validasi gagal, sukses hanya setelah transaksi server berhasil. Seluruh route privat memakai AUTH protection dan origin guard pada write.

## AC dan pemeriksaan

AC01: metadata valid tersimpan; tidak ada sekolah/kelas kedua; timezone invalid ditolak; unauthenticated read/write ditolak.
AC02: nama wajib, optional kosong dan nama sama berhasil; tanggal batas inklusif benar; validation error tidak mencatat sebagian data.
AC03: perubahan semester aktif tidak mengubah snapshot arsip; tanggal yang menghapus kewajiban pada recorded attendance ditolak; closed write ditolak backend.
AC04: audit mencatat actor guru tanpa secret; request actor/semester di luar kepemilikan ditolak; seluruh operasi parameterized dan transaksi.
AC05: UI HP/laptop dapat digunakan untuk tambah/edit/cari dengan copy dan state benar; PM browser memeriksa fixture fiktif.
AC06: tests HTTP/data yang bermakna, typecheck/build, laporan actual files/commands/evidence/batas dan next PM. Tidak menyatakan logo, impor atau semester baru berfungsi sebelum task terkait.

## Batas

Tidak impor Excel, absensi, PDF, upload logo, create/closure/copy semester, cloud/deploy/remote/push. Executor tidak menerima task sendiri atau commit. Ketika laporan selesai, PM menguji independen dan dapat menerima/commit lokal atas delegasi. Dependency AUTH001 dan DATA001 wajib diterima, UI002 tersedia. Task menjadi READY setelah dependency itu diperiksa.


## Readiness dan assignment lokal — 12 Oktober 2026

Sumber terbaru Ardy: “ya lanjutkan kembali semua tasknya”. Delegasi lokal sebelumnya tetap berlaku: PM memilih keputusan/detail, mengikuti Executor Luna/max, menguji dan menerima hasil lokal; Git commit lokal tanpa remote. DATA dan AUTH telah diterima, commit AUTH 0ec7f37. STUD memenuhi readiness implementasi lokal. Satu penulis app pada tahap ini; SEM/fitur lain setelah acceptance dependency.

Navigasi task STUD menampilkan hanya fitur yang sudah tersedia: Data sekolah, Siswa dan Keluar. Link menuju pembuatan semester boleh menjelaskan bahwa belum tersedia pada tahap ini, tanpa tombol palsu. Jangan implementasikan SEM diam-diam. Area UI bersama app/pages/index.vue dan CSS boleh berubah dalam STUD agar home mengarahkan ke setup/data. Laporan wajib memisahkan hasil fixtures dari data persisten (tetap kosong selain akun).



## Acceptance PM

12 Oktober: AC01–AC06 dipenuhi untuk STUD lokal. Suite independen DATA6/AUTH12/STUD7 dan typecheck exit0; browser desktop/viewport390×844 untuk metadata, validasi, tambah/edit/cari, optional kosong, NIPD nol depan, tanggal inklusif dan arsip hanya baca lulus. Build Vercel terbaru sesudah copy lulus menurut laporan Executor. Migration/dependency tidak berubah. PM menerima dan menutup task sesuai delegasi Ardy; bukan pengujian atau approval langsung Ardy. Fixture berhenti; folder sementara tetap tersimpan karena penghapusan ditolak kontrol eksekusi. Tidak ada cloud/deploy/remote/data asli. PM menyiapkan commit lokal; next SEM readiness.
