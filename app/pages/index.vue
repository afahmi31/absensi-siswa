<template>
  <main class="page-content home-content">
    <section class="page-heading">
      <p class="eyebrow">Ruang guru</p>
      <h1>Absensi kelas</h1>
      <p>Atur data sekolah, siswa, semester, dan kalender untuk menyiapkan periode belajar.</p>
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
      <NuxtLink class="home-link-card" to="/semesters">
        <span class="home-link-icon" aria-hidden="true">03</span>
        <span>
          <strong>Semester</strong>
          <small>Atur periode belajar dan daftar siswa per semester</small>
        </span>
        <span class="home-link-arrow" aria-hidden="true">→</span>
      </NuxtLink>
      <NuxtLink class="home-link-card" to="/calendar">
        <span class="home-link-icon" aria-hidden="true">04</span>
        <span>
          <strong>Kalender sekolah</strong>
          <small>Atur hari sekolah rutin, hari libur, dan hari sekolah khusus</small>
        </span>
        <span class="home-link-arrow" aria-hidden="true">→</span>
      </NuxtLink>
      <NuxtLink class="home-link-card" to="/attendance">
        <span class="home-link-icon" aria-hidden="true">05</span>
        <span>
          <strong>Absensi harian</strong>
          <small>Isi dan koreksi absensi siswa pada hari sekolah</small>
        </span>
        <span class="home-link-arrow" aria-hidden="true">→</span>
      </NuxtLink>
    </section>

    <section class="notice-panel" aria-labelledby="attendance-notice-title">
      <h2 id="attendance-notice-title">Absensi harian sudah tersedia</h2>
      <p>Absensi dapat diisi dan dikoreksi setelah kalender hari sekolah diatur. Impor Excel dan laporan belum tersedia.</p>
    </section>
  </main>
</template>
