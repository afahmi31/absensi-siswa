# Review dan revisi PM — LAB002-AUTH-001

Tanggal: 12 Oktober 2026. PM menggunakan delegasi pengelolaan dan pengujian lokal dari Ardy. Status: CLOSED — diterima PM berdasarkan delegasi lokal Ardy; rincian revisi di bawah adalah riwayat pemeriksaan.

Acuan: task AUTH-001, PRD R01, kontrak lokal C04/C08, desain UI-001, workflow studio dan delegasi lokal. Executor tetap /root/lab002_data001, gpt-6-luna/max.

## Hasil yang diamati PM

Browser memakai aplikasi portable Node pada http://127.0.0.1:3101 dengan PostgreSQL sementara dan akun fiktif. Kredensial akun persisten tidak dibaca atau ditampilkan.

- Halaman privat mengarahkan pengunjung tanpa sesi ke /login.
- Form kosong menampilkan pesan email/kata sandi dan memfokuskan email.
- Password salah menampilkan pesan umum tanpa mengungkap keberadaan akun.
- Login valid membuka halaman terlindungi; sesi tetap aktif setelah reload.
- Logout kembali ke login; membuka halaman privat sesudah logout kembali diarahkan ke login.
- Alur login/logout berjalan pada layar laptop dan viewport HP 390 × 844. Form dan tombol terbaca; ini bukan uji perangkat HP fisik.
- Cuplikan screenshot tersimpan di app/docs/evidence/LAB002-AUTH-001/pm-login-mobile.jpg. Gambar sengaja beresolusi kecil; pengamatan utama memakai screenshot browser asli.

## R1 — Pengujian independen berhenti karena batas waktu

AC05. PM menjalankan npm test menggunakan Node 24.19.0/npm CLI 10.9.3. DATA lulus 6/6. AUTH melewati tes throttle, tetapi tes HTTP utama mencapai timeout 180 detik dan runner tidak segera selesai. Laporan PASS Executor sebelumnya tidak menggantikan kegagalan ini.

Kemungkinan benturan dua Nuxt dev yang berbagi .nuxt masih hipotesis, belum penyebab terkonfirmasi. Selain itu, spawn stdio ignore membuat pengumpul diagnostik tidak menerima output. Fetch belum dibatasi waktu sendiri. Script npm test memanggil npm lain melalui PATH dan mengambil npm global 8; jalur tersebut perlu dirapikan.

Expected: suite selesai atau gagal dengan diagnostik yang aman dan membersihkan hanya resource miliknya. Suite tidak mengharuskan PM menghentikan dev server pengguna.

Batas revisi: isolasi build/cache test; batasi fetch; aktifkan capture child output dengan redaksi; perbaiki urutan runner tanpa nested npm global. Bersihkan hanya proses/cluster disposable yang diketahui milik tes. Jangan ubah aturan auth atau menurunkan AC. Verifikasi ulang AUTH dan regresi DATA; periksa typecheck/build bila source terkait berubah.

## R2 — Copy halaman awal

AC04. Judul 'Fondasi aplikasi sedang disiapkan.' memakai istilah development. Ganti judul dengan 'Absensi kelas'; pertahankan pesan jujur 'Pengisian absensi belum tersedia.' Tanpa menambahkan fitur atau data absensi palsu.

## Keputusan sesi per perangkat

PM memilih record sesi server-side dalam migration 0002 yang belum diterapkan saat keputusan dibuat. Logout mencabut sesi perangkat itu saja; reset owner mencabut semua sesi lama. Ini mempertahankan penggunaan HP dan laptop tanpa logout saling mengganggu. Worker melaporkan tes dua sesi lulus; masih perlu hasil pengujian ulang independen yang lengkap.

Next owner: Executor untuk revisi, lalu PM memeriksa hasil terbaru sebelum acceptance dan commit lokal.

## Hasil pengujian ulang PM

R1 diperbaiki: tes menggunakan salinan aplikasi di .data/tests/nuxt-root-* dan junction node_modules yang dilepas sebelum cleanup. Seluruh request fetch dibatasi waktu; child stdout/stderr dikumpulkan dengan redaksi. Urutan tes memakai process.execPath, tanpa npm global bersarang. R2 diperbaiki: halaman awal berjudul 'Absensi kelas'. PM memeriksa source perubahan.

PM menjalankan ulang npm test menggunakan Node 24.19.0/npm CLI 10.9.3. Hasil exit 0: DATA 6/6 dan AUTH 12/12. Dev server reguler tersedia pada port 3000 selama tahap pengujian ulang dan tetap dapat dibuka setelahnya. Typecheck PM juga exit 0. Evidence: app/docs/evidence/LAB002-AUTH-001/pm-test-all.txt dan pm-typecheck.txt. Browser pada dev server reguler setelah pengujian masih mengarahkan halaman privat ke login.

Build Vercel dan portable Node terbaru lulus menurut output Executor yang dibaca PM. PM membaca metadata function .vercel/output/functions/__fallback.func/.vc-config.json: runtime nodejs24.x. Salah baca path metadata setelah build oleh wrapper Executor menghasilkan exit wrapper 1; log build menyatakan build complete dan pembacaan ulang path yang benar berhasil. Tidak disamakan dengan kegagalan build.

Penyebab timeout awal belum dibuktikan sepenuhnya; benturan cache adalah hipotesis. Hasil ulang menunjukkan harness terisolasi selesai dengan dev server tersedia. Tidak mengklaim pengujian semua kondisi jaringan atau production.

## R3 — Login pada runtime persisten

AC01/AC03. Setelah source/build terbaru, PM mencoba login HTTP pada dev server reguler port 3000 menggunakan file akun lokal privat. Hasil 503. Pemeriksaan DB langsung menggunakan runtime role lulus: lab002_local/lab002_app, satu akun dan satu record sesi. Kredensial tidak ditampilkan. CLI reset belum dijalankan karena langkah login awal gagal. Anonymous redirect bukan bukti login persisten bekerja.

Expected: aplikasi reguler dapat login/logout memakai database lokal yang telah diprovision. Executor memeriksa environment/runtime server yang dimilikinya; jangan mengubah password atau menghapus data untuk menutupi masalah. Acceptance tetap ditahan sampai login persisten dan CLI owner dapat diperiksa.

PM juga mengulang login pada build Node terbaru dengan fixture PostgreSQL sementara: PASS, heading 'Absensi kelas' dan pesan 'Pengisian absensi belum tersedia.' terlihat langsung di browser. Pending browser heading dalam laporan Executor sudah dipenuhi.


## Keputusan acceptance PM

R3 selesai. Executor mengonfirmasi startup hanya memuat auth-env sehingga NUXT_DATABASE_URL kosong. Dev server miliknya dimulai ulang dengan local-env dan auth-env; tidak ada perubahan source. PM lalu menjalankan uji CLI reset pada akun fiktif persisten: login awal 200, perintah reset exit 0, file privat berubah, sesi/password lama ditolak, login/password baru serta logout 200. Bukti pm-cli-reset.txt tidak berisi credential atau cookie. Password terbaru tetap hanya pada file privat ignored .data.

| AC | Hasil PM | Bukti utama |
|---|---|---|
| AC01 | PASS lokal | HTTP suite independen; browser laptop/HP; login persisten dan logout setelah reset |
| AC02 | PASS lokal | Dua sesi, logout per perangkat, reset semua sesi, Origin dan guard; review source |
| AC03 | PASS lokal | CLI provision Executor; CLI reset persisten PM; audit/redaksi dalam suite; .data ignored |
| AC04 | PASS | Form kosong/salah/valid, reload/logout; viewport HP; home copy terbaru diamati PM |
| AC05 | PASS | DATA 6/6, AUTH 12/12, typecheck exit 0 independen; output build Vercel/Node dan metadata diperiksa |
| AC06 | PASS | README, environment/build guide, laporan Executor dan review tersedia |

Keputusan PM: hasil AUTH-001 diterima dan CLOSED menurut delegasi Ardy. Ini tidak menyatakan Ardy melakukan pengujian atau memberi approval hasil per task. Seluruh tindakan delivery AUTH selesai; PM membuat commit lokal sesudah staging diperiksa. Pengelolaan siswa/semester/absensi/laporan belum diimplementasikan. Throttle production, deploy, perangkat fisik dan penggunaan sekolah nyata belum diverifikasi.
