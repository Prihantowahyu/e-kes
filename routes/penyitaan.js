// routes/penyitaan.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const multer  = require('multer');
const path    = require('path');
const moment  = require('moment');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename:    (req, file, cb) => cb(null, 'pst_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function genId() {
  return 'PST-' + moment().format('YYYYMMDD') + '-' + Date.now().toString().slice(-4);
}

// GET /penyitaan
router.get('/', isAuthenticated, async (req, res) => {
  const { q, status, jenis } = req.query;
  let sql = 'SELECT * FROM penyitaan WHERE 1=1';
  const params = [];
  if (q)      { sql += ' AND (nis LIKE ? OR nama_siswa LIKE ? OR nama_barang LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (status) { sql += ' AND status_pengembalian = ?'; params.push(status); }
  if (jenis)  { sql += ' AND jenis_barang = ?'; params.push(jenis); }
  sql += ' ORDER BY tanggal DESC, waktu DESC';
  try {
    const [penyitaan] = await db.execute(sql, params);
    const [siswa]     = await db.execute('SELECT nis,nama,kelas,nama_wali,no_wali FROM siswa WHERE status="Aktif" ORDER BY kelas,nama');
    const [petugas]   = await db.execute('SELECT * FROM petugas WHERE aktif=1');
    const [[{ total }]]  = await db.execute('SELECT COUNT(*) AS total FROM penyitaan');
    const [[{ belum }]]  = await db.execute('SELECT COUNT(*) AS belum FROM penyitaan WHERE status_pengembalian="Belum Dikembalikan"');
    const [[{ kembali }]]= await db.execute('SELECT COUNT(*) AS kembali FROM penyitaan WHERE status_pengembalian="Sudah Dikembalikan"');
    res.render('pages/penyitaan/index', { title: 'Penyitaan Barang', penyitaan, siswa, petugas,
      stats: { total, belum, kembali }, filter: { q, status, jenis } });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// POST /penyitaan
router.post('/', isAuthenticated, upload.single('foto'), async (req, res) => {
  const { nis, jenis_barang, nama_barang, jumlah_barang, kondisi, tanggal, tempat_penyitaan, petugas_penyita, catatan } = req.body;
  try {
    const [siswaRows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [nis]);
    if (!siswaRows.length) { req.flash('error','Siswa tidak ditemukan'); return res.redirect('/penyitaan'); }
    const s    = siswaRows[0];
    const foto = req.file ? req.file.filename : null;
    const kode = genId();
    const tgl  = tanggal || moment().format('YYYY-MM-DD');
    const wkt  = moment().format('HH:mm:ss');
    await db.execute(
      `INSERT INTO penyitaan (kode_pst,nis,nama_siswa,kelas,nama_wali,no_wali,jenis_barang,nama_barang,
       jumlah_barang,kondisi,tanggal,waktu,tempat_penyitaan,petugas_penyita,foto_url,catatan)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [kode, s.nis, s.nama, s.kelas, s.nama_wali, s.no_wali,
       jenis_barang, nama_barang, jumlah_barang||1, kondisi||'Baik',
       tgl, wkt, tempat_penyitaan||null, petugas_penyita||null, foto, catatan||null]
    );
    req.flash('success', `Penyitaan barang ${nama_barang} untuk ${s.nama} berhasil dicatat.`);
    res.redirect('/penyitaan');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/penyitaan');
  }
});

// PUT /penyitaan/:id/kembalikan
router.put('/:id/kembalikan', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { status_pengembalian, tanggal_pengambilan, catatan_pengambilan } = req.body;
  try {
    await db.execute(
      'UPDATE penyitaan SET status_pengembalian=?,tanggal_pengambilan=?,catatan_pengambilan=? WHERE id=?',
      [status_pengembalian, tanggal_pengambilan||null, catatan_pengambilan||null, req.params.id]
    );
    req.flash('success', 'Status pengembalian diperbarui.');
    res.redirect('/penyitaan');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/penyitaan');
  }
});

// DELETE /penyitaan/:id
router.delete('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    await db.execute('DELETE FROM penyitaan WHERE id=?', [req.params.id]);
    req.flash('success', 'Data penyitaan dihapus.');
    res.redirect('/penyitaan');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/penyitaan');
  }
});

module.exports = router;
