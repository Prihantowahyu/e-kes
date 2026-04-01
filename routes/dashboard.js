// routes/dashboard.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [[{ totalSiswa }]]       = await db.execute('SELECT COUNT(*) AS totalSiswa FROM siswa WHERE status="Aktif"');
    const [[{ totalPelanggaran }]] = await db.execute('SELECT COUNT(*) AS totalPelanggaran FROM pelanggaran');
    const [[{ belumKonfirmasi }]]  = await db.execute('SELECT COUNT(*) AS belumKonfirmasi FROM pelanggaran WHERE status="Belum Dikonfirmasi"');
    const [[{ totalSP }]]          = await db.execute('SELECT COUNT(*) AS totalSP FROM surat_peringatan WHERE status="Aktif"');
    const [[{ totalPenyitaan }]]   = await db.execute('SELECT COUNT(*) AS totalPenyitaan FROM penyitaan WHERE status_pengembalian="Belum Dikembalikan"');
    const [[{ hariIniHadir }]]     = await db.execute('SELECT COUNT(*) AS hariIniHadir FROM kehadiran WHERE tanggal=? AND status_kehadiran="Hadir"', [today]);
    const [[{ hariIniAlpha }]]     = await db.execute('SELECT COUNT(*) AS hariIniAlpha FROM kehadiran WHERE tanggal=? AND status_kehadiran="Alpha"', [today]);
    const [[{ hariIniTerlambat }]] = await db.execute('SELECT COUNT(*) AS hariIniTerlambat FROM kehadiran WHERE tanggal=? AND status_kehadiran="Terlambat"', [today]);

    // Pelanggaran 7 hari terakhir
    const [grafik] = await db.execute(`
      SELECT DATE(tanggal) AS tgl, COUNT(*) AS jumlah
      FROM pelanggaran
      WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(tanggal) ORDER BY tgl ASC
    `);

    // Per jenis pelanggaran
    const [byJenis] = await db.execute(`
      SELECT jenis_pelanggaran, COUNT(*) AS jumlah
      FROM pelanggaran GROUP BY jenis_pelanggaran
    `);

    // Pelanggaran terbaru
    const [recentPelanggaran] = await db.execute(`
      SELECT * FROM pelanggaran ORDER BY created_at DESC LIMIT 10
    `);

    res.render('pages/dashboard', {
      title: 'Dashboard — Sistem Kesiswaan',
      stats: { totalSiswa, totalPelanggaran, belumKonfirmasi, totalSP, totalPenyitaan, hariIniHadir, hariIniAlpha, hariIniTerlambat },
      grafik, byJenis, recentPelanggaran, today
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat dashboard: ' + e.message);
    res.redirect('/login');
  }
});

module.exports = router;
