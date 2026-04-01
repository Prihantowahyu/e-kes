// routes/siswa.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const multer  = require('multer');
const path    = require('path');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, 'siswa_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// GET /siswa
router.get('/', isAuthenticated, async (req, res) => {
  const { q, kelas, status } = req.query;
  let sql = 'SELECT * FROM siswa WHERE 1=1';
  const params = [];
  if (q)      { sql += ' AND (nis LIKE ? OR nama LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (kelas)  { sql += ' AND kelas = ?'; params.push(kelas); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  else        { sql += ' AND status = "Aktif"'; }
  sql += ' ORDER BY kelas, nama';
  try {
    const [siswa] = await db.execute(sql, params);
    const [kelasList] = await db.execute('SELECT DISTINCT kelas FROM siswa ORDER BY kelas');
    res.render('pages/siswa/index', { title: 'Data Siswa', siswa, kelasList, q, kelas, status });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// GET /siswa/tambah
router.get('/tambah', isAuthenticated, isAdminOrTatib, (req, res) => {
  res.render('pages/siswa/form', { title: 'Tambah Siswa', siswa: null, action: '/siswa', method: 'POST' });
});

// POST /siswa
router.post('/', isAuthenticated, isAdminOrTatib, upload.single('foto'), async (req, res) => {
  const { nis, nama, kelas, jenis_kelamin, nama_wali, no_wali, alamat } = req.body;
  const foto = req.file ? req.file.filename : null;
  try {
    await db.execute(
      'INSERT INTO siswa (nis,nama,kelas,jenis_kelamin,nama_wali,no_wali,alamat,foto) VALUES (?,?,?,?,?,?,?,?)',
      [nis, nama, kelas, jenis_kelamin, nama_wali||null, no_wali||null, alamat||null, foto]
    );
    req.flash('success', `Siswa ${nama} berhasil ditambahkan.`);
    res.redirect('/siswa');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/siswa/tambah');
  }
});

// GET /siswa/:nis/edit
router.get('/:nis/edit', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [req.params.nis]);
  if (!rows.length) { req.flash('error','Siswa tidak ditemukan'); return res.redirect('/siswa'); }
  res.render('pages/siswa/form', { title: 'Edit Siswa', siswa: rows[0], action: `/siswa/${rows[0].nis}?_method=PUT`, method: 'POST' });
});

// PUT /siswa/:nis
router.put('/:nis', isAuthenticated, isAdminOrTatib, upload.single('foto'), async (req, res) => {
  const { nama, kelas, jenis_kelamin, nama_wali, no_wali, alamat, status } = req.body;
  const foto = req.file ? req.file.filename : null;
  try {
    if (foto) {
      await db.execute(
        'UPDATE siswa SET nama=?,kelas=?,jenis_kelamin=?,nama_wali=?,no_wali=?,alamat=?,foto=?,status=? WHERE nis=?',
        [nama, kelas, jenis_kelamin, nama_wali, no_wali, alamat, foto, status, req.params.nis]
      );
    } else {
      await db.execute(
        'UPDATE siswa SET nama=?,kelas=?,jenis_kelamin=?,nama_wali=?,no_wali=?,alamat=?,status=? WHERE nis=?',
        [nama, kelas, jenis_kelamin, nama_wali, no_wali, alamat, status, req.params.nis]
      );
    }
    req.flash('success', 'Data siswa berhasil diperbarui.');
    res.redirect('/siswa');
  } catch (e) {
    req.flash('error', e.message); res.redirect(`/siswa/${req.params.nis}/edit`);
  }
});

// DELETE /siswa/:nis
router.delete('/:nis', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    await db.execute('UPDATE siswa SET status="Non-Aktif" WHERE nis=?', [req.params.nis]);
    req.flash('success', 'Siswa dinonaktifkan.');
    res.redirect('/siswa');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/siswa');
  }
});

// GET /siswa/:nis — detail
router.get('/:nis', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [req.params.nis]);
    if (!rows.length) { req.flash('error','Siswa tidak ditemukan'); return res.redirect('/siswa'); }
    const [pelanggaran] = await db.execute('SELECT * FROM pelanggaran WHERE nis=? ORDER BY tanggal DESC', [req.params.nis]);
    const [sp]          = await db.execute('SELECT * FROM surat_peringatan WHERE nis=? ORDER BY tanggal_sp DESC', [req.params.nis]);
    const [penyitaan]   = await db.execute('SELECT * FROM penyitaan WHERE nis=? ORDER BY tanggal DESC', [req.params.nis]);
    res.render('pages/siswa/detail', { title: 'Detail Siswa', siswa: rows[0], pelanggaran, sp, penyitaan });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/siswa');
  }
});

module.exports = router;
