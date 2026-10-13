# Bukti verifikasi Executor — LAB002-ATT-001

Tanggal: 13 Oktober 2026
Executor: Codex subagent `gpt-6-luna/max`
Target: aplikasi lokal; fixture database terisolasi dan data sintetis.

## Pemeriksaan kode dan database

Semua perintah dijalankan dari direktori `app` dengan Node bundled `24.19.0` dan npm `10.9.3`.

| Perintah | Hasil |
|---|---|
| `npm run test:attendance` | Exit 0, 7/7. Meliputi HTTP, repository, riwayat, status clear, validasi, konflik, dan race penutupan. |
| `npm test` | Exit 0, 43/43: DATA/schema 11, AUTH 12, STUD/SEM 8, CAL 5, ATT 7. |
| `npm run typecheck` | Exit 0 pada source final. |
| `npm run build:node` | Exit 0; build selesai sebelum runtime lokal bersama dinyalakan PM. Target Node lokal. |
| Tes ATT independen PM | Exit 0, 7/7; keluaran tersimpan di `pm-test-attendance.txt`. |

Regresi race mengunci semaphore 1727 pada fixture, lalu meminta close semester yang memperoleh 1728 dan menunggu 1727. Tes mengantrekan PUT absensi dan POST siswa, memastikan keduanya menunggu, lalu melepas gate. Close berhasil; kedua request yang antre menerima 409 dan POST tidak meninggalkan siswa atau membership yatim. Gate dilepas di `finally` dan semua hasil ditunggu.

Tes memakai PostgreSQL disposable dengan data sintetis. Migration `0001`–`0003` tidak diubah; migration ATT baru adalah `0004`. GET hari tidak membuat row/audit. GET/PUT/histori diperiksa melalui HTTP ber-auth, termasuk ownership dan origin. Clear eksplisit mencatat audit dan mempertahankan histori terdahulu.

## Fixture review browser PM

Fixture browser terisolasi tersedia di `http://127.0.0.1:3101`; akun dan sekolahnya sintetis. API mengonfirmasi tanggal lokal sekolah `2026-10-13` adalah hari sekolah, tiga siswa memenuhi syarat dan belum diisi, sedangkan membership siswa keempat baru mulai `2026-10-14` dan tidak memenuhi syarat pada tanggal utama.

Metadata privat: `app/.data/pm-att-browser-a2372697-c885-406c-8e60-5cd4a088d609/fixture.json`. Runner, password fixture, cluster PostgreSQL, dan hasil turunan berada dalam direktori privat/diabaikan Git itu. Metadata tidak menyimpan password, URL database, atau session secret. Fixture dibuat dari source final pada root Nuxt terisolasi agar output `.output` runtime lokal bersama tidak tertimpa.

PM mengamati halaman memuat tiga siswa eligible dalam keadaan kosong dan tidak menampilkan Dimas yang mulai besok. “Tandai semua hadir” mengubah tiga baris menjadi H dan menandai draft; tab kedua tetap menampilkan tiga baris kosong, yang membuktikan tidak ada autosave. Saat berpindah ke route Siswa, browser menampilkan `window.confirm` untuk draft. Dialog native tersebut lalu memblokir otomasi CUA: dialog tidak dapat didismiss melalui wrapper browser, dan aksi React pada tab lain tidak lagi jalan. Karena itu simpan parsial, koreksi, 409, clear, riwayat, serta alur setelah konfirmasi tidak tervalidasi oleh review browser ini.

PM akan menyerahkan pengujian interaksi yang tersisa kepada Ardy pada runtime lokal bersama. Saat cleanup, browser tab non-blocked 2/3/4 berhasil ditutup; tab fixture asal yang masih memegang dialog native tidak bisa ditutup melalui CUA. Sesuai arahan PM, Executor menghentikan hanya Nuxt fixture PID 11428 dan PostgreSQL fixture PID 18332. Keduanya terverifikasi berhenti dan port 3101/51840 tidak lagi listen. Direktori fixture privat dipertahankan. Runtime bersama PID 17520/port 3000 dan managed PostgreSQL PID 19592/port 55432 terverifikasi tetap listen. Hasil terbatas ini bukan acceptance PM atau Ardy.

## Batas bukti

- Review browser hanya memastikan roster awal, mark-all sebagai draft, tidak ada autosave, dan dialog konfirmasi dirty navigation muncul. Save/correction/409/history dan review viewport HP/laptop lengkap belum dibuktikan; ini bukan uji perangkat HP fisik.
- Tes tidak menggunakan data siswa nyata. Tidak ada cloud, Supabase, remote Git, commit, push, deployment, atau perubahan dependency global.
- Integrasi HTTP write untuk task mendatang CAL/ATT/IMP tidak diklaim selesai oleh bukti ATT ini.
