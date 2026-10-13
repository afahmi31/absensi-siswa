# Snapshot data guru dan pemeriksaan target

13 Oktober 2026. Ardy meminta kelanjutan backup/snapshot dan pemeriksaan target; belum izin import nyata atau deployment. Source database lokal terkelola diaktifkan setelah restart; tidak menerapkan migration tambahan pada source.

Snapshot custom-format privat berhasil dibuat pada app/.data/cloud-transfer,182443bytes, total3844baris di11tabel. Manifest snapshot-20261013T090150Z-8b1a7f9f-d817-4ae2-bb18-f79881b18980.json memuat sourceledger4/targetledger7. Roster38, memberships38, attendance1810, audit1947; satu akun/sekolah/kelas/semester, tujuh aturan kalender, tanpa pengecualian/snapshot semester tertutup. Tidak menampilkan nilai identitas atau payload audit. Sesi/ledger/throttle tidak masuk backup transfer.

Pemeriksaan target berhenti pada guard URL sebelum querycloud: regex alat mengharapkan dot sebelum region, sementara endpoint Session pooler aktual memakai aws-1-ap-southeast-1.pooler.supabase.com. Ini koreksi kompatibilitas hostname, bukan perubahan target/provider/role/TLS. PM menyerahkan revisi terarah kepada Executor dengan negative tests; no cloud/sourcewrite. Setelah fix diperiksa, ulangi checkread-only. Restore rehearsal backup nyata masih perlu dilakukan lokalprivat sebelum izinimport; snapshot berhasil tidak membuktikan restore aktual.

Next owner online_preflight untuk koreksi hostnameguard, PM untuk review/checktarget/rehearsal dan dialogizinimport setelah paket konkret siap.
