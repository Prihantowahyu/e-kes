// routes/pelanggaran.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const multer  = require('multer');
const path    = require('path');
const moment  = require('moment');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename:    (req, file, cb) => cb(null, 'pel_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function genId() {
  return 'PLG-' + moment().format('YYYYMMDD') + '-' + Date.now().toString().slice(-6);
}

// GET /pelanggaran
router.get('/', isAuthenticated, async (req, res) => {
  const { q, status, jenis, dari, sampai } = req.query;
  let sql = 'SELECT * FROM pelanggaran WHERE 1=1';
  const params = [];
  if (q)      { sql += ' AND (nis LIKE ? OR nama_siswa LIKE ? OR kelas LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (jenis)  { sql += ' AND jenis_pelanggaran = ?'; params.push(jenis); }
  if (dari)   { sql += ' AND tanggal >= ?'; params.push(dari); }
  if (sampai) { sql += ' AND tanggal <= ?'; params.push(sampai); }
  sql += ' ORDER BY created_at DESC';
  try {
    const [pelanggaran] = await db.execute(sql, params);
    const [siswa]       = await db.execute('SELECT nis,nama,kelas FROM siswa WHERE status="Aktif" ORDER BY kelas,nama');
    const [petugas]     = await db.execute('SELECT * FROM petugas WHERE aktif=1');
    res.render('pages/pelanggaran/index', { title: 'Rekam Pelanggaran', pelanggaran, siswa, petugas, filter: { q, status, jenis, dari, sampai } });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// POST /pelanggaran
router.post('/', isAuthenticated, upload.single('foto'), async (req, res) => {
  const { nis, jenis_pelanggaran, tanggal, catatan, input_oleh } = req.body;
  try {
    const [siswaRows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [nis]);
    if (!siswaRows.length) { req.flash('error','Siswa tidak ditemukan'); return res.redirect('/pelanggaran'); }
    const s     = siswaRows[0];
    const foto  = req.file ? req.file.filename : null;
    const kode  = genId();
    const tgl   = tanggal || moment().format('YYYY-MM-DD');
    const waktu = moment().format('HH:mm:ss');
    await db.execute(
      'INSERT INTO pelanggaran (kode,nis,nama_siswa,kelas,nama_wali,jenis_pelanggaran,tanggal,waktu,foto_url,catatan,input_oleh) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [kode, s.nis, s.nama, s.kelas, s.nama_wali, jenis_pelanggaran, tgl, waktu, foto, catatan||null, input_oleh||req.session.user.nama]
    );
    req.flash('success', `Pelanggaran ${s.nama} berhasil dicatat.`);
    res.redirect('/pelanggaran');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/pelanggaran');
  }
});

// POST /pelanggaran/:id/konfirmasi
router.post('/:id/konfirmasi', isAuthenticated, isAdminOrTatib, upload.single('foto'), async (req, res) => {
  try {
    const foto = req.file ? req.file.filename : null;
    if (foto) {
      await db.execute('UPDATE pelanggaran SET status="Terkonfirmasi", foto_url=? WHERE id=?', [foto, req.params.id]);
    } else {
      await db.execute('UPDATE pelanggaran SET status="Terkonfirmasi" WHERE id=?', [req.params.id]);
    }
    req.flash('success', 'Pelanggaran dikonfirmasi.');
    res.redirect('/pelanggaran');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/pelanggaran');
  }
});

// PUT /pelanggaran/:id
router.put('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { jenis_pelanggaran, tanggal, catatan } = req.body;
  try {
    await db.execute('UPDATE pelanggaran SET jenis_pelanggaran=?,tanggal=?,catatan=? WHERE id=?',
      [jenis_pelanggaran, tanggal, catatan, req.params.id]);
    req.flash('success', 'Data pelanggaran diperbarui.');
    res.redirect('/pelanggaran');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/pelanggaran');
  }
});

// DELETE /pelanggaran/:id
router.delete('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    await db.execute('DELETE FROM pelanggaran WHERE id=?', [req.params.id]);
    req.flash('success', 'Data pelanggaran dihapus.');
    res.redirect('/pelanggaran');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/pelanggaran');
  }
});

module.exports = router;
