# Target aktif — uji Ardy di komputer lokal

Tanggal: 12 Oktober 2026. Sumber Ardy: “saat ini kerjakan hingga bisa saya uji di local saya, setelah saya ujicoba dan tidak ada kendala nanti kita bahas untuk git, deploy vercel dan supasenya. saat ini pastikan berjalan di local komputer saya dulu”.

Keputusan ini menggantikan prioritas online pra-rilis sebagai target pengerjaan sekarang. Rencana Vercel/Supabase dan data guru online tetap arah berikutnya, DITUNDA sampai Ardy menguji lokal dan menyatakan tidak ada kendala. Jangan membuat resource, mengakses database cloud, deploy, menambah remote/push atau membuat commit baru sebelum pembahasan Git. Commit ecee50e tetap baseline yang sudah disimpan; perubahan lokal berikutnya dipertahankan tanpa commit.

Sasaran: aplikasi lokal dapat dipakai Ardy untuk login, mengatur sekolah/kelas/semester/siswa, mengatur kalender, mengisi absensi H/S/I/A, menyimpan sebagian, membuka kembali, mengoreksi dan memeriksa riwayat. Input gagal tetap dipertahankan; tanggal libur/semester tertutup terkunci dan konflik tidak menimpa data. Laporan cetak/PDF, impor Excel, logo dan fitur tambahan ditunda dari uji pertama.

Urutan: CAL-001 yang telah diassign lanjut; sesudah PM menerima CAL, rinci readiness dan assign ATT-001 ke Codex gpt-6-luna/max sesuai delegasi existing. PM memverifikasi alur browser HP/laptop dan persistensi lokal, lalu menyiapkan PostgreSQL proyek dan server pada loopback di komputer ini dengan panduan uji Ardy. Bukan sekadar build: login/input/save/reload harus teruji. Jangan ulang setup/desain atau fitur CLOSED tanpa delta yang memerlukan pemeriksaan.

Runtime: PostgreSQL16 managed proyek app/.data/postgres, port55432; env DB+auth privat ignored .data. Sebelum membuka app, jalankan migrasi versioned yang belum diterapkan tanpa reset/rollback data. Gunakan akun lokal yang sudah ada; jangan cetak credential dalam chat/log/Git. Verifikasi listener/runtime serta URL aktual, lalu serahkan langkah membuka aplikasi dan memperoleh akun lewat file privat lokal. Server lokal yang diserahkan harus tetap dapat dipakai Ardy; jangan mematikan runtime delivery seperti fixture tes. Jangan mengubah service PostgreSQL lain/global runtime.

Pengujian PM/Executor tetap memakai data sintetis terisolasi; jangan menyalin data siswa nyata ke evidence. Data online belum disiapkan. Penanggung jawab: PM untuk readiness/validation/handoff; Executor untuk kode task READY. PM tidak menulis kode aplikasi. Setelah alur lokal siap, hentikan assignment tambahan dan tunggu hasil uji Ardy.

Registry tetap acuan; app/docs/studio adalah salinan untuk penelusuran. Status CAL ASSIGNED pada registry telah diverifikasi PM, mirror ANALYSIS adalah salinan lama dan diperbarui sebelum implementasi lanjut. Preflight Executor READY_TO_EXECUTE diterima; belum hasil implementasi atau acceptance CAL.
