<template>
  <main class="page-content home-content">
    <section class="page-heading">
      <p class="eyebrow">Ruang guru</p>
      <h1>Absensi kelas</h1>
      <p>Atur data sekolah dan siswa sebelum pengisian absensi tersedia.</p>
    </section>

    <section class="home-links" aria-label="Data yang dapat dikelola">
      <NuxtLink class="home-link-card" to="/school">
        <span class="home-link-icon" aria-hidden="true">01</span>
        <span>
          <strong>Data sekolah</strong>
          <small>Nama sekolah, kelas, dan zona waktu</small>
        </span>
        <span class="home-link-arrow" aria-hidden="true">→</span>
      </NuxtLink>
      <NuxtLink class="home-link-card" to="/students">
        <span class="home-link-icon" aria-hidden="true">02</span>
        <span>
          <strong>Siswa</strong>
          <small>Kelola daftar siswa pada semester yang tersedia</small>
        </span>
        <span class="home-link-arrow" aria-hidden="true">→</span>
      </NuxtLink>
    </section>

    <section class="notice-panel" aria-labelledby="attendance-notice-title">
      <h2 id="attendance-notice-title">Pengisian absensi belum tersedia</h2>
      <p>Pembuatan semester dan pengisian absensi akan tersedia pada tahap berikutnya.</p>
    </section>
  </main>
</template>
