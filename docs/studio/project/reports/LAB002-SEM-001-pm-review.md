# Review PM — LAB002-SEM-001

Tanggal: 12 Oktober 2026. Keputusan: APPROVED melalui delegasi PM lokal Ardy; task CLOSED setelah delivery dokumentasi/commit lokal selesai. Bukan pengujian Ardy atau penggunaan sekolah nyata.

## Hasil pemeriksaan

PM membaca source, perubahan aktual, laporan Executor, dan AC. Revisi R01: race HTTP membuktikan deadlock antara edit membership dan penutupan. Endpoint STUD kini mengambil lock sekolah sebelum row lock. PM menjalankan ulang suite STUD/SEM final: 8/8, exit 0; hasil mentah app/docs/evidence/LAB002-SEM-001/pm-test-students-final.txt. Suite penuh PM sebelumnya lulus DATA11/AUTH12/STUD-SEM8 (pm-test-all.txt); suite penuh setelah fix, typecheck dan kedua build dilaporkan lulus Executor.

R02: beranda masih menyebut pembuatan semester belum tersedia. Executor memperbaiki bantuan dan menambah tautan Kelola semester. PM memeriksa template/tujuan /semesters; typecheck lulus menurut Executor. Fixture browser memakai build sebelum revisi R01/R02, sehingga pemeriksaan runtime terbaru R01 berasal dari tes HTTP, R02 dari source/typecheck. Tidak mengklaim browser menjalankan build final.

| AC | Pemeriksaan dan hasil |
|---|---|
| AC01 | PASS. HTTP menguji validasi tahun/periode, overlap, satu aktif, batas membership/riwayat. Browser menolak tahun2026/2028 sambil mempertahankan tanggal; create valid berhasil. Ubah mulai11Okt menjadi12Okt ditolak karena mengecualikan siswa; reload tetap11Okt. |
| AC02 | PASS. Browser preview29hari sekolah,87sel wajib,4terisi,83kosong; kosong bukanAlpa. Konfirmasi eksplisit menutup dan menjadikan arsip; tombol edit/tutup hilang. Token basi/closed write dan race diuji HTTP/database. |
| AC03 | PASS. Browser semester baru salin2siswa dari semester yang ditutup, satu siswa keluar sebelum batas tidak ikut; daftar Siswa menunjukkan2. Tes memastikan tanpa attendance dan snapshot sekolah/kelas/siswa tidak berubah. |
| AC04 | PASS untuk desktop1280x900 dan viewportHP390x844. Dialog peringatan/aksi terbaca dan muat; gagal mempertahankan input, sukses setelah server; status aktif/arsip jelas. Batas revisi beranda diperiksa source/typecheck, bukan browser build final. HP fisik belum diuji. |
| AC05 | PASS. PM full suite sebelumnya dan STUD/SEM final independen; Executor full suite/typecheck/Vercel+Node builds final lulus. Migration0001/0002 tidak berubah, tidak ada dependency runtime baru. |

## Batas dan checkpoint

Tidak ada cloud, deployment, remote/push atau data siswa asli. Migration0003 tersedia namun belum diterapkan pada database persisten; tes memakai cluster terisolasi. Sebelum menjalankan aplikasi persisten pada resume, jalankan migrasi versioned sesuai README tanpa reset data. CAL/ATT/IMP belum diimplementasikan; regresi seluruh jalur tulis masa depan sesudah close tetap wajib QA. Tidak ada reopen semester.

Ardy meminta berhenti sesudah SEM CLOSED. Tidak ada assignment berikutnya. Resume membaca resume-checkpoint.md, memeriksa delta Git/instruksi, lalu PM menentukan readiness berikutnya setelah pembahasan Ardy.
