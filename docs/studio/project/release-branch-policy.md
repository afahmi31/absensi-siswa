# Main rilis bersih dan develop lengkap

13 Oktober 2026. Ardy menyetujui main bersih dan develop menyimpan development melalui dialog. Keputusan menggantikan penggunaan main sebagai seluruh source development. Riwayat tetap, tanpa forcepush atau menghapus arsip/tes/docs.

Develop dibuat dari9b24913, mencakup source lengkap dan koreksi hostname pooler, serta telahpush. Checkout kerja studio memakai develop sehingga alat/database lokal tidak hilang. Main akan diperbarui melalui commit normal dengan tree hasil generator rilis yang sudah diperiksa diisolasi; tidak checkoutmain pada direktori data lokal. Docs/tes/AI/generator/toolingops tidak menjadi tree rilis. Dependency compiler yang dibutuhkan build tetap, pemilahan berdasarkan kebutuhan nyata bukan labeldev.

PM mengaturGit, registry/sync dan review. Executor REL-CLEAN-001 menginventarisruntime/build, menyiapkan tree dan mengujiinstallnpm10.9.3/Node24/buildVercel. Jangan meneruskan merge develop ke main tanpa generator, karena akan mengembalikan berkas development. Perubahan produk dikerjakan develop, tes lalu generate release dan reviewdiff sebelumcommitmain. Parentmain tetapriwayatmain, noforcepush.

ErrorVercel dariArdy: npm11.19 tidakmemenuhiengine10.9.3<11, Node24.21 sesuai. Versi npm tetapdipatok, tidakmelonggarkanengine. Installconfig rilis diuji sebelumpushmain. Buildlokal tidakmembuktikan remoteinstall/deploy; remote membutuhkan project/commit/envtarget yangterverifikasi. Jangan menganggap pushmain aman dariautodeploy bila Gitintegrationaktif; periksa project/izin sebelumpushrelease.

Mainremote saatpencatatan16167b9, mainlokal9b24913, develop9b24913. Status pekerjaan rilis sedangdikerjakan, belummainbersih/belumdeploybaru. Izin menyusunmainbersih danpush berasalkeputusanArdy, deploymenttarget konkret tetapterpisah.
