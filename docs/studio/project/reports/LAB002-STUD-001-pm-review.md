# Review PM — LAB002-STUD-001

Tanggal: 12 Oktober 2026. Status: pemeriksaan berjalan; belum acceptance. Acuan STUD, PRD R01–R03/R15, C07/C08, UI002, AUTH/DATA accepted, delegasi lokal Ardy.

PM membaca source API sekolah/siswa/semester, repository dan UI. Pemeriksaan awal memadai: join kepemilikan sekolah, actor dari sesi, transaksi audit, snapshot semester, field berlabel, GET gagal tidak menampilkan form sekolah kosong untuk overwrite. Migration lama tidak diubah.

Temuan sebelum tes final:

1. Optional NIPD dengan tipe selain teks berpotensi menjadi null dan menghapus nilai saat PATCH. Timezone bertipe salah berpotensi memakai default. Executor memperbaiki validasi 422; default hanya untuk field yang tidak diberikan.
2. Pesan error UI berpotensi menampilkan FetchError internal. Executor membatasi pesan pada respons server yang aman atau fallback pengguna.
3. Form masih dapat diubah saat request berjalan. Executor mengunci isian selama simpan agar perubahan baru tidak tertimpa respons lama.
4. Form siswa terbuka saat semester diganti berpotensi memakai semester berbeda. Executor mengunci pemilih/context form, memeriksa semester sebelum simpan dan mengabaikan respons daftar yang kedaluwarsa. Label Arsip hanya untuk semester closed, bukan seluruh baris saat form aktif.

Laporan Executor: suite HTTP awal melewati tujuh subtes menggunakan PostgreSQL sementara/root Nuxt terisolasi. Ini belum hasil independen PM. Tes sedang diperkuat; typecheck/build/browser final masih menunggu source stabil.

Next owner Executor untuk laporan final, lalu PM mengulang checks relevan dan menguji browser HP/laptop sebelum acceptance/commit. Tidak ada cloud, data siswa asli, atau fitur semester/impor/absensi/logo yang dianggap tersedia.

## Hasil independen PM

PM menjalankan npm test pada source stabil: exit 0, DATA 6/6, AUTH 12/12, STUD 7/7. Typecheck independen exit 0. Bukti disimpan pada app/docs/evidence/LAB002-STUD-001/pm-test-all.txt dan pm-typecheck.txt. Percobaan pertama mengalihkan output gagal karena folder evidence belum dibuat; perintah tes belum berjalan pada percobaan itu. PM membuat folder lalu menjalankan suite yang benar-benar lulus. Tidak menganggap exit wrapper pertama sebagai PASS tes.

Browser pada fixture PostgreSQL terpisah di port 3101: login dan navigasi, timezone invalid dengan isian tetap, simpan sekolah/reload, tambah siswa dengan optional kosong, cari nama/NIPD, edit NIPD 00077 dan gender, reload persist, pilih arsip hanya baca, form mengunci semester. Pada viewport 390x844 daftar menjadi kartu dan form tetap dapat diisi; tanggal keluar 12 Oktober tersimpan dan siswa masih aktif pada tanggal itu (inklusif). Desktop menggunakan lebar 1280. Ini bukan uji perangkat HP fisik atau data sekolah nyata.

PM menemukan layout belum tersambung; Executor memasang NuxtLayout dan mengecualikan login sebelum suite/build terbaru dan review browser. Copy tanggal terakhir diperbaiki menjadi “Tanggal masuk dan keluar termasuk dalam masa terdaftar.” dan kalimat baru diamati langsung di browser. Perubahan copy tidak mengubah perilaku; suite tidak diulang untuk satu kalimat itu. Build terbaru setelah copy tetap perlu dicatat dari hasil Executor.

Tindak lanjut QA/REL: scripts/smoke-http.mjs merupakan skrip tahap SET yang masih mengharapkan home anonim tanpa form, sehingga tidak menjadi bukti runtime AUTH/STUD. QA/REL harus memperbaruinya atau menggantinya dengan pemeriksaan sesuai flow login aktual. Ini tidak menggantikan suite HTTP AUTH/STUD yang sudah lulus.

| AC | Bukti PM |
|---|---|
| AC01 | HTTP sekolah/akses/timezone/satu kelas; browser invalid/simpan/reload |
| AC02 | HTTP optional/nama sama/tanggal/rollback; browser tambah optional kosong |
| AC03 | HTTP snapshot arsip/guard absensi/closed; browser arsip tanpa edit |
| AC04 | Source join kepemilikan/actor dari sesi/transaksi; HTTP foreignID/audit/override |
| AC05 | Browser desktop dan viewport HP untuk tambah/edit/cari/persist/state/formscope |
| AC06 | Suite dan typecheck independen; output build/laporan diperiksa; batas jelas |

Next owner PM setelah build/cleanup laporan final. Task belum diberi acceptance sebelum bukti terakhir tersebut tersedia. No cloud/deploy/remote/data asli.

## Keputusan PM

AC01–AC06 terpenuhi dan STUD-001 diterima/CLOSED menurut delegasi lokal Ardy. Build Vercel ulang setelah copy dilaporkan exit0, 17,5 detik. Fixture server dan PostgreSQL disposable dihentikan melalui identitas proses/path yang diverifikasi; managed PostgreSQL tidak pernah dijalankan oleh task STUD. Penghapusan folder fixture dilaporkan ditolak kontrol eksekusi; folder stopped tetap privat/ignored .data dan tidak dicoba lewat mekanisme lain. Batas ini tidak mengubah bukti data atau acceptance; tidak ada klaim folder terhapus.

Next PM: commit lokal lalu SEM-001. scripts/smoke-http.mjs perlu diperbaiki pada QA/REL sesuai flow login sekarang. Tidak ada logo/semester-create/absensi/impor/laporan tersedia dari STUD.
