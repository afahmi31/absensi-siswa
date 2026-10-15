# Push develop tanpa deployment — 16 Oktober 2026

Ardy meminta: "push saja dulu dangan dulu deploy". Target push hanya develop ke origin https://github.com/afahmi31/absensi-siswa.git. Main tetap c16bd4f8f020d9a7dd2441a442877e120d59d7a8. Setelah fetch, origin/develop f114192; develop9e147b7 memiliki empat commit lokal untuk performa dan laporan A/B/C.

Konfigurasi saat diperiksa belum menonaktifkan Preview deployment. Vercel MCP get_project untuk target yang tercatat mengembalikan404, sehingga pengaturan dashboard tidak dapat diverifikasi dari konektor. Agar memenuhi larangan deploy, PM menugaskan Executor yang sama menambah git.deploymentEnabled.develop=false di vercel.json sesuai dokumentasi resmi https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled. Install/build commands dan branchmain tidak diubah. Pengaturan tetap di develop hingga kelak ada keputusan untuk mengaktifkan Preview.

PM memeriksa diff/JSON sebelum commit dan push. Tidak ada CLI/API deployment, migrasi, atau perubahan data. Hash remote dan hasil push aktual dicatat pada handoff; push tidak dianggap berhasil sebelum server Git mengonfirmasi.
