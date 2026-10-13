# LAB002-LOCAL-DATA-001 — Pemindahan data guru ke lokal

Tanggal: 13 Oktober 2026. Status: READY_FOR_ARDY_REVIEW. Executor Codex gpt-6-luna/max menyelesaikan pemindahan; PM memvalidasi kandidat dan hasil melalui API aplikasi. Ardy membandingkan data nyata sebelum pembahasan deployment.

Sumber izin Ardy: “oke buatkan itu dulu agar data berada di local saya. lalu setelah aku cek data sudah sama dengan absen yang diberikan bari kita bahas persiapan deployment”. Izin ini memperbolehkan pemindahan data guru sebenarnya untuk task lokal ini, menggantikan larangan data nyata pada scope uji sintetis sebelumnya. Cloud/deployment tetap ditunda.

Scope: pemindahan satu kali daftar siswa dan riwayat absensi dari file guru yang sudah disesuaikan. Pilihan Ardy untuk tanggal dengan dua kiriman: Timestamp terbaru. Sumber privat berisi 38 siswa, 50 tanggal, 1.900 pasangan siswa/tanggal, 1.810 status terisi dan 90 kosong. Jangan menyimpan identitas siswa atau kredensial dalam Git/laporan publik.

Root aplikasi: subfolder app registry LAB-002. Acuan: kontrak delivery lokal C06/C07/C08, source repositori dan migrasi aktual, file sumber privat. Tidak mengimplementasikan fitur unggah Excel umum.

Syarat keberhasilan:

- Preflight mencatat kondisi sekolah/semester/roster/kalender yang ada dan konflik tanpa mengubah data.
- Target semester, kalender dan tanggal terdaftar dipastikan sebelum write. Jangan menebak hari libur atau batas semester dari tanggal kiriman.
- Backup database dibuat sebelum write. Pemindahan diuji pada target lokal terisolasi dahulu.
- Pemindahan mempertahankan relasi, status kosong, audit serta provenance sumber; atomik dan aman dijalankan ulang. Tidak menghapus/menimpa data existing atau mengubah arsip tertutup.
- PM membandingkan seluruh status dan roster terhadap sumber, memeriksa data melalui aplikasi, lalu menyerahkan URL serta batas pemeriksaan kepada Ardy.

Ownership Executor: script privat dan rehearsal; tidak mengubah aplikasi/runtime delivery tanpa kebutuhan yang dilaporkan. PM: keputusan readiness, backup/izin write setelah preflight, validasi, handoff. Ardy: membandingkan data nyata sebelum pembahasan deployment. Tidak commit/push/remote/resource cloud/deploy pada task ini.

## Keputusan kalender dan periode Ardy

13 Oktober 2026: hari rutin Senin–Sabtu. Hari libur nasional dilengkapi guru melalui website selama semester belum ditutup. Ardy meminta awal/akhir mengikuti tanggal absensi file: 14 Juli–12 Oktober 2026 inklusif. Gunakan periode tersebut dalam semester aktif ganjil 2026/2027; perlu memperpanjang tanggal akhir melalui website jika hendak mengisi hari setelah 12 Oktober. Jangan menambah libur nasional atau menutup semester otomatis. Periksa apakah sumber memiliki catatan Minggu; konflik demikian dilaporkan sebelum write.

## Penggantian data percobaan disetujui

Preflight menemukan 2 siswa percobaan serta 2 absensi H pada 13 Oktober dalam semester aktif 14 Juli 2026–20 Mei 2027. Pada dialog 13 Oktober, Ardy memilih: “Data existing hanya percobaan; ganti dengan data guru setelah backup”. Izin penggantian berlaku data percobaan tersebut dengan backup, bukan penghapusan arsip lain. Akun login dipertahankan. Database lokal terpisah dapat disiapkan dan divalidasi sebelum pengalihan runtime agar database lama/backup tetap menjadi titik pemulihan. Tidak menghapus audit immutable lewat bypass guard.
