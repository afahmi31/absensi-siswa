# DATA-001 — Pemeriksaan PM awal dan revisi R1

Tanggal2026-10-12. Status task tetap pengerjaan; hasil belum diterima.
Sumber: inspeksi PM dan preliminary read-only helper /root/lab002_ui002 terhadap snapshot yang masih berubah. Executor melaporkan suite6/6 dan typecheck/Vercelbuild sebelum temuan baru; bukan finalacceptance.

R1a C07: expected tanggalmembership yang mengecualikan recordedattendance ditolak dan effectiveview hanya tanggalvalid; observed guard belumcek recordeddate dan view hanyais_effective. Scope guard/query/test active membership existingrecord.
R1b C07: expected confirmed holiday exception+allattendanceexclusion atomic, auditprovenance same school/date/kind; observed separate transactions and non-null exceptionid only. Scope service transaction/constraints/rollback/mismatch/bulk tests.
R1c C07: expected no exceptionmutation withinclosedsemester, includingnote; observed guard onlyinsert/kindchange. Scope allmutationguard/note-onlytest.
R1d C08: expected reusable actortransaction context forauthenticatedfuture service, no secretaudit; observed actor defaults system and onlymanualGUC test. Scope helper/testrepositorypropagation, noauth/UI.

Daily batch/version409 C06 remains explicit ATT-001 dependency, not defect to expand DATA now. Newdateentryafterholidayrestore already tested per Executor. All R1 changes must re-run tests/checks relevant and report actualfailure/fix. No scopechange/cloud/commitbyExecutor. PM followsuntilreview.
