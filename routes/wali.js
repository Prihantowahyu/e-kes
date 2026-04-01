// routes/wali.js — Dashboard Wali Kelas
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { isAuthenticated } = require('../middleware/auth');

// Middleware: hanya wali_kelas atau admin
function isWali(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (role === 'wali_kelas' || role === 'admin' || role === 'tatib') return next();
  req.flash('error', 'Akses ditolak.'); return res.redirect('/dashboard');
}

// GET /wali
router.get('/', isAuthenticated, isWali, async (req, res) => {
  try {
    // Wali kelas hanya lihat kelasnya sendiri; admin bisa pilih semua
    const kelasSaya = req.session.user.kelas || '';
    const { kelas } = req.query;
    const kelasFilter = (req.session.user.role === 'wali_kelas') ? kelasSaya : (kelas || kelasSaya);

    const [kelasList] = await db.execute('SELECT DISTINCT kelas FROM siswa WHERE status="Aktif" ORDER BY kelas');

    if (!kelasFilter) {
      return res.render('pages/wali/index', {
        title: 'Dashboard Wali Kelas', kelasFilter: '', kelasList,
        siswa:[], stats:{}, pelanggaran:[], sp:[], kehadiranHariIni:[]
      });
    }

    const [siswa] = await db.execute(
      'SELECT * FROM siswa WHERE kelas=? AND status="Aktif" ORDER BY nama', [kelasFilter]
    );
    const today = moment().format('YYYY-MM-DD');

    // Statistik kelas
    const [[{totalPel}]]  = await db.execute(
      'SELECT COUNT(*) AS totalPel FROM pelanggaran WHERE kelas=? AND MONTH(tanggal)=MONTH(CURDATE())', [kelasFilter]);
    const [[{totalSP}]]   = await db.execute(
      'SELECT COUNT(*) AS totalSP FROM surat_peringatan WHERE kelas=? AND status="Aktif"', [kelasFilter]);
    const [[{totalAlpha}]]= await db.execute(
      'SELECT COUNT(*) AS totalAlpha FROM pelanggaran WHERE kelas=? AND jenis_pelanggaran="Alpha" AND MONTH(tanggal)=MONTH(CURDATE())', [kelasFilter]);

    // Kehadiran hari ini
    const [kehadiranHariIni] = await db.execute(
      'SELECT * FROM kehadiran WHERE kelas=? AND tanggal=? ORDER BY nama_siswa', [kelasFilter, today]);

    // Pelanggaran bulan ini
    const [pelanggaran] = await db.execute(
      'SELECT * FROM pelanggaran WHERE kelas=? AND tanggal>=DATE_FORMAT(CURDATE(),"%%Y-%%m-01") ORDER BY tanggal DESC LIMIT 30',
      [kelasFilter]);

    // SP aktif
    const [sp] = await db.execute(
      'SELECT * FROM surat_peringatan WHERE kelas=? AND status="Aktif" ORDER BY tanggal_sp DESC', [kelasFilter]);

    // Siswa bermasalah (pelanggaran terbanyak bulan ini)
    const [topBermasalah] = await db.execute(`
      SELECT nis, nama_siswa, COUNT(*) AS jumlah FROM pelanggaran
      WHERE kelas=? AND tanggal>=DATE_FORMAT(CURDATE(),'%%Y-%%m-01')
      GROUP BY nis ORDER BY jumlah DESC LIMIT 5`, [kelasFilter]);

    res.render('pages/wali/index', {
      title: `Dashboard Wali Kelas — ${kelasFilter}`,
      kelasFilter, kelasList, siswa,
      stats: { totalPel, totalSP, totalAlpha, totalSiswa: siswa.length },
      pelanggaran, sp, kehadiranHariIni, topBermasalah, today
    });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// GET /wali/siswa/:nis — Detail siswa untuk wali kelas
router.get('/siswa/:nis', isAuthenticated, isWali, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [req.params.nis]);
    if (!rows.length) { req.flash('error','Siswa tidak ditemukan'); return res.redirect('/wali'); }
    const s = rows[0];

    // Validasi: wali_kelas hanya bisa lihat siswa kelasnya
    if (req.session.user.role === 'wali_kelas' && s.kelas !== req.session.user.kelas) {
      req.flash('error', 'Akses ditolak.'); return res.redirect('/wali');
    }

    const [pelanggaran] = await db.execute('SELECT * FROM pelanggaran WHERE nis=? ORDER BY tanggal DESC LIMIT 20', [s.nis]);
    const [sp]          = await db.execute('SELECT * FROM surat_peringatan WHERE nis=? ORDER BY tanggal_sp DESC', [s.nis]);
    const [kehadiran]   = await db.execute(
      'SELECT * FROM kehadiran WHERE nis=? ORDER BY tanggal DESC LIMIT 30', [s.nis]);

    res.render('pages/wali/siswa-detail', {
      title: `Detail — ${s.nama}`, siswa: s, pelanggaran, sp, kehadiran
    });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/wali');
  }
});

module.exports = router;
