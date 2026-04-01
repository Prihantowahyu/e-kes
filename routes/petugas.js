// routes/petugas.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');

// GET /petugas
router.get('/', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const [petugas]    = await db.execute('SELECT * FROM petugas ORDER BY nama');
  const [petugasKBM] = await db.execute('SELECT * FROM petugas_kbm ORDER BY nama');
  res.render('pages/petugas/index', { title: 'Manajemen Petugas', petugas, petugasKBM });
});

// POST /petugas
router.post('/', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { nama, tipe } = req.body;
  const kode = (tipe === 'kbm' ? 'KBM' : 'PTG') + '-' + moment().format('YYYYMMDD') + '-' + Date.now().toString().slice(-3);
  const table = tipe === 'kbm' ? 'petugas_kbm' : 'petugas';
  await db.execute(`INSERT INTO ${table} (kode,nama) VALUES (?,?)`, [kode, nama.trim()]);
  req.flash('success', `Petugas ${nama} berhasil ditambahkan.`);
  res.redirect('/petugas');
});

// DELETE /petugas/:id
router.delete('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { tipe } = req.body;
  const table = tipe === 'kbm' ? 'petugas_kbm' : 'petugas';
  await db.execute(`UPDATE ${table} SET aktif=0 WHERE id=?`, [req.params.id]);
  req.flash('success', 'Petugas dinonaktifkan.');
  res.redirect('/petugas');
});

module.exports = router;
